import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface ClassificationResult {
  suggestedDisplayName: string;
  suggestedCategory: string | null;
  suggestedSubcategory: string | null;
  suggestedPersonId: string | null;
  suggestedPersonName: string | null;
  suggestedExpiryDate: string | null;
  personMatchLayer: 'exact' | 'synonym' | 'fuzzy' | null;
  confidence: number;
  reasoning: string;
}

export interface ConfirmPayload {
  personId?: string | null;
  categoryId?: string | null;
  subcategory?: string | null;
  displayName?: string;
  expiryDate?: string | null;
}

export const classificationApi = {
  reclassify: (documentId: string) =>
    request<ClassificationResult>('POST', `/v1/documents/${documentId}/reclassify`),

  confirm: (documentId: string, payload: ConfirmPayload) =>
    request<{ documentId: string; status: string }>(
      'PATCH',
      `/v1/documents/${documentId}/confirm`,
      payload,
    ),
};
