import { defineStore } from 'pinia';
import { ref } from 'vue';
import { documentsApi, type DocumentListItem } from '@/services/api/documents';
import type { ConfirmPayload } from '@/services/api/classification';
import { classificationApi } from '@/services/api/classification';

export const useDocumentsStore = defineStore('documents', () => {
  const pendingDocuments = ref<DocumentListItem[]>([]);
  const confirmedDocuments = ref<DocumentListItem[]>([]);
  const nextCursor = ref<string | null>(null);
  const isLoading = ref(false);
  const activePersonFilter = ref<string | null>(null);
  const error = ref<string | null>(null);

  async function loadPending(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await documentsApi.list({ status: 'PENDING' });
      pendingDocuments.value = res.documents;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load pending documents';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadDocuments(personId?: string): Promise<void> {
    isLoading.value = true;
    error.value = null;
    confirmedDocuments.value = [];
    nextCursor.value = null;
    activePersonFilter.value = personId ?? null;
    try {
      const res = await documentsApi.list({
        status: 'CONFIRMED',
        ...(personId ? { personId } : {}),
      });
      confirmedDocuments.value = res.documents;
      nextCursor.value = res.nextCursor;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load documents';
    } finally {
      isLoading.value = false;
    }
  }

  async function appendPage(): Promise<void> {
    if (!nextCursor.value || isLoading.value) return;
    isLoading.value = true;
    try {
      const res = await documentsApi.list({
        status: 'CONFIRMED',
        ...(activePersonFilter.value ? { personId: activePersonFilter.value } : {}),
        cursor: nextCursor.value,
      });
      confirmedDocuments.value = [...confirmedDocuments.value, ...res.documents];
      nextCursor.value = res.nextCursor;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load more documents';
    } finally {
      isLoading.value = false;
    }
  }

  async function confirmDocument(id: string, fields: ConfirmPayload): Promise<void> {
    await classificationApi.confirm(id, fields);
    pendingDocuments.value = pendingDocuments.value.filter((d) => d.documentId !== id);
  }

  async function discardDocument(id: string): Promise<void> {
    await documentsApi.delete(id);
    pendingDocuments.value = pendingDocuments.value.filter((d) => d.documentId !== id);
  }

  function setPersonFilter(personId: string | null): void {
    void loadDocuments(personId ?? undefined);
  }

  return {
    pendingDocuments,
    confirmedDocuments,
    nextCursor,
    isLoading,
    activePersonFilter,
    error,
    loadPending,
    loadDocuments,
    appendPage,
    confirmDocument,
    discardDocument,
    setPersonFilter,
  };
});
