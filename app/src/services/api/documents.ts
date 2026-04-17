import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

async function request<T>(
  method: 'GET' | 'DELETE',
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  let url = `${env.apiUrl}${path}`;
  if (params && method === 'GET') {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
    );
    if (Object.keys(filtered).length > 0) {
      url += `?${new URLSearchParams(Object.entries(filtered).map(([k, v]) => [k, String(v)])).toString()}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface DocumentListItem {
  documentId: string;
  displayName: string | null;
  personId: string | null;
  categoryId: string | null;
  subcategory: string | null;
  status: 'PENDING' | 'CONFIRMED';
  expiryDate: string | null;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string | null;
  llmConfidence: number | null;
  suggestedDisplayName: string | null;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  nextCursor: string | null;
}

export interface DocumentStatusResponse {
  documentId: string;
  documentStatus: string;
  versionStatus: string;
}

export const documentsApi = {
  list: (filters: {
    status?: 'PENDING' | 'CONFIRMED';
    personId?: string;
    categoryId?: string;
    cursor?: string;
    limit?: number;
  }) =>
    request<DocumentListResponse>('GET', '/v1/documents', filters as Record<string, string | number>),

  getStatus: (documentId: string) =>
    request<DocumentStatusResponse>('GET', `/v1/documents/${documentId}/status`),

  delete: (documentId: string) =>
    request<{ deleted: boolean }>('DELETE', `/v1/documents/${documentId}`),
};
