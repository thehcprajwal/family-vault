import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentRecord, VersionRecord } from '../shared/types';

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

  const docResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      ProjectionExpression: 'documentId, activeVersionId, #status',
      ExpressionAttributeNames: { '#status': 'status' },
    }),
  );

  if (!docResult.Item) return respond(404, { error: 'Document not found' });

  const doc = unmarshall(docResult.Item) as Pick<
    DocumentRecord,
    'documentId' | 'activeVersionId' | 'status'
  >;

  if (!doc.activeVersionId) {
    return respond(200, { documentId, documentStatus: doc.status, versionStatus: 'PROCESSING' });
  }

  const verResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `VAULT#${vaultId}`,
        SK: `DOC#${documentId}#VER#${doc.activeVersionId}`,
      }),
      ProjectionExpression: '#status, errorMessage',
      ExpressionAttributeNames: { '#status': 'status' },
    }),
  );

  const versionStatus = verResult.Item
    ? (unmarshall(verResult.Item) as Pick<VersionRecord, 'status' | 'errorMessage'>).status
    : 'PROCESSING';

  return respond(200, {
    documentId,
    documentStatus: doc.status,
    versionStatus,
  });
};
