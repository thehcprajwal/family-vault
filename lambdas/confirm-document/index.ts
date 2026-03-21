import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
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

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const vaultId = claims['custom:vaultId'] as string;

  const documentId = event.pathParameters?.['documentId'];
  if (!documentId) return respond(400, { error: 'Missing documentId path parameter' });

  let body: {
    personId?: string | null;
    categoryId?: string | null;
    subcategory?: string | null;
    displayName?: string;
    expiryDate?: string | null;
    activeVersionId?: string;
  };

  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  // Fetch current document to verify ownership and get active version
  const getResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
    }),
  );

  if (!getResult.Item) {
    return respond(404, { error: 'Document not found' });
  }

  const doc = unmarshall(getResult.Item) as DocumentRecord;

  if (doc.status === 'CONFIRMED') {
    return respond(409, { error: 'Document is already confirmed' });
  }

  if (doc.status === 'DELETED') {
    return respond(410, { error: 'Document has been deleted' });
  }

  const now = new Date().toISOString();
  const personId = body.personId ?? doc.suggestedPersonId ?? null;
  const categoryId = body.categoryId ?? doc.suggestedCategoryId ?? null;
  const subcategory = body.subcategory ?? doc.suggestedSubcategory ?? null;
  const displayName = body.displayName ?? doc.suggestedDisplayName ?? doc.displayName;
  const expiryDate = body.expiryDate ?? null;
  const activeVersionId = body.activeVersionId ?? doc.activeVersionId;

  // Build GSI SK attributes
  const statusSK = `STATUS#CONFIRMED#${documentId}`;
  const personSK = personId ? `PERSON#${personId}#${documentId}` : undefined;
  const categorySK = categoryId ? `CATEGORY#${categoryId}#${documentId}` : undefined;

  // Update document record
  const updateExpr = [
    '#status = :status',
    'statusSK = :statusSK',
    'personId = :personId',
    'categoryId = :categoryId',
    'subcategory = :subcategory',
    'displayName = :displayName',
    'expiryDate = :expiryDate',
    'updatedAt = :now',
    ...(personSK ? ['personSK = :personSK'] : []),
    ...(categorySK ? ['categorySK = :categorySK'] : []),
  ];

  const exprValues: Record<string, unknown> = {
    ':status': 'CONFIRMED',
    ':statusSK': statusSK,
    ':personId': personId,
    ':categoryId': categoryId,
    ':subcategory': subcategory,
    ':displayName': displayName,
    ':expiryDate': expiryDate,
    ':now': now,
    ...(personSK ? { ':personSK': personSK } : {}),
    ...(categorySK ? { ':categorySK': categorySK } : {}),
  };

  const transactItems: Parameters<typeof TransactWriteItemsCommand.prototype['input']['TransactItems']>[0][] = [
    {
      Update: {
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
        UpdateExpression: `SET ${updateExpr.join(', ')}`,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: marshall(exprValues, { removeUndefinedValues: true }),
      },
    },
  ];

  // Also confirm the active version if we know it
  if (activeVersionId) {
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}#VER#${activeVersionId}` }),
        UpdateExpression: 'SET #status = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: marshall({ ':status': 'CONFIRMED', ':now': now }),
      },
    });
  }

  await dynamo.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));

  return respond(200, {
    documentId,
    status: 'CONFIRMED',
    personId,
    categoryId,
    subcategory,
    displayName,
    expiryDate,
  });
};
