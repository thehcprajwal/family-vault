import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentRecord } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function encodeDocumentForResponse(doc: DocumentRecord) {
  return {
    documentId: doc.documentId,
    displayName: doc.displayName ?? doc.suggestedDisplayName ?? null,
    personId: doc.personId ?? null,
    categoryId: doc.categoryId ?? null,
    subcategory: doc.subcategory ?? null,
    status: doc.status,
    expiryDate: doc.expiryDate ?? null,
    mimeType: (doc as Record<string, unknown>)['mimeType'] as string ?? null,
    fileSizeBytes: (doc as Record<string, unknown>)['fileSizeBytes'] as number ?? null,
    uploadedAt: doc.createdAt,
    uploadedBy: (doc as Record<string, unknown>)['uploadedBy'] as string ?? null,
    llmConfidence: doc.classificationConfidence ?? null,
    suggestedDisplayName: doc.suggestedDisplayName ?? null,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const vaultId = claims['custom:vaultId'] as string;

  const qs = event.queryStringParameters ?? {};
  const status = qs['status'] as 'PENDING' | 'CONFIRMED' | undefined;
  const personId = qs['personId'];
  const categoryId = qs['categoryId'];
  const cursor = qs['cursor'];
  const limitRaw = qs['limit'] ? parseInt(qs['limit'], 10) : 20;

  if (limitRaw > 50) {
    return respond(400, { error: 'LIMIT_TOO_HIGH' });
  }
  const limit = Math.min(Math.max(1, limitRaw), 50);

  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>;
    } catch {
      return respond(400, { error: 'INVALID_CURSOR' });
    }
  }

  let queryInput: QueryCommandInput;

  if (status === 'PENDING') {
    queryInput = {
      TableName: TABLE_NAME,
      IndexName: 'status-index',
      KeyConditionExpression: 'PK = :pk AND begins_with(statusSK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': 'STATUS#PENDING#',
      }),
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: marshall(exclusiveStartKey) } : {}),
    };
  } else if (status === 'CONFIRMED' && personId) {
    queryInput = {
      TableName: TABLE_NAME,
      IndexName: 'person-index',
      KeyConditionExpression: 'PK = :pk AND begins_with(personSK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': `PERSON#${personId}#`,
      }),
      FilterExpression: '#status = :confirmed',
      ExpressionAttributeNames: { '#status': 'status' },
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: marshall(exclusiveStartKey) } : {}),
    };
  } else if (status === 'CONFIRMED' && categoryId) {
    queryInput = {
      TableName: TABLE_NAME,
      IndexName: 'category-index',
      KeyConditionExpression: 'PK = :pk AND begins_with(categorySK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': `CATEGORY#${categoryId}#`,
      }),
      FilterExpression: '#status = :confirmed',
      ExpressionAttributeNames: { '#status': 'status' },
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: marshall(exclusiveStartKey) } : {}),
    };
  } else {
    // All confirmed (or no filter) — main table scan with filter
    queryInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': 'DOC#',
        ...(status === 'CONFIRMED' ? { ':status': 'CONFIRMED' } : {}),
      }),
      ...(status === 'CONFIRMED'
        ? {
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
          }
        : {}),
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: marshall(exclusiveStartKey) } : {}),
    };
  }

  const result = await dynamo.send(new QueryCommand(queryInput));

  const documents = (result.Items ?? [])
    .map((item) => unmarshall(item) as DocumentRecord)
    .filter((doc) => doc.status !== 'DELETED')
    .map(encodeDocumentForResponse);

  let nextCursor: string | null = null;
  if (result.LastEvaluatedKey) {
    nextCursor = Buffer.from(JSON.stringify(unmarshall(result.LastEvaluatedKey))).toString('base64');
  }

  return respond(200, { documents, nextCursor });
};
