import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { PushSubscription } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const vaultId = claims['custom:vaultId'] as string;
  const userId = claims['sub'] as string;

  let body: { subscription: PushSubscription; personId?: string };

  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { subscription, personId } = body;

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return respond(400, {
      error: 'Missing required fields: subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth',
    });
  }

  // Resolve which person record to attach the subscription to.
  // If personId provided, use it; otherwise fall back to the sub (userId == personId in Cognito-linked setup).
  const targetPersonId = personId ?? userId;

  const now = new Date().toISOString();

  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${targetPersonId}` }),
        UpdateExpression:
          'SET pushSubscription = :sub, pushSubscriptionUpdatedAt = :updatedAt, updatedAt = :updatedAt',
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: marshall({
          ':sub': subscription,
          ':updatedAt': now,
        }),
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return respond(404, { error: 'Person record not found' });
    }
    throw err;
  }

  return respond(200, { ok: true });
};
