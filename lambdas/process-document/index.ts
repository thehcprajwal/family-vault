import type { S3Handler } from 'aws-lambda';
import {
  TextractClient,
  DetectDocumentTextCommand,
  StartDocumentTextDetectionCommand,
} from '@aws-sdk/client-textract';
import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { extractTextFromBlocks } from '../shared/ocr-utils';
import { runClassification } from '../classify-document/handler';

const textract = new TextractClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const SNS_TOPIC_ARN = process.env.TEXTRACT_SNS_TOPIC_ARN!;
const TEXTRACT_ROLE_ARN = process.env.TEXTRACT_ROLE_ARN!;

// s3Key format: {vaultId}/raw/{versionId}.{ext}
function parseS3Key(s3Key: string): { vaultId: string; versionId: string; ext: string } | null {
  const parts = s3Key.split('/');
  if (parts.length < 3 || parts[1] !== 'raw') return null;
  const vaultId = parts[0];
  const filename = parts[2];
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx === -1) return null;
  return {
    vaultId,
    versionId: filename.substring(0, dotIdx),
    ext: filename.substring(dotIdx + 1),
  };
}

async function findDocumentId(vaultId: string, versionId: string): Promise<string | null> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'versionId = :verId',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': 'DOC#',
        ':verId': versionId,
      }),
      Limit: 1,
    }),
  );
  if (!result.Items?.length) return null;
  const item = unmarshall(result.Items[0]);
  const match = (item['SK'] as string)?.match(/^DOC#([^#]+)#VER#/);
  return match?.[1] ?? null;
}

async function updateVersionAwaitingConfirmation(
  vaultId: string,
  documentId: string,
  versionId: string,
  ocrText: string,
  isPoorQuality: boolean,
): Promise<void> {
  const SK = `DOC#${documentId}#VER#${versionId}`;
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK }),
      UpdateExpression:
        'SET #status = :status, ocrText = :ocrText, isPoorQuality = :isPoorQuality, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({
        ':status': 'AWAITING_CONFIRMATION',
        ':ocrText': ocrText,
        ':isPoorQuality': isPoorQuality,
        ':updatedAt': new Date().toISOString(),
      }),
    }),
  );
}

async function updateVersionFailed(
  vaultId: string,
  documentId: string,
  versionId: string,
  errorMessage: string,
): Promise<void> {
  const SK = `DOC#${documentId}#VER#${versionId}`;
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK }),
      UpdateExpression: 'SET #status = :status, errorMessage = :error, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({
        ':status': 'FAILED',
        ':error': errorMessage,
        ':updatedAt': new Date().toISOString(),
      }),
    }),
  );
}

async function processImageSync(
  vaultId: string,
  documentId: string,
  versionId: string,
  s3Key: string,
): Promise<void> {
  console.log(`Running sync Textract on image: ${s3Key}`);

  const result = await textract.send(
    new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: BUCKET_NAME, Name: s3Key } },
    }),
  );

  const { text, isPoorQuality } = extractTextFromBlocks(result.Blocks ?? []);
  const ocrText = isPoorQuality ? '' : text.slice(0, 1500);

  await updateVersionAwaitingConfirmation(vaultId, documentId, versionId, ocrText, isPoorQuality);

  if (!isPoorQuality && ocrText) {
    await runClassification(TABLE_NAME, vaultId, documentId, versionId, ocrText);
  }
}

async function processPdfAsync(
  vaultId: string,
  documentId: string,
  versionId: string,
  s3Key: string,
): Promise<void> {
  console.log(`Starting async Textract for PDF: ${s3Key}`);
  const jobTag = `${vaultId}|${documentId}|${versionId}`;
  await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: BUCKET_NAME, Name: s3Key } },
      NotificationChannel: { SNSTopicArn: SNS_TOPIC_ARN, RoleArn: TEXTRACT_ROLE_ARN },
      JobTag: jobTag,
    }),
  );
  console.log(`Async Textract job started, jobTag: ${jobTag}`);
}

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const parsed = parseS3Key(s3Key);
    if (!parsed) { console.error(`Cannot parse s3Key: ${s3Key}`); continue; }

    const { vaultId, versionId, ext } = parsed;
    const documentId = await findDocumentId(vaultId, versionId);
    if (!documentId) {
      console.error(`Version record not found: vaultId=${vaultId}, versionId=${versionId}`);
      continue;
    }

    try {
      if (ext.toLowerCase() === 'pdf') {
        await processPdfAsync(vaultId, documentId, versionId, s3Key);
      } else {
        await processImageSync(vaultId, documentId, versionId, s3Key);
      }
    } catch (err) {
      console.error(`Error processing ${s3Key}:`, err);
      await updateVersionFailed(vaultId, documentId, versionId, String(err));
    }
  }
};
