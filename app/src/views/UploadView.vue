<template>
  <div class="min-h-screen bg-cream">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream p-4"
    >
      <button
        :disabled="isUploadInProgress"
        :class="isUploadInProgress ? 'opacity-30' : 'opacity-100'"
        class="flex h-9 w-9 items-center justify-center rounded-full transition-opacity"
        @click="handleBack"
        aria-label="Go back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-dark"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Upload Document</h1>
    </div>

    <div class="p-4">
      <!-- Info tip banner -->
      <div
        v-if="upload.state.status === 'idle' || upload.state.status === 'preparing'"
        class="mb-4 flex items-start gap-3 rounded-xl p-4"
        style="background-color: #f5e8d4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mt-0.5 shrink-0 text-amber"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-[13px] leading-relaxed text-dark">
          Scan physical documents in good lighting for best results. Supported: JPG, PNG, HEIC,
          WebP, PDF (max 20 MB).
        </p>
      </div>

      <!-- Drop zone (idle state) -->
      <div
        v-if="upload.state.status === 'idle'"
        class="mb-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors"
        :class="isDragging ? 'border-sage bg-sage/5' : 'border-[#C4A882]'"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mb-3 text-muted"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p class="mb-1 text-[15px] font-medium text-dark">Drop a file here</p>
        <p class="mb-4 text-[13px] text-muted">or tap to browse</p>
        <button
          class="rounded-xl bg-sage px-6 py-2.5 text-[14px] font-semibold text-white"
          @click.stop="fileInput?.click()"
        >
          Choose File
        </button>
      </div>

      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.pdf"
        @change="onFileChange"
      />

      <!-- File card -->
      <div
        v-if="upload.state.file && upload.state.status !== 'idle'"
        class="mb-4 flex items-center gap-3 rounded-xl border border-muted-light bg-white p-4"
      >
        <!-- File icon or checkmark -->
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          :class="upload.state.status === 'done' ? 'bg-sage/10' : 'bg-muted-light'"
        >
          <!-- Checkmark for done -->
          <svg
            v-if="upload.state.status === 'done'"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-sage"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <!-- File icon otherwise -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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

        <div class="min-w-0 flex-1">
          <p class="truncate text-[14px] font-medium text-dark">{{ upload.state.file.name }}</p>
          <p class="text-[12px] text-muted">{{ formatFileSize(upload.state.file.size) }}</p>
        </div>
      </div>

      <!-- Progress bar (uploading) -->
      <div v-if="upload.state.status === 'uploading'" class="mb-3">
        <div class="mb-1 flex items-center justify-between">
          <p class="text-[13px] text-muted">Uploading…</p>
          <p class="text-[13px] font-semibold text-dark">{{ upload.state.progress }}%</p>
        </div>
        <div class="h-[6px] w-full overflow-hidden rounded-full" style="background-color: #e2cebc">
          <div
            class="h-full rounded-full transition-all duration-200"
            style="background-color: #5c7a4e"
            :style="{ width: `${upload.state.progress}%` }"
          />
        </div>
      </div>

      <!-- Status text -->
      <p
        v-if="upload.state.status === 'preparing'"
        class="mb-4 text-center text-[14px] text-muted"
      >
        Preparing…
      </p>

      <!-- Processing state -->
      <div v-if="upload.state.status === 'processing'" class="mb-4 flex flex-col items-center py-4">
        <!-- Spinner -->
        <div
          class="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-muted-light"
          style="border-top-color: #5c7a4e"
        />
        <p class="text-[15px] font-medium text-dark">AI is classifying your document…</p>
        <p class="mt-1 text-[13px] text-muted">This usually takes a few seconds</p>
      </div>

      <!-- Done state -->
      <div v-if="upload.state.status === 'done'" class="mb-4 py-2 text-center">
        <p class="text-[15px] font-semibold text-sage">Upload complete</p>
        <p class="mt-1 text-[13px] text-muted">AI is processing your document in the background</p>
      </div>

      <!-- Error banner -->
      <div
        v-if="upload.state.status === 'error'"
        class="mb-4 rounded-xl bg-red-50 p-4 text-[14px] text-red-700"
      >
        {{ upload.state.errorMessage ?? 'Something went wrong. Please try again.' }}
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-3">
        <!-- Cancel (uploading only) -->
        <button
          v-if="upload.state.status === 'uploading'"
          class="h-[50px] w-full rounded-xl border border-muted-light bg-white text-[15px] text-dark"
          @click="upload.cancel()"
        >
          Cancel
        </button>

        <!-- Review now (done only) -->
        <button
          v-if="upload.state.status === 'done' && upload.state.documentId"
          class="h-[50px] w-full rounded-xl bg-sage text-[15px] font-semibold text-white"
          @click="router.push(`/review/${upload.state.documentId}`)"
        >
          Review document
        </button>

        <!-- Go to Home (processing or done) -->
        <button
          v-if="upload.state.status === 'processing' || upload.state.status === 'done'"
          class="h-[50px] w-full rounded-xl border border-muted-light bg-white text-[15px] text-dark"
          @click="goHome"
        >
          Go to Home
        </button>

        <!-- Try again (error) -->
        <button
          v-if="upload.state.status === 'error'"
          class="h-[50px] w-full rounded-xl bg-sage text-[15px] font-semibold text-white"
          @click="upload.reset(); fileInput?.click()"
        >
          Try again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUploadStore } from '@/stores/upload';
import { useClassificationStore } from '@/stores/classification';

const router = useRouter();
const upload = useUploadStore();
const classificationStore = useClassificationStore();
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

// When upload completes, register doc as pending review
watch(
  () => upload.state.status,
  (status) => {
    if (status === 'done' && upload.state.documentId) {
      classificationStore.addPending(upload.state.documentId);
    }
  },
);

const isUploadInProgress = computed(() =>
  upload.state.status === 'uploading' || upload.state.status === 'preparing',
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    void upload.startUpload(file);
  }
}

function onDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void upload.startUpload(file);
  }
}

function handleBack(): void {
  if (!isUploadInProgress.value) {
    upload.reset();
    void router.push('/');
  }
}

function goHome(): void {
  upload.reset();
  void router.push('/');
}
</script>
