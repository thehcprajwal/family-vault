import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
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
  const cognitoSub = claims['sub'] as string;
  const role = claims['custom:role'] as string;

  const documentId = event.pathParameters?.['id'];
  if (!documentId) return respond(400, { error: 'Missing documentId' });

  let body: {
    displayName?: string;
    tags?: string[];
    expiryDate?: string | null;
    subcategory?: string | null;
  };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  // Fetch document to verify ownership
  const docResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      ProjectionExpression: '#status, uploadedBy',
      ExpressionAttributeNames: { '#status': 'status' },
    }),
  );

  if (!docResult.Item) return respond(404, { error: 'Document not found' });

  const doc = unmarshall(docResult.Item) as Pick<DocumentRecord, 'status'> & { uploadedBy?: string };

  if (doc.status === 'DELETED') return respond(404, { error: 'Document not found' });
  if (role !== 'owner' && doc.uploadedBy !== cognitoSub) {
    return respond(403, { error: 'Not authorised to edit this document' });
  }

  const now = new Date().toISOString();
  const setClauses: string[] = ['updatedAt = :now'];
  const exprValues: Record<string, unknown> = { ':now': now };

  if (body.displayName !== undefined) {
    setClauses.push('displayName = :displayName');
    exprValues[':displayName'] = body.displayName;
  }
  if (body.tags !== undefined) {
    setClauses.push('tags = :tags');
    exprValues[':tags'] = body.tags;
  }
  if (body.expiryDate !== undefined) {
    if (body.expiryDate === null) {
      setClauses.push('expiryDate = :expiryDate');
      exprValues[':expiryDate'] = null;
    } else {
      setClauses.push('expiryDate = :expiryDate');
      exprValues[':expiryDate'] = body.expiryDate;
    }
  }
  if (body.subcategory !== undefined) {
    setClauses.push('subcategory = :subcategory');
    exprValues[':subcategory'] = body.subcategory;
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeValues: marshall(exprValues, { removeUndefinedValues: true }),
    }),
  );

  return respond(200, { updated: true });
};
