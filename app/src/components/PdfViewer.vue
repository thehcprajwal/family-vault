<template>
  <div class="relative flex flex-col items-center">
    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-light" style="border-top-color: #b86c2f" />
      <p class="mt-3 text-[13px] text-muted">Loading PDF…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-8 text-center text-[14px] text-red-600">{{ error }}</div>

    <!-- Canvas -->
    <canvas ref="canvas" class="w-full max-w-full rounded-lg shadow-sm" />

    <!-- Page nav -->
    <div v-if="totalPages > 1 && !loading" class="mt-3 flex items-center gap-4">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full border border-muted-light bg-white disabled:opacity-30"
        :disabled="currentPage <= 1"
        @click="changePage(-1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span class="text-[13px] text-muted">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full border border-muted-light bg-white disabled:opacity-30"
        :disabled="currentPage >= totalPages"
        @click="changePage(1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{ url: string }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const currentPage = ref(1);
const totalPages = ref(0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfDoc: any = null;

async function renderPage(pageNum: number): Promise<void> {
  if (!pdfDoc || !canvas.value) return;
  loading.value = true;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: window.devicePixelRatio });
  const ctx = canvas.value.getContext('2d')!;
  canvas.value.width = viewport.width;
  canvas.value.height = viewport.height;
  canvas.value.style.width = `${viewport.width / window.devicePixelRatio}px`;
  canvas.value.style.height = `${viewport.height / window.devicePixelRatio}px`;
  await page.render({ canvasContext: ctx, viewport }).promise;
  loading.value = false;
}

async function changePage(delta: number): Promise<void> {
  const next = currentPage.value + delta;
  if (next < 1 || next > totalPages.value) return;
  currentPage.value = next;
  await renderPage(currentPage.value);
}

onMounted(async () => {
  try {
    // @ts-expect-error dynamic CDN import
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
    pdfDoc = await pdfjsLib.getDocument(props.url).promise;
    totalPages.value = pdfDoc.numPages;
    await renderPage(1);
  } catch (err) {
    loading.value = false;
    error.value = 'Could not render PDF.';
    console.error('PDF render error:', err);
  }
});
</script>
