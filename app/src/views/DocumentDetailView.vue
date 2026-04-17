<template>
  <div class="min-h-screen bg-cream">
    <!-- Header -->
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[16px] font-semibold text-dark">Document</h1>
      <a v-if="doc?.downloadUrl" :href="doc.downloadUrl" download class="flex h-9 w-9 items-center justify-center rounded-full border border-muted-light bg-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
      <div v-else class="h-9 w-9" />
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex flex-col items-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-light" style="border-top-color: #b86c2f" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="p-4 text-[14px] text-red-600">{{ loadError }}</div>

    <template v-else-if="doc">
      <!-- Preview area -->
      <div class="border-b border-muted-light bg-white p-4">
        <img v-if="doc.mimeType?.startsWith('image/')" :src="doc.previewUrl" class="mx-auto max-h-72 w-full rounded-xl object-contain" />
        <PdfViewer v-else-if="doc.mimeType === 'application/pdf'" :url="doc.previewUrl" />
        <div v-else class="flex flex-col items-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <p class="mt-2 text-[13px] text-muted">{{ doc.originalFilename }}</p>
        </div>
      </div>

      <!-- Tab switch -->
      <div class="flex border-b border-muted-light bg-cream">
        <button
          v-for="tab in ['Details', 'History']"
          :key="tab"
          class="flex-1 py-3 text-[13px] font-semibold transition-colors"
          :class="activeTab === tab ? 'border-b-2 border-amber text-amber' : 'text-muted'"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Details tab -->
      <div v-if="activeTab === 'Details'" class="p-4 space-y-4 pb-32">
        <!-- Title + edit -->
        <div class="flex items-start justify-between gap-2">
          <div v-if="!isEditing">
            <h2 class="text-[18px] font-semibold text-dark">{{ doc.displayName ?? 'Untitled' }}</h2>
          </div>
          <input v-else v-model="editFields.displayName" class="flex-1 rounded-xl border border-muted-light bg-white px-3 py-2 text-[15px] text-dark" />
          <button class="ml-2 shrink-0 rounded-full border border-muted-light bg-white p-2" @click="toggleEdit">
            <svg v-if="!isEditing" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span v-else class="text-[12px] font-semibold text-sage">Save</span>
          </button>
        </div>

        <!-- Metadata card -->
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Person</p>
            <p class="text-[14px] font-medium text-dark">{{ doc.personDisplay ?? '—' }}</p>
          </div>
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Category</p>
            <p class="text-[14px] font-medium text-dark">{{ doc.categoryName ?? '—' }}</p>
          </div>
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Subcategory</p>
            <p class="text-[14px] font-medium text-dark">{{ doc.subcategory ?? '—' }}</p>
          </div>
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Expiry</p>
            <p v-if="!isEditing" class="text-[14px] font-medium text-dark">{{ doc.expiryDate ?? 'None' }}</p>
            <input v-else v-model="editFields.expiryDate" placeholder="YYYY-MM" class="w-full rounded-lg border border-muted-light bg-cream px-2 py-1 text-[13px]" />
          </div>
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Uploaded</p>
            <p class="text-[14px] font-medium text-dark">{{ formatDate(doc.uploadedAt) }}</p>
          </div>
          <div class="rounded-xl bg-white p-3">
            <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Size</p>
            <p class="text-[14px] font-medium text-dark">{{ formatSize(doc.fileSizeBytes) }}</p>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <p class="mb-2 text-[12px] uppercase tracking-wide text-muted">Tags</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in doc.tags"
              :key="tag"
              class="rounded-full bg-amber-light px-3 py-1 text-[12px] font-medium text-amber-dark"
            >
              {{ tag }}
            </span>
            <button
              v-if="!addingTag"
              class="rounded-full border border-dashed border-amber px-3 py-1 text-[12px] text-amber"
              @click="addingTag = true"
            >
              + Add tag
            </button>
            <div v-else class="flex gap-1">
              <input v-model="newTag" class="rounded-full border border-amber px-3 py-1 text-[12px]" placeholder="Tag name" @keydown.enter="saveTag" />
              <button class="text-[12px] font-semibold text-amber" @click="saveTag">Add</button>
            </div>
          </div>
        </div>

        <!-- OCR text collapsible -->
        <div v-if="doc.ocrText">
          <button class="flex items-center gap-2 text-[12px] uppercase tracking-wide text-muted" @click="showOcr = !showOcr">
            <span>OCR Text</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="showOcr ? 'rotate-180' : ''">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div v-if="showOcr" class="mt-2 rounded-xl bg-white p-3">
            <pre class="whitespace-pre-wrap text-[12px] leading-relaxed text-dark font-mono">{{ doc.ocrText }}</pre>
            <button class="mt-2 text-[12px] text-amber" @click="copyOcr">Copy</button>
          </div>
        </div>

        <!-- Re-classify -->
        <button
          class="h-[44px] w-full rounded-xl border border-amber text-[14px] font-semibold text-amber"
          @click="router.push(`/review/${documentId}`)"
        >
          Re-classify with AI
        </button>
      </div>

      <!-- History tab -->
      <div v-else class="p-4 space-y-3">
        <div v-if="versionsLoading" class="flex justify-center py-8">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-light" style="border-top-color: #b86c2f" />
        </div>
        <div
          v-for="v in versions"
          :key="v.versionId"
          class="flex items-center gap-3 rounded-xl border border-muted-light bg-white p-4"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-muted-light">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="truncate text-[14px] font-medium text-dark">{{ v.originalFilename }}</p>
            <p class="text-[12px] text-muted">{{ formatDate(v.uploadedAt) }} · {{ formatSize(v.fileSizeBytes) }}</p>
          </div>
          <span v-if="v.isActive" class="rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-semibold text-sage">Active</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PdfViewer from '@/components/PdfViewer.vue';
import { detailApi, type DocumentDetail, type VersionSummary } from '@/services/api/detail';

const route = useRoute();
const router = useRouter();

const documentId = computed(() => route.params.documentId as string);
const doc = ref<DocumentDetail | null>(null);
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const activeTab = ref<'Details' | 'History'>('Details');
const versions = ref<VersionSummary[]>([]);
const versionsLoading = ref(false);
const isEditing = ref(false);
const editFields = ref<{ displayName: string; expiryDate: string | null }>({ displayName: '', expiryDate: null });
const showOcr = ref(false);
const addingTag = ref(false);
const newTag = ref('');

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

onMounted(async () => {
  try {
    doc.value = await detailApi.getDocument(documentId.value);
    editFields.value = { displayName: doc.value.displayName ?? '', expiryDate: doc.value.expiryDate };
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load document';
  } finally {
    isLoading.value = false;
  }
});

watch(activeTab, async (tab) => {
  if (tab === 'History' && versions.value.length === 0) {
    versionsLoading.value = true;
    try {
      const res = await detailApi.getVersions(documentId.value);
      versions.value = res.versions;
      if (doc.value?.documentId) {
        const activeId = (doc.value as unknown as Record<string, unknown>)['activeVersionId'] as string | undefined;
        versions.value = versions.value.map((v) => ({ ...v, isActive: v.versionId === activeId }));
      }
    } finally {
      versionsLoading.value = false;
    }
  }
});

async function toggleEdit(): Promise<void> {
  if (isEditing.value && doc.value) {
    await detailApi.updateDocument(documentId.value, {
      displayName: editFields.value.displayName || undefined,
      expiryDate: editFields.value.expiryDate,
    });
    doc.value.displayName = editFields.value.displayName;
    doc.value.expiryDate = editFields.value.expiryDate;
  }
  isEditing.value = !isEditing.value;
}

async function saveTag(): Promise<void> {
  if (!newTag.value.trim() || !doc.value) return;
  const updatedTags = [...doc.value.tags, newTag.value.trim()];
  await detailApi.updateDocument(documentId.value, { tags: updatedTags });
  doc.value.tags = updatedTags;
  newTag.value = '';
  addingTag.value = false;
}

function copyOcr(): void {
  if (doc.value?.ocrText) void navigator.clipboard.writeText(doc.value.ocrText);
}
</script>
