import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
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

  const result = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: 'METADATA' }),
    }),
  );

  if (!result.Item) {
    return respond(404, { error: 'VAULT_NOT_FOUND' });
  }

  const record = unmarshall(result.Item) as {
    vaultId: string;
    ownerSub: string;
    onboardingComplete?: boolean;
    createdAt: string;
  };

  return respond(200, {
    vaultId: record.vaultId,
    ownerSub: record.ownerSub,
    onboardingComplete: record.onboardingComplete ?? false,
    createdAt: record.createdAt,
  });
};
