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

  const personId = event.pathParameters?.['id'];
  if (!personId) return respond(400, { error: 'Missing personId' });

  let body: {
    displayName?: string;
    relationship?: string;
    avatarColour?: string;
  };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const personResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
      ProjectionExpression: 'personId',
    }),
  );

  if (!personResult.Item) return respond(404, { error: 'Person not found' });

  const now = new Date().toISOString();
  const setClauses: string[] = ['updatedAt = :now'];
  const exprValues: Record<string, unknown> = { ':now': now };

  if (body.displayName !== undefined) { setClauses.push('displayName = :displayName'); exprValues[':displayName'] = body.displayName; }
  if (body.relationship !== undefined) { setClauses.push('relationship = :relationship'); exprValues[':relationship'] = body.relationship; }
  if (body.avatarColour !== undefined) { setClauses.push('avatarColour = :avatarColour'); exprValues[':avatarColour'] = body.avatarColour; }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: marshall(exprValues),
    }),
  );

  return respond(200, { updated: true });
};
