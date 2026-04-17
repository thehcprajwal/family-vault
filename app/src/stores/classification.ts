import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  classificationApi,
  type ClassificationResult,
  type ConfirmPayload,
} from '@/services/api/classification';

export interface PendingDocument {
  documentId: string;
  loadState: 'loading' | 'ready' | 'error';
  suggestion: ClassificationResult | null;
  edits: Partial<ConfirmPayload> | null;
  error: string | null;
}

const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === 'true';

const MOCK_SUGGESTION: ClassificationResult = {
  suggestedDisplayName: 'Aadhaar Card',
  suggestedCategory: 'Identity',
  suggestedSubcategory: 'Aadhaar',
  suggestedPersonId: 'mock-person-001',
  suggestedPersonName: 'Raj Kumar',
  suggestedExpiryDate: null,
  personMatchLayer: 'exact',
  confidence: 0.92,
  reasoning: 'Document contains Aadhaar number and photo ID elements typical of an Aadhaar card.',
};

interface RenewalContext {
  personId?: string;
  categoryId?: string;
  subcategory?: string;
}

export const useClassificationStore = defineStore('classification', () => {
  const pending = ref<PendingDocument[]>([]);
  const pendingCount = computed(() => pending.value.length);
  const renewalContext = ref<RenewalContext | null>(null);

  function setRenewalContext(ctx: RenewalContext): void {
    renewalContext.value = ctx;
  }

  function getDocument(documentId: string): PendingDocument | undefined {
    return pending.value.find((d) => d.documentId === documentId);
  }

  function addPending(documentId: string): void {
    if (getDocument(documentId)) return;
    const ctx = renewalContext.value;
    pending.value.push({
      documentId,
      loadState: 'loading',
      suggestion: null,
      edits: ctx ? { personId: ctx.personId, categoryId: ctx.categoryId, subcategory: ctx.subcategory } : null,
      error: null,
    });
    renewalContext.value = null;
  }

  async function loadSuggestion(documentId: string): Promise<void> {
    if (!getDocument(documentId)) addPending(documentId);
    const doc = getDocument(documentId)!;
    doc.loadState = 'loading';
    doc.error = null;

    if (DEV_MOCK) {
      await new Promise((r) => setTimeout(r, 900));
      doc.suggestion = MOCK_SUGGESTION;
      doc.loadState = 'ready';
      return;
    }

    try {
      doc.suggestion = await classificationApi.reclassify(documentId);
      doc.loadState = 'ready';
    } catch (err) {
      doc.error = err instanceof Error ? err.message : 'Failed to load classification';
      doc.loadState = 'error';
    }
  }

  function editDocument(documentId: string, edits: Partial<ConfirmPayload>): void {
    const doc = getDocument(documentId);
    if (!doc) return;
    doc.edits = { ...doc.edits, ...edits };
  }

  async function confirmDocument(documentId: string): Promise<void> {
    const doc = getDocument(documentId);
    if (!doc?.suggestion) throw new Error('No suggestion loaded');

    const payload: ConfirmPayload = {
      personId: doc.edits?.personId !== undefined ? doc.edits.personId : doc.suggestion.suggestedPersonId,
      categoryId: doc.edits?.categoryId !== undefined ? doc.edits.categoryId : doc.suggestion.suggestedCategory,
      subcategory: doc.edits?.subcategory !== undefined ? doc.edits.subcategory : doc.suggestion.suggestedSubcategory,
      displayName: doc.edits?.displayName ?? doc.suggestion.suggestedDisplayName,
      expiryDate: doc.edits?.expiryDate !== undefined ? doc.edits.expiryDate : doc.suggestion.suggestedExpiryDate,
    };

    if (DEV_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      pending.value = pending.value.filter((d) => d.documentId !== documentId);
      return;
    }

    await classificationApi.confirm(documentId, payload);
    pending.value = pending.value.filter((d) => d.documentId !== documentId);
  }

  function discardDocument(documentId: string): void {
    pending.value = pending.value.filter((d) => d.documentId !== documentId);
  }

  async function reclassify(documentId: string): Promise<void> {
    await loadSuggestion(documentId);
  }

  return {
    pending,
    pendingCount,
    renewalContext,
    setRenewalContext,
    addPending,
    getDocument,
    loadSuggestion,
    editDocument,
    confirmDocument,
    discardDocument,
    reclassify,
  };
});
