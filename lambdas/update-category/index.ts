import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

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

  const categoryId = event.pathParameters?.['id'];
  if (!categoryId) return respond(400, { error: 'Missing categoryId' });

  let body: {
    name?: string;
    icon?: string;
    colour?: string;
    subcategories?: string[];
    enabled?: boolean;
  };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const catResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `CATEGORY#${categoryId}` }),
    }),
  );

  if (!catResult.Item) return respond(404, { error: 'Category not found' });

  const cat = unmarshall(catResult.Item) as { isDefault?: boolean; PK: string };
  if (cat.PK !== `VAULT#${vaultId}`) return respond(403, { error: 'Forbidden' });

  const isDefault = cat.isDefault === true;
  const now = new Date().toISOString();
  const setClauses: string[] = ['updatedAt = :now'];
  const exprValues: Record<string, unknown> = { ':now': now };

  if (body.enabled !== undefined) {
    setClauses.push('enabled = :enabled');
    exprValues[':enabled'] = body.enabled;
  }
  if (!isDefault) {
    if (body.name !== undefined) { setClauses.push('#name = :name'); exprValues[':name'] = body.name; }
    if (body.icon !== undefined) { setClauses.push('icon = :icon'); exprValues[':icon'] = body.icon; }
    if (body.colour !== undefined) { setClauses.push('colour = :colour'); exprValues[':colour'] = body.colour; }
    if (body.subcategories !== undefined) { setClauses.push('subcategories = :subcategories'); exprValues[':subcategories'] = body.subcategories; }
  }

  const hasNameClause = setClauses.some(c => c.includes('#name'));

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `CATEGORY#${categoryId}` }),
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: hasNameClause ? { '#name': 'name' } : undefined,
      ExpressionAttributeValues: marshall(exprValues, { removeUndefinedValues: true }),
    }),
  );

  return respond(200, { updated: true });
};
