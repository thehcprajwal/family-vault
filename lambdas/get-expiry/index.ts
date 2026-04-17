import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function todayYYYYMM(): string {
  return new Date().toISOString().slice(0, 7);
}

function addDaysYYYYMM(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 7);
}

function daysLeft(expiryDate: string): number {
  const now = new Date();
  const exp = new Date(`${expiryDate}-01`);
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function getPresignedUrl(s3Key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }), { expiresIn: 900 });
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const claims = event.requestContext.authorizer.jwt.claims;
  const vaultId = String(claims['custom:vaultId']);

  const withinDaysParam = event.queryStringParameters?.['withinDays'];
  const withinDays = withinDaysParam ? parseInt(withinDaysParam, 10) : 90;

  if (withinDays > 365) {
    return respond(400, { error: 'WITHIN_DAYS_TOO_LARGE' });
  }

  const cutoffDate = addDaysYYYYMM(withinDays);
  const today = todayYYYYMM();

  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'expiry-index',
    KeyConditionExpression: 'PK = :pk AND expiryDate BETWEEN :start AND :end',
    ExpressionAttributeValues: marshall({
      ':pk': `VAULT#${vaultId}`,
      ':start': '0000-00',
      ':end': cutoffDate,
    }),
  }));

  const items = (result.Items ?? []).map((i) => unmarshall(i));

  // Fetch persons and categories for display names
  const personIds = [...new Set(items.map((i) => i.personId).filter(Boolean))] as string[];
  const categoryIds = [...new Set(items.map((i) => i.categoryId).filter(Boolean))] as string[];

  const [personMap, categoryMap] = await Promise.all([
    fetchDisplayMap(vaultId, personIds, 'PERSON'),
    fetchDisplayMap(vaultId, categoryIds, 'CATEGORY'),
  ]);

  const expired: unknown[] = [];
  const expiringThisMonth: unknown[] = [];
  const expiringUpcoming: unknown[] = [];

  let total = 0;
  for (const item of items.sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))) {
    if (total >= 50) break;
    const activeVersionId: string | undefined = item.activeVersionId;
    let previewUrl = '';
    if (activeVersionId && item.documentId) {
      const verResult = await dynamo.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${item.documentId}#VER#${activeVersionId}` }),
      }));
      const ver = verResult.Item ? unmarshall(verResult.Item) : null;
      if (ver?.s3Key) {
        previewUrl = await getPresignedUrl(ver.s3Key);
      }
    }

    const card = {
      documentId: item.documentId,
      displayName: item.displayName ?? item.suggestedDisplayName ?? 'Untitled',
      personDisplay: item.personId ? (personMap[item.personId] ?? null) : null,
      personId: item.personId ?? null,
      categoryName: item.categoryId ? (categoryMap[item.categoryId] ?? item.categoryId) : null,
      categoryId: item.categoryId ?? null,
      subcategory: item.subcategory ?? null,
      expiryDate: item.expiryDate,
      daysLeft: daysLeft(item.expiryDate),
      previewUrl,
    };

    if (item.expiryDate < today) {
      expired.push(card);
    } else if (item.expiryDate === today) {
      expiringThisMonth.push(card);
    } else {
      expiringUpcoming.push(card);
    }
    total++;
  }

  return respond(200, { expired, expiringThisMonth, expiringUpcoming });
}

async function fetchDisplayMap(vaultId: string, ids: string[], type: 'PERSON' | 'CATEGORY'): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const id of ids) {
    const r = await dynamo.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `${type}#${id}` }),
    }));
    if (r.Item) {
      const item = unmarshall(r.Item);
      map[id] = type === 'PERSON' ? (item.displayName ?? id) : (item.name ?? id);
    }
  }
  return map;
}
