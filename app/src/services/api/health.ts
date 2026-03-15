import { env } from '@/config/env';

export interface HealthCheckResponse {
  status: 'ok';
  stage?: string;
  authenticatedAs: string;
  vaultId: string;
  role: string;
}

export async function fetchHealthStatus(accessToken: string): Promise<HealthCheckResponse> {
  const response = await fetch(`${env.apiUrl}/v1/health`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }

  return (await response.json()) as HealthCheckResponse;
}
