import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'node:crypto';
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

  let body: {
    versionId: string;
    s3Key: string;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename: string;
  };

  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { versionId, s3Key, mimeType, fileSizeBytes, originalFilename } = body;

  if (!versionId || !s3Key || !mimeType || !fileSizeBytes || !originalFilename) {
    return respond(400, {
      error: 'Missing required fields: versionId, s3Key, mimeType, fileSizeBytes, originalFilename',
    });
  }

  // Security: s3Key must belong to this vault
  if (!s3Key.startsWith(`${vaultId}/`)) {
    return respond(403, { error: 'Invalid s3Key: does not belong to this vault' });
  }

  const documentId = randomUUID();
  const now = new Date().toISOString();

  const documentRecord: DocumentRecord = {
    PK: `VAULT#${vaultId}`,
    SK: `DOC#${documentId}`,
    documentId,
    personId: null,
    categoryId: null,
    subcategory: null,
    displayName: originalFilename,
    status: 'PENDING',
    statusSK: `STATUS#PENDING#${documentId}`,
    createdAt: now,
    updatedAt: now,
  };

  const versionRecord: VersionRecord = {
    PK: `VAULT#${vaultId}`,
    SK: `DOC#${documentId}#VER#${versionId}`,
    documentId,
    versionId,
    status: 'PROCESSING',
    s3Key,
    mimeType,
    fileSizeBytes,
    originalFilename,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: marshall(documentRecord, { removeUndefinedValues: true }),
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: marshall(versionRecord, { removeUndefinedValues: true }),
          },
        },
      ],
    }),
  );

  return respond(201, { documentId, versionId });
};
