import type { SNSHandler } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { sendPushNotification, PushSubscriptionExpiredError } from '../shared/push-client';
import type { PersonRecord, PushSubscription } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const ssm = new SSMClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const VAPID_SSM_PATH = process.env.VAPID_SSM_PATH!; // e.g. /familyvault/dev

// ── SNS message shape published by classify-document ─────────
export interface PushNotificationMessage {
  vaultId: string;
  documentId: string;
  personId: string | null;
  suggestedDisplayName: string;
}

// ── Load VAPID keys from SSM once per cold start ──────────────
let vapidLoaded = false;

async function loadVapidFromSsm(): Promise<void> {
  if (vapidLoaded) return;
  const result = await ssm.send(
    new GetParametersCommand({
      Names: [`${VAPID_SSM_PATH}/vapid-public-key`, `${VAPID_SSM_PATH}/vapid-private-key`],
      WithDecryption: true,
    }),
  );
  for (const param of result.Parameters ?? []) {
    if (param.Name?.endsWith('/vapid-public-key')) {
      process.env.VAPID_PUBLIC_KEY = param.Value;
    } else if (param.Name?.endsWith('/vapid-private-key')) {
      process.env.VAPID_PRIVATE_KEY = param.Value;
    }
  }
  vapidLoaded = true;
}

// ── Fetch person's push subscription ─────────────────────────
async function fetchPersonSubscription(
  vaultId: string,
  personId: string,
): Promise<PushSubscription | null> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
      ProjectionExpression: 'pushSubscription',
    }),
  );
  if (!result.Item) return null;
  const record = unmarshall(result.Item) as Partial<PersonRecord>;
  return record.pushSubscription ?? null;
}

// ── Find any person in vault with a push subscription ─────────
// Used when personId is null but we still want to notify the vault owner
async function fetchAnySubscription(vaultId: string): Promise<{ personId: string; subscription: PushSubscription } | null> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'attribute_exists(pushSubscription)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': 'PERSON#',
      }),
      Limit: 1,
    }),
  );
  if (!result.Items?.length) return null;
  const record = unmarshall(result.Items[0]) as PersonRecord;
  return record.pushSubscription
    ? { personId: record.personId, subscription: record.pushSubscription }
    : null;
}

// ── Remove expired subscription from DynamoDB ─────────────────
async function clearPushSubscription(vaultId: string, personId: string): Promise<void> {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
      UpdateExpression: 'REMOVE pushSubscription, pushSubscriptionUpdatedAt SET updatedAt = :now',
      ExpressionAttributeValues: marshall({ ':now': new Date().toISOString() }),
    }),
  );
  console.log(`Cleared expired push subscription for personId=${personId}`);
}

export const handler: SNSHandler = async (event) => {
  await loadVapidFromSsm();

  for (const record of event.Records) {
    let message: PushNotificationMessage;
    try {
      message = JSON.parse(record.Sns.Message) as PushNotificationMessage;
    } catch {
      console.error('Failed to parse SNS message:', record.Sns.Message);
      continue;
    }

    const { vaultId, documentId, personId, suggestedDisplayName } = message;

    let targetPersonId: string;
    let subscription: PushSubscription | null;

    if (personId) {
      subscription = await fetchPersonSubscription(vaultId, personId);
      targetPersonId = personId;
    } else {
      const fallback = await fetchAnySubscription(vaultId);
      if (!fallback) {
        console.log(`No push subscription found for vaultId=${vaultId}, skipping`);
        continue;
      }
      subscription = fallback.subscription;
      targetPersonId = fallback.personId;
    }

    if (!subscription) {
      console.log(`No push subscription for personId=${targetPersonId}, skipping`);
      continue;
    }

    try {
      await sendPushNotification(subscription, {
        title: 'Document ready for review',
        body: `"${suggestedDisplayName}" has been processed and needs your confirmation.`,
        documentId,
        data: { vaultId, documentId },
      });
      console.log(`Push sent for documentId=${documentId} to personId=${targetPersonId}`);
    } catch (err) {
      if (err instanceof PushSubscriptionExpiredError) {
        await clearPushSubscription(vaultId, targetPersonId);
      } else {
        console.error(`Push failed for documentId=${documentId}:`, err);
      }
    }
  }
};
