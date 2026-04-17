import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

async function request<T>(
  method: 'GET' | 'PATCH',
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

export interface DocumentDetail {
  documentId: string;
  displayName: string | null;
  personId: string | null;
  personDisplay: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategory: string | null;
  expiryDate: string | null;
  tags: string[];
  status: string;
  uploadedAt: string;
  uploadedBy: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  originalFilename: string | null;
  ocrText: string | null;
  llmConfidence: number | null;
  previewUrl: string;
  downloadUrl: string;
}

export interface VersionSummary {
  versionId: string;
  status: string;
  originalFilename: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string | null;
  isActive: boolean;
}

export const detailApi = {
  getDocument: (id: string) =>
    request<DocumentDetail>('GET', `/v1/documents/${id}`),

  getVersions: (id: string) =>
    request<{ versions: VersionSummary[] }>('GET', `/v1/documents/${id}/versions`),

  updateDocument: (
    id: string,
    fields: { displayName?: string; tags?: string[]; expiryDate?: string | null; subcategory?: string | null },
  ) => request<{ updated: boolean }>('PATCH', `/v1/documents/${id}`, fields),
};
