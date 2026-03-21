import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../shared/ocr-utils';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;
const PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 min

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

  const params = event.queryStringParameters ?? {};
  const mimeType = params['mimeType'];
  const fileExtension = params['fileExtension'];
  const fileSizeBytesRaw = params['fileSizeBytes'];

  if (!mimeType || !fileExtension || !fileSizeBytesRaw) {
    return respond(400, {
      error: 'Missing required query params: mimeType, fileExtension, fileSizeBytes',
    });
  }

  const fileSizeBytes = parseInt(fileSizeBytesRaw, 10);
  if (isNaN(fileSizeBytes) || fileSizeBytes <= 0) {
    return respond(400, { error: 'fileSizeBytes must be a positive integer' });
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return respond(400, {
      error: `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    });
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return respond(400, { error: 'File too large. Maximum size is 20 MB.' });
  }

  const versionId = randomUUID();
  const ext = fileExtension.replace(/^\./, '');
  const s3Key = `${vaultId}/raw/${versionId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: fileSizeBytes,
    Metadata: {
      'vault-id': vaultId,
      'version-id': versionId,
      'mime-type': mimeType,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  });

  return respond(200, { uploadUrl, versionId, s3Key });
};
