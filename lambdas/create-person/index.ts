import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'node:crypto';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

const VALID_RELATIONSHIPS = ['father','mother','brother','sister','spouse','child','grandparent','other'];

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
  const role = claims['custom:role'] as string;

  if (role !== 'owner') return respond(403, { error: 'Owner only' });

  let body: {
    displayName?: string;
    relationship?: string;
    avatarColour?: string;
    email?: string | null;
  };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  if (!body.displayName?.trim()) return respond(400, { error: 'displayName is required' });
  if (!body.relationship || !VALID_RELATIONSHIPS.includes(body.relationship)) {
    return respond(400, { error: `relationship must be one of: ${VALID_RELATIONSHIPS.join(', ')}` });
  }

  const personId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    PK: `VAULT#${vaultId}`,
    SK: `PERSON#${personId}`,
    personId,
    displayName: body.displayName.trim(),
    relationship: body.relationship,
    avatarColour: body.avatarColour ?? '#185FA5',
    cognitoSub: null as string | null,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(new PutItemCommand({ TableName: TABLE_NAME, Item: marshall(item, { removeUndefinedValues: true }) }));

  let inviteSent = false;
  let cognitoSub: string | null = null;

  if (body.email) {
    try {
      const createResult = await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: body.email,
          UserAttributes: [
            { Name: 'email', Value: body.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:vaultId', Value: vaultId },
            { Name: 'custom:role', Value: 'member' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );

      cognitoSub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value ?? null;
      inviteSent = true;

      if (cognitoSub) {
        await dynamo.send(
          new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ PK: `VAULT#${vaultId}`, SK: `PERSON#${personId}` }),
            UpdateExpression: 'SET cognitoSub = :sub, updatedAt = :now',
            ExpressionAttributeValues: marshall({ ':sub': cognitoSub, ':now': now }),
          }),
        );
      }
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        return respond(409, { error: 'EMAIL_ALREADY_INVITED' });
      }
      // Non-fatal: person created but invite failed
      console.error('Cognito AdminCreateUser failed:', err);
    }
  }

  return respond(201, {
    personId,
    displayName: item.displayName,
    cognitoSub,
    inviteSent,
  });
};
