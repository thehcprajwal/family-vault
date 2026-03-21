import type { SNSHandler } from 'aws-lambda';
import {
  TextractClient,
  GetDocumentTextDetectionCommand,
  type Block,
} from '@aws-sdk/client-textract';
import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { extractTextFromBlocks } from '../shared/ocr-utils';
import { classifyDocument } from '../shared/claude-client';
import { matchPerson } from '../shared/person-matching';
import type { PersonRecord, CategoryRecord } from '../shared/types';

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

async function fetchPersons(vaultId: string): Promise<PersonRecord[]> {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'PERSON#' }),
  }));
  return (result.Items ?? []).map((i) => unmarshall(i) as PersonRecord);
}

async function fetchCategories(vaultId: string): Promise<CategoryRecord[]> {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'CATEGORY#' }),
  }));
  return (result.Items ?? []).map((i) => unmarshall(i) as CategoryRecord);
}

async function runClassificationAndUpdateDocument(
  vaultId: string,
  documentId: string,
  ocrText: string,
): Promise<void> {
  const [persons, categories] = await Promise.all([fetchPersons(vaultId), fetchCategories(vaultId)]);
  const classification = await classifyDocument(ocrText, persons, categories);
  if (!classification) return;

  const personMatch = matchPerson(classification.personHint, persons);
  const adjustedConfidence = classification.confidence * (personMatch?.confidence ?? 1.0);

  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
    UpdateExpression: 'SET suggestedPersonId = :personId, suggestedCategoryId = :catId, suggestedSubcategory = :sub, suggestedDisplayName = :name, classificationConfidence = :conf, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':personId': personMatch?.personId ?? null,
      ':catId': classification.category ?? null,
      ':sub': classification.subcategory ?? null,
      ':name': classification.displayName,
      ':conf': adjustedConfidence,
      ':now': new Date().toISOString(),
    }, { removeUndefinedValues: true }),
  }));
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
      await updateVersionFailed(
        vaultId,
        documentId,
        versionId,
        `Textract job status: ${message.Status}`,
      );
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
        await runClassificationAndUpdateDocument(vaultId, documentId, ocrText);
      }
    } catch (err) {
      console.error(`Error processing Textract result for jobId=${message.JobId}:`, err);
      await updateVersionFailed(vaultId, documentId, versionId, String(err));
    }
  }
};
