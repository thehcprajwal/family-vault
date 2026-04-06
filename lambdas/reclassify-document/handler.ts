import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { runClassification } from '../classify-document/handler';
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

  const documentId = event.pathParameters?.id;
  if (!documentId) {
    return respond(400, { error: 'Missing documentId in path' });
  }

  // Fetch document record to get activeVersionId
  const docResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      ProjectionExpression: 'documentId, activeVersionId, #status',
      ExpressionAttributeNames: { '#status': 'status' },
    }),
  );

  if (!docResult.Item) {
    return respond(404, { error: 'Document not found' });
  }

  const doc = unmarshall(docResult.Item) as Pick<DocumentRecord, 'documentId' | 'activeVersionId' | 'status'>;

  if (doc.status === 'DELETED') {
    return respond(410, { error: 'Document has been deleted' });
  }

  const versionId = doc.activeVersionId;
  if (!versionId) {
    return respond(422, { error: 'Document has no active version' });
  }

  // Fetch version record to get stored ocrText
  const verResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}#VER#${versionId}` }),
      ProjectionExpression: 'ocrText, isPoorQuality',
    }),
  );

  if (!verResult.Item) {
    return respond(404, { error: 'Version record not found' });
  }

  const version = unmarshall(verResult.Item) as Pick<VersionRecord, 'ocrText' | 'isPoorQuality'>;

  if (version.isPoorQuality || !version.ocrText) {
    return respond(422, { error: 'Document OCR quality is too poor for classification' });
  }

  const outcome = await runClassification(TABLE_NAME, vaultId, documentId, versionId, version.ocrText);

  if (!outcome) {
    return respond(502, { error: 'Classification failed — Claude returned no result' });
  }

  return respond(200, {
    suggestedDisplayName: outcome.classification.displayName,
    suggestedCategory: outcome.classification.category,
    suggestedSubcategory: outcome.classification.subcategory,
    suggestedExpiryDate: outcome.classification.expiryDate,
    suggestedPersonId: outcome.personId,
    suggestedPersonName: outcome.personName,
    personMatchLayer: outcome.personMatchLayer,
    confidence: outcome.adjustedConfidence,
    reasoning: outcome.classification.reasoning,
  });
};
