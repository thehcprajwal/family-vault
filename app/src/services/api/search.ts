import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

export interface SearchResult {
  documentId: string;
  displayName: string;
  personDisplay: string | null;
  categoryName: string | null;
  subcategory: string | null;
  uploadedAt: string;
  previewUrl: string;
  ocrSnippet: string | null;
  matchKeyword: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  extractedSlots: { person: string | null; category: string | null; subcategory: string | null };
  fallbackTextSearch: boolean;
  resultCount: number;
}

export async function search(query: string): Promise<SearchResponse> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  const response = await fetch(`${env.apiUrl}/v1/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<SearchResponse>;
}
