import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentRecord, VersionRecord, PersonRecord, CategoryRecord } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const PREVIEW_TTL = 900; // 15 min

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function lookupName(
  tableName: string,
  vaultId: string,
  prefix: string,
  id: string,
  nameField: string,
): Promise<string | null> {
  try {
    const r = await dynamo.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `${prefix}${id}` }),
        ProjectionExpression: nameField,
      }),
    );
    if (!r.Item) return null;
    return (unmarshall(r.Item) as Record<string, string>)[nameField] ?? null;
  } catch {
    return null;
  }
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
    }),
  );

  if (!docResult.Item) return respond(404, { error: 'Document not found' });

  const doc = unmarshall(docResult.Item) as DocumentRecord & { uploadedBy?: string; tags?: string[] };

  if (doc.status === 'DELETED') return respond(404, { error: 'Document not found' });

  let version: (VersionRecord & { uploadedBy?: string }) | null = null;
  if (doc.activeVersionId) {
    const verResult = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `VAULT#${vaultId}`,
          SK: `DOC#${documentId}#VER#${doc.activeVersionId}`,
        }),
      }),
    );
    if (verResult.Item) {
      version = unmarshall(verResult.Item) as VersionRecord & { uploadedBy?: string };
    }
  }

  const [personDisplay, categoryName] = await Promise.all([
    doc.personId ? lookupName(TABLE_NAME, vaultId, 'PERSON#', doc.personId, 'displayName') : Promise.resolve(null),
    doc.categoryId ? lookupName(TABLE_NAME, vaultId, 'CATEGORY#', doc.categoryId, 'name') : Promise.resolve(null),
  ]);

  let previewUrl = '';
  let downloadUrl = '';

  if (version?.s3Key) {
    const [preview, download] = await Promise.all([
      getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: version.s3Key,
          ResponseContentDisposition: 'inline',
        }),
        { expiresIn: PREVIEW_TTL },
      ),
      getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: version.s3Key,
          ResponseContentDisposition: `attachment; filename="${version.originalFilename}"`,
        }),
        { expiresIn: PREVIEW_TTL },
      ),
    ]);
    previewUrl = preview;
    downloadUrl = download;
  }

  return respond(200, {
    documentId: doc.documentId,
    displayName: doc.displayName ?? doc.suggestedDisplayName ?? null,
    personId: doc.personId ?? null,
    personDisplay,
    categoryId: doc.categoryId ?? null,
    categoryName,
    subcategory: doc.subcategory ?? null,
    expiryDate: doc.expiryDate ?? null,
    tags: doc.tags ?? [],
    status: doc.status,
    uploadedAt: doc.createdAt,
    uploadedBy: doc.uploadedBy ?? null,
    fileSizeBytes: version?.fileSizeBytes ?? null,
    mimeType: version?.mimeType ?? null,
    originalFilename: version?.originalFilename ?? null,
    ocrText: version?.ocrText ?? null,
    llmConfidence: version?.llmConfidence ?? null,
    previewUrl,
    downloadUrl,
  });
};
