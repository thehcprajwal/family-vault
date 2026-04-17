import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

async function request<T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const categoriesApi = {
  create: (data: { name: string; icon?: string; colour?: string; subcategories?: string[] }) =>
    request<{ categoryId: string; name: string }>('POST', '/v1/categories', data),

  update: (
    id: string,
    data: { name?: string; icon?: string; colour?: string; subcategories?: string[]; enabled?: boolean },
  ) => request<{ updated: boolean }>('PATCH', `/v1/categories/${id}`, data),
};
