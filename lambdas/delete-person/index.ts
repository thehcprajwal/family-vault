import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { DocumentRecord } from '../shared/types';

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
  const cognitoSub = claims['sub'] as string;
  const role = claims['custom:role'] as string;

  if (role !== 'owner') return respond(403, { error: 'Owner only' });

  const personId = event.pathParameters?.['id'];
  if (!personId) return respond(400, { error: 'Missing personId' });

  const personResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
      ProjectionExpression: 'personId, cognitoSub',
    }),
  );

  if (!personResult.Item) return respond(404, { error: 'Person not found' });

  const person = unmarshall(personResult.Item) as { personId: string; cognitoSub?: string };

  // Cannot delete self
  if (person.cognitoSub === cognitoSub) {
    return respond(400, { error: 'Cannot delete yourself' });
  }

  // Unlink all documents belonging to this person
  const docsResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'person-index',
      KeyConditionExpression: 'PK = :pk AND begins_with(personSK, :prefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `VAULT#${vaultId}`,
        ':prefix': `PERSON#${personId}#`,
      }),
      ProjectionExpression: 'documentId',
    }),
  );

  const unlinkPromises = (docsResult.Items ?? []).map((item) => {
    const doc = unmarshall(item) as Pick<DocumentRecord, 'documentId'>;
    return dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `VAULT#${vaultId}`, SK: `DOC#${doc.documentId}` }),
        UpdateExpression: 'REMOVE personId, personSK SET updatedAt = :now',
        ExpressionAttributeValues: marshall({ ':now': new Date().toISOString() }),
      }),
    );
  });

  await Promise.all(unlinkPromises);

  // Delete person record
  await dynamo.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
    }),
  );

  return respond(200, { deleted: true });
};
