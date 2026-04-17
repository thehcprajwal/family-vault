import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { VersionRecord } from '../shared/types';

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

  const documentId = event.pathParameters?.['id'];
  if (!documentId) return respond(400, { error: 'Missing documentId' });

  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': `DOC#${documentId}#VER#`,
      }),
    }),
  );

  const versions = (result.Items ?? [])
    .map((item) => unmarshall(item) as VersionRecord & { uploadedBy?: string; activeVersionId?: string })
    .filter((v) => v.status !== 'DELETED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((v) => ({
      versionId: v.versionId,
      status: v.status,
      originalFilename: v.originalFilename,
      fileSizeBytes: v.fileSizeBytes,
      uploadedAt: v.createdAt,
      uploadedBy: v.uploadedBy ?? null,
      isActive: false, // resolved below
    }));

  return respond(200, { versions });
};
