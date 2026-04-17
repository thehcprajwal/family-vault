import type { ScheduledEvent } from 'aws-lambda';
import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const PUSH_NOTIFICATION_SNS_TOPIC_ARN = process.env.PUSH_NOTIFICATION_SNS_TOPIC_ARN!;

function todayYYYYMM(): string {
  return new Date().toISOString().slice(0, 7);
}

function addDaysYYYYMM(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 7);
}

export async function handler(_event: ScheduledEvent): Promise<void> {
  const cutoffDate = addDaysYYYYMM(90);

  // Scan for all vault METADATA records
  const scanResult = await dynamo.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: marshall({ ':sk': 'METADATA' }),
    ProjectionExpression: 'PK, vaultId',
  }));

  const vaults = (scanResult.Items ?? []).map((i) => unmarshall(i));

  for (const vault of vaults) {
    const vaultId = vault.vaultId ?? vault.PK?.replace('VAULT#', '');
    if (!vaultId) continue;

    const expiryResult = await dynamo.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'expiry-index',
      KeyConditionExpression: 'PK = :pk AND expiryDate BETWEEN :start AND :end',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':start': todayYYYYMM(),
        ':end': cutoffDate,
      }),
      Select: 'COUNT',
    }));

    const documentCount = expiryResult.Count ?? 0;
    if (documentCount === 0) continue;

    await sns.send(new PublishCommand({
      TopicArn: PUSH_NOTIFICATION_SNS_TOPIC_ARN,
      Message: JSON.stringify({
        vaultId,
        title: 'Documents expiring soon',
        body: `${documentCount} document${documentCount === 1 ? '' : 's'} need${documentCount === 1 ? 's' : ''} attention`,
        documentCount,
      }),
    }));

    console.log(`Notified vaultId=${vaultId} documentCount=${documentCount}`);
  }
}
