<template>
  <div>
    <!-- Tab switch -->
    <div class="mb-4 flex rounded-xl border border-muted-light bg-muted-light p-1">
      <button
        class="flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors"
        :class="activeTab === 'mine' ? 'bg-white text-dark shadow-sm' : 'text-muted'"
        @click="switchTab('mine')"
      >
        My Docs
      </button>
      <button
        class="flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors"
        :class="activeTab === 'family' ? 'bg-white text-dark shadow-sm' : 'text-muted'"
        @click="switchTab('family')"
      >
        Family
      </button>
    </div>

    <!-- Person filter pills (Family tab only) -->
    <PersonFilterPills
      v-if="activeTab === 'family'"
      :persons="vaultStore.persons"
      :active-person-id="documentsStore.activePersonFilter"
      class="mb-4"
      @filter="documentsStore.setPersonFilter"
    />

    <!-- Pending banner -->
    <button
      v-if="documentsStore.pendingDocuments.length > 0"
      class="mb-4 flex w-full items-center justify-between rounded-xl bg-amber-light px-4 py-3"
      @click="router.push(`/review/${documentsStore.pendingDocuments[0]!.documentId}`)"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-amber"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div class="text-left">
          <p class="text-[14px] font-semibold text-amber-dark">Documents to review</p>
          <p class="text-[12px] text-amber">Tap to confirm AI suggestions</p>
        </div>
      </div>
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full bg-amber text-[12px] font-bold text-white"
      >
        {{ documentsStore.pendingDocuments.length }}
      </span>
    </button>

    <!-- Error state -->
    <ErrorState v-if="loadError" :message="loadError" @retry="switchTab(activeTab)" />

    <!-- Loading skeletons -->
    <div v-else-if="documentsStore.isLoading && documentsStore.confirmedDocuments.length === 0" class="space-y-3">
      <SkeletonCard v-for="n in 3" :key="n" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loadError && !documentsStore.isLoading && documentsStore.confirmedDocuments.length === 0 && documentsStore.pendingDocuments.length === 0"
      class="flex flex-col items-center py-16 text-center"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted-light">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-muted"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p class="text-[16px] font-semibold text-dark">No documents yet</p>
      <p class="mt-1 text-[14px] text-muted">Upload your first document to get started</p>
      <button
        class="mt-6 rounded-xl bg-amber px-6 py-3 text-[14px] font-semibold text-white"
        @click="router.push('/upload')"
      >
        Upload document
      </button>
    </div>

    <!-- Document list -->
    <div v-else-if="!loadError" class="space-y-3">
      <DocumentCard
        v-for="doc in documentsStore.confirmedDocuments"
        :key="doc.documentId"
        :document-id="doc.documentId"
        :display-name="doc.displayName"
        :suggested-display-name="doc.suggestedDisplayName"
        :category-name="doc.categoryId ?? 'Other'"
        :subcategory="doc.subcategory"
        :mime-type="doc.mimeType"
        :uploaded-at="doc.uploadedAt"
        :expiry-date="doc.expiryDate"
        :status="doc.status"
        :person-display="activeTab === 'family' ? null : undefined"
        :llm-confidence="doc.llmConfidence"
        @open="router.push(`/review/${$event}`)"
      />

      <!-- Infinite scroll sentinel -->
      <div ref="sentinel" class="h-4" />

      <!-- Loading more -->
      <div
        v-if="documentsStore.isLoading && documentsStore.confirmedDocuments.length > 0"
        class="flex justify-center py-4"
      >
        <div
          class="h-6 w-6 animate-spin rounded-full border-2 border-muted-light"
          style="border-top-color: #b86c2f"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import DocumentCard from '@/components/DocumentCard.vue';
import PersonFilterPills from '@/components/PersonFilterPills.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';
import ErrorState from '@/components/ErrorState.vue';
import { useDocumentsStore } from '@/stores/documents';
import { useVaultStore } from '@/stores/vault';

const router = useRouter();
const documentsStore = useDocumentsStore();
const vaultStore = useVaultStore();

const activeTab = ref<'mine' | 'family'>('mine');
const sentinel = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);
let observer: IntersectionObserver | null = null;

function myPersonId(): string | undefined {
  // PersonRecord doesn't carry cognitoSub in the app layer — show all docs on My Docs tab
  return undefined;
}

async function switchTab(tab: 'mine' | 'family'): Promise<void> {
  activeTab.value = tab;
  loadError.value = null;
  try {
    if (tab === 'mine') {
      await documentsStore.loadDocuments(myPersonId());
    } else {
      await documentsStore.loadDocuments(undefined);
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load documents';
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      documentsStore.loadPending(),
      documentsStore.loadDocuments(myPersonId()),
    ]);
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load documents';
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && documentsStore.nextCursor) {
        void documentsStore.appendPage();
      }
    },
    { rootMargin: '100px' },
  );

  watch(sentinel, (el) => {
    if (el) observer?.observe(el);
  }, { immediate: true });
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>
