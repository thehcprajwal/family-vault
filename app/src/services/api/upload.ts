import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  params?: Record<string, string | number>,
): Promise<T> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  let url = `${env.apiUrl}${path}`;
  if (params && method === 'GET') {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    url += `?${qs.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const uploadApi = {
  getUploadUrl: (params: { mimeType: string; fileExtension: string; fileSizeBytes: number }) =>
    request<{ uploadUrl: string; versionId: string; s3Key: string }>(
      'GET',
      '/v1/upload-url',
      undefined,
      {
        mimeType: params.mimeType,
        fileExtension: params.fileExtension,
        fileSizeBytes: params.fileSizeBytes,
      },
    ),

  createDocument: (body: {
    versionId: string;
    s3Key: string;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename: string;
  }) => request<{ documentId: string; versionId: string }>('POST', '/v1/documents', body),
};
