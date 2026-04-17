import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import Anthropic from '@anthropic-ai/sdk';
import { buildSearchPrompt } from '../shared/search-prompt';
import { matchPerson } from '../shared/person-matching';
import type { PersonRecord, CategoryRecord, DocumentRecord, VersionRecord } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const PREVIEW_TTL = 900;
const MAX_RESULTS = 20;

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

interface SearchSlots {
  person: string | null;
  category: string | null;
  subcategory: string | null;
  keywords: string[];
}

async function extractSlots(
  query: string,
  persons: PersonRecord[],
  categories: CategoryRecord[],
): Promise<SearchSlots | null> {
  try {
    const { system, user } = buildSearchPrompt(query, persons, categories);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return JSON.parse(text) as SearchSlots;
  } catch {
    return null;
  }
}

function extractOcrSnippet(ocrText: string | undefined, keywords: string[]): string | null {
  if (!ocrText || keywords.length === 0) return null;
  const lower = ocrText.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(ocrText.length, idx + kw.length + 60);
      return (start > 0 ? '…' : '') + ocrText.slice(start, end) + (end < ocrText.length ? '…' : '');
    }
  }
  return null;
}

async function generatePreviewUrl(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key, ResponseContentDisposition: 'inline' }),
    { expiresIn: PREVIEW_TTL },
  );
}

async function fetchVersionS3Key(
  vaultId: string,
  documentId: string,
  versionId: string,
): Promise<{ s3Key: string; ocrText?: string } | null> {
  try {
    const r = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}#VER#${versionId}` }),
        ProjectionExpression: 's3Key, ocrText',
      }),
    );
    if (!r.Item) return null;
    return unmarshall(r.Item) as { s3Key: string; ocrText?: string };
  } catch {
    return null;
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const vaultId = claims['custom:vaultId'] as string;

  let body: { query?: string };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  if (!body.query?.trim()) return respond(400, { error: 'QUERY_REQUIRED' });

  const query = body.query.trim();

  // Fetch persons and categories
  const [personsRes, categoriesRes] = await Promise.all([
    dynamo.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'PERSON#' }),
    })),
    dynamo.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': 'CATEGORY#' }),
    })),
  ]);

  const persons = (personsRes.Items ?? []).map((i) => unmarshall(i) as PersonRecord);
  const categories = (categoriesRes.Items ?? []).map((i) => unmarshall(i) as CategoryRecord);

  // Claude slot extraction (fail gracefully)
  const slots = await extractSlots(query, persons, categories);
  let fallbackTextSearch = false;

  const extractedSlots = {
    person: slots?.person ?? null,
    category: slots?.category ?? null,
    subcategory: slots?.subcategory ?? null,
  };

  let docItems: DocumentRecord[] = [];

  if (slots) {
    const personMatch = slots.person ? matchPerson(slots.person, persons) : null;
    const personId = personMatch?.personId ?? null;

    const categoryRecord = slots.category
      ? categories.find((c) => c.name.toLowerCase() === slots.category!.toLowerCase())
      : null;
    const categoryId = categoryRecord?.categoryId ?? null;

    if (personId && categoryId) {
      // Both resolved: query person-index and intersect
      const [personDocs, catDocs] = await Promise.all([
        dynamo.send(new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'person-index',
          KeyConditionExpression: 'PK = :pk AND begins_with(personSK, :prefix)',
          ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': `PERSON#${personId}#` }),
          FilterExpression: '#status = :confirmed',
          ExpressionAttributeNames: { '#status': 'status' },
          Limit: 50,
        })),
        dynamo.send(new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'category-index',
          KeyConditionExpression: 'PK = :pk AND begins_with(categorySK, :prefix)',
          ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': `CATEGORY#${categoryId}#` }),
          FilterExpression: '#status = :confirmed',
          ExpressionAttributeNames: { '#status': 'status' },
          Limit: 50,
        })),
      ]);
      const personDocIds = new Set(
        (personDocs.Items ?? []).map((i) => (unmarshall(i) as DocumentRecord).documentId),
      );
      docItems = (catDocs.Items ?? [])
        .map((i) => unmarshall(i) as DocumentRecord)
        .filter((d) => personDocIds.has(d.documentId));
    } else if (personId) {
      const res = await dynamo.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'person-index',
        KeyConditionExpression: 'PK = :pk AND begins_with(personSK, :prefix)',
        ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': `PERSON#${personId}#` }),
        FilterExpression: '#status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        Limit: MAX_RESULTS,
      }));
      docItems = (res.Items ?? []).map((i) => unmarshall(i) as DocumentRecord);
    } else if (categoryId) {
      const res = await dynamo.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'category-index',
        KeyConditionExpression: 'PK = :pk AND begins_with(categorySK, :prefix)',
        ExpressionAttributeValues: marshall({ ':pk': `VAULT#${vaultId}`, ':prefix': `CATEGORY#${categoryId}#` }),
        FilterExpression: '#status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        Limit: MAX_RESULTS,
      }));
      docItems = (res.Items ?? []).map((i) => unmarshall(i) as DocumentRecord);
    }
  }

  // Fallback: keyword text scan
  if (docItems.length === 0 && slots && slots.keywords.length > 0) {
    fallbackTextSearch = true;
    const keyword = slots.keywords[0]!;
    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'PK = :pk AND begins_with(SK, :prefix) AND contains(ocrText, :kw)',
        ExpressionAttributeValues: marshall({
          ':pk': `VAULT#${vaultId}`,
          ':prefix': 'DOC#',
          ':kw': keyword,
        }),
        Limit: MAX_RESULTS,
      }),
    );
    docItems = (res.Items ?? []).map((i) => unmarshall(i) as DocumentRecord).filter(
      (d) => d.status === 'CONFIRMED',
    );
  }

  // Build results with presigned URLs
  const personMap = new Map(persons.map((p) => [p.personId, p.displayName]));
  const categoryMap = new Map(categories.map((c) => [c.categoryId, c.name]));
  const keywords = slots?.keywords ?? [query];

  const results = await Promise.all(
    docItems.slice(0, MAX_RESULTS).map(async (doc) => {
      let previewUrl = '';
      let ocrSnippet: string | null = null;

      if (doc.activeVersionId) {
        const versionData = await fetchVersionS3Key(vaultId, doc.documentId, doc.activeVersionId);
        if (versionData?.s3Key) {
          previewUrl = await generatePreviewUrl(versionData.s3Key);
          ocrSnippet = extractOcrSnippet(versionData.ocrText, keywords);
        }
      }

      return {
        documentId: doc.documentId,
        displayName: doc.displayName ?? doc.suggestedDisplayName ?? 'Untitled',
        personDisplay: doc.personId ? (personMap.get(doc.personId) ?? null) : null,
        categoryName: doc.categoryId ? (categoryMap.get(doc.categoryId) ?? null) : null,
        subcategory: doc.subcategory ?? null,
        uploadedAt: doc.createdAt,
        previewUrl,
        ocrSnippet,
        matchKeyword: keywords[0] ?? null,
      };
    }),
  );

  return respond(200, {
    results,
    extractedSlots,
    fallbackTextSearch,
    resultCount: results.length,
  });
};
