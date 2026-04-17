import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: process.env.AWS_REGION });
const VAPID_SSM_PATH = process.env.VAPID_SSM_PATH!;

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const result = await ssm.send(new GetParameterCommand({
    Name: `${VAPID_SSM_PATH}/vapid-public-key`,
  }));
  return respond(200, { publicKey: result.Parameter?.Value ?? '' });
}
