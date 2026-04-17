<template>
  <div class="rounded-2xl border border-muted-light bg-white p-4">
    <div class="mb-3 flex items-start gap-3">
      <!-- Person avatar dot -->
      <div
        v-if="personDisplay"
        class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/20 text-[11px] font-bold text-amber"
      >
        {{ personDisplay.charAt(0).toUpperCase() }}
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-semibold text-dark">{{ displayName }}</p>
        <div class="mt-0.5 flex items-center gap-1.5">
          <span v-if="categoryName" class="text-[12px] text-muted">{{ categoryName }}</span>
          <span v-if="categoryName && subcategory" class="text-[10px] text-muted">·</span>
          <span v-if="subcategory" class="text-[12px] text-muted">{{ subcategory }}</span>
        </div>
        <p class="mt-0.5 text-[11px] text-muted">{{ formatDate(uploadedAt) }}</p>
      </div>
    </div>

    <!-- OCR snippet with highlighted keyword -->
    <p
      v-if="ocrSnippet"
      class="mb-3 rounded-lg bg-cream px-3 py-2 text-[12px] leading-relaxed text-dark"
      v-html="highlightedSnippet"
    />

    <!-- Action buttons -->
    <div class="flex gap-2">
      <a
        :href="previewUrl"
        target="_blank"
        rel="noopener"
        class="flex-1 rounded-xl bg-amber px-4 py-2 text-center text-[13px] font-semibold text-white"
      >
        Preview
      </a>
      <button
        class="rounded-xl border border-muted-light px-4 py-2 text-[13px] text-dark"
        @click="emit('open', documentId)"
      >
        Details
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  documentId: string;
  displayName: string;
  personDisplay: string | null;
  categoryName: string | null;
  subcategory: string | null;
  uploadedAt: string;
  previewUrl: string;
  ocrSnippet: string | null;
  matchKeyword: string | null;
}>();

const emit = defineEmits<{ open: [documentId: string] }>();

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const highlightedSnippet = computed(() => {
  if (!props.ocrSnippet) return '';
  if (!props.matchKeyword) return props.ocrSnippet;
  const escaped = props.matchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return props.ocrSnippet.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark class="bg-amber/30 text-amber-dark rounded px-0.5">$1</mark>',
  );
});
</script>
