import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'node:crypto';

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
  const role = claims['custom:role'] as string;

  if (role !== 'owner') return respond(403, { error: 'Owner only' });

  let body: {
    name?: string;
    icon?: string;
    colour?: string;
    subcategories?: string[];
  };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  if (!body.name?.trim()) return respond(400, { error: 'name is required' });

  const categoryId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `VAULT#${vaultId}`,
    SK: `CATEGORY#${categoryId}`,
    categoryId,
    name: body.name.trim(),
    icon: body.icon ?? 'folder',
    colour: body.colour ?? '#6B6B6B',
    subcategories: body.subcategories ?? [],
    enabled: true,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item),
    }),
  );

  return respond(201, item);
};
