import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { classifyDocument } from '../shared/claude-client';
import { matchPerson } from '../shared/person-matching';
import type { ClaudeClassification, PersonRecord, CategoryRecord } from '../shared/types';
import type { PushNotificationMessage } from '../push-notification/handler';

// TABLE_NAME and PUSH_NOTIFICATION_SNS_TOPIC_ARN injected by ProcessDocument / TextractComplete
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });

export interface ClassificationOutcome {
  classification: ClaudeClassification;
  personId: string | null;
  personName: string | null;
  personMatchLayer: 'exact' | 'synonym' | 'fuzzy' | null;
  adjustedConfidence: number;
}

async function fetchPersons(tableName: string, vaultId: string): Promise<PersonRecord[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'PERSON#' }),
    }),
  );
  return (result.Items ?? []).map((i) => unmarshall(i) as PersonRecord);
}

async function fetchCategories(tableName: string, vaultId: string): Promise<CategoryRecord[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'CATEGORY#' }),
    }),
  );
  return (result.Items ?? [])
    .map((i) => unmarshall(i) as CategoryRecord & { enabled?: boolean })
    .filter((c) => c.enabled !== false);
}

export async function runClassification(
  tableName: string,
  vaultId: string,
  documentId: string,
  versionId: string,
  ocrText: string,
): Promise<ClassificationOutcome | null> {
  const [persons, categories] = await Promise.all([
    fetchPersons(tableName, vaultId),
    fetchCategories(tableName, vaultId),
  ]);

  const classification = await classifyDocument(ocrText, persons, categories);
  if (!classification) return null;

  const personMatch = matchPerson(classification.personHint, persons);
  const adjustedConfidence = classification.confidence * (personMatch?.confidenceMultiplier ?? 1.0);

  const now = new Date().toISOString();

  // Update Document record with AI suggestions
  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      UpdateExpression: [
        'SET suggestedPersonId = :personId',
        'suggestedCategoryId = :catId',
        'suggestedSubcategory = :sub',
        'suggestedDisplayName = :name',
        'suggestedExpiryDate = :expiry',
        'classificationConfidence = :conf',
        'updatedAt = :now',
      ].join(', '),
      ExpressionAttributeValues: marshall(
        {
          ':personId': personMatch?.personId ?? null,
          ':catId': classification.category ?? null,
          ':sub': classification.subcategory ?? null,
          ':name': classification.displayName,
          ':expiry': classification.expiryDate ?? null,
          ':conf': adjustedConfidence,
          ':now': now,
        },
        { removeUndefinedValues: true },
      ),
    }),
  );

  // Update Version record with raw LLM output and person match metadata
  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}#VER#${versionId}` }),
      UpdateExpression: [
        'SET llmSuggestion = :llmSuggestion',
        'llmConfidence = :llmConfidence',
        'personMatchLayer = :matchLayer',
        'updatedAt = :now',
      ].join(', '),
      ExpressionAttributeValues: marshall(
        {
          ':llmSuggestion': classification,
          ':llmConfidence': adjustedConfidence,
          ':matchLayer': personMatch?.matchLayer ?? null,
          ':now': now,
        },
        { removeUndefinedValues: true },
      ),
    }),
  );

  // Publish push notification event if SNS topic is configured
  const pushTopicArn = process.env.PUSH_NOTIFICATION_SNS_TOPIC_ARN;
  if (pushTopicArn) {
    const message: PushNotificationMessage = {
      vaultId,
      documentId,
      personId: personMatch?.personId ?? null,
      suggestedDisplayName: classification.displayName,
    };
    await sns.send(
      new PublishCommand({
        TopicArn: pushTopicArn,
        Message: JSON.stringify(message),
      }),
    );
  }

  return {
    classification,
    personId: personMatch?.personId ?? null,
    personName: personMatch?.displayName ?? null,
    personMatchLayer: personMatch?.matchLayer ?? null,
    adjustedConfidence,
  };
}
