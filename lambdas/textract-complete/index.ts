import type { SNSHandler } from 'aws-lambda';
import {
  TextractClient,
  GetDocumentTextDetectionCommand,
  type Block,
} from '@aws-sdk/client-textract';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { extractTextFromBlocks } from '../shared/ocr-utils';
import { runClassification } from '../classify-document/handler';

const textract = new TextractClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;

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

async function fetchAllTextractBlocks(jobId: string): Promise<Block[]> {
  const blocks: Block[] = [];
  let nextToken: string | undefined;

  do {
    const result = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken }),
    );
    blocks.push(...(result.Blocks ?? []));
    nextToken = result.NextToken;
  } while (nextToken);

  return blocks;
}

export const handler: SNSHandler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message) as {
      JobId: string;
      Status: string;
      JobTag: string;
    };

    // JobTag format: {vaultId}|{documentId}|{versionId}
    const [vaultId, documentId, versionId] = (message.JobTag ?? '').split('|');

    if (!vaultId || !documentId || !versionId) {
      console.error(`Invalid JobTag format: ${message.JobTag}`);
      continue;
    }

    if (message.Status !== 'SUCCEEDED') {
      console.error(`Textract job failed: ${message.JobId}, status: ${message.Status}`);
      await updateVersionFailed(vaultId, documentId, versionId, `Textract job status: ${message.Status}`);
      continue;
    }

    try {
      const blocks = await fetchAllTextractBlocks(message.JobId);
      const { text, isPoorQuality } = extractTextFromBlocks(blocks);
      const ocrText = isPoorQuality ? '' : text.slice(0, 1500);

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

      console.log(`TextractComplete: vaultId=${vaultId}, documentId=${documentId}, versionId=${versionId}, isPoorQuality=${isPoorQuality}`);

      if (!isPoorQuality && ocrText) {
        await runClassification(TABLE_NAME, vaultId, documentId, versionId, ocrText);
      }
    } catch (err) {
      console.error(`Error processing Textract result for jobId=${message.JobId}:`, err);
      await updateVersionFailed(vaultId, documentId, versionId, String(err));
    }
  }
};
