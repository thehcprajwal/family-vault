import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentRecord, VersionRecord } from '../shared/types';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const DELETE_OBJECT_TOPIC_ARN = process.env.DELETE_OBJECT_TOPIC_ARN!;

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
  if (!documentId) return respond(400, { error: 'Missing documentId path parameter' });

  // Fetch document
  const docResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
    }),
  );

  if (!docResult.Item) return respond(404, { error: 'Document not found' });

  const doc = unmarshall(docResult.Item) as DocumentRecord & { uploadedBy?: string };

  if (doc.status === 'DELETED') return respond(404, { error: 'Document not found' });

  // Authorisation: owner OR original uploader
  if (role !== 'owner' && doc.uploadedBy !== cognitoSub) {
    return respond(403, { error: 'Not authorised to delete this document' });
  }

  const now = new Date().toISOString();

  // Soft-delete the document record
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${documentId}` }),
      UpdateExpression: 'SET #status = :deleted, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({ ':deleted': 'DELETED', ':now': now }),
    }),
  );

  // Soft-delete the active version if known
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
      const version = unmarshall(verResult.Item) as VersionRecord;

      await dynamo.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: marshall({
            PK: `VAULT#${vaultId}`,
            SK: `DOC#${documentId}#VER#${doc.activeVersionId}`,
          }),
          UpdateExpression: 'SET #status = :deleted, updatedAt = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: marshall({ ':deleted': 'DELETED', ':now': now }),
        }),
      );

      // Publish s3Key to async deletion topic
      if (version.s3Key) {
        await sns.send(
          new PublishCommand({
            TopicArn: DELETE_OBJECT_TOPIC_ARN,
            Message: JSON.stringify({ s3Key: version.s3Key, bucket: BUCKET_NAME }),
          }),
        );
      }
    }
  }

  return respond(200, { deleted: true });
};
