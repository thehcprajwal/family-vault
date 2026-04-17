<template>
  <div class="rounded-2xl border border-muted-light bg-white p-4">
    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div class="h-5 w-3/4 animate-pulse rounded-lg bg-muted-light" />
      <div class="grid grid-cols-2 gap-3">
        <div v-for="n in 4" :key="n" class="h-14 animate-pulse rounded-xl bg-muted-light" />
      </div>
      <div class="h-10 animate-pulse rounded-xl bg-muted-light" />
    </div>

    <template v-else-if="suggestion">
      <!-- Title row -->
      <div class="mb-3 flex items-start justify-between gap-2">
        <h2 class="text-[17px] font-semibold leading-tight text-dark">
          {{ suggestion.suggestedDisplayName }}
        </h2>
        <span
          class="shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
          :class="confidencePillClass"
        >
          {{ confidenceLabel }}
        </span>
      </div>

      <!-- 2×2 metadata grid -->
      <div class="mb-3 grid grid-cols-2 gap-2">
        <div class="rounded-xl bg-cream p-3">
          <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Person</p>
          <p class="truncate text-[14px] font-medium text-dark">
            {{ suggestion.suggestedPersonName ?? '—' }}
          </p>
          <p v-if="suggestion.personMatchLayer" class="mt-0.5 text-[11px] text-muted">
            {{ suggestion.personMatchLayer }} match
          </p>
        </div>

        <div class="rounded-xl bg-cream p-3">
          <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Category</p>
          <p class="truncate text-[14px] font-medium text-dark">
            {{ suggestion.suggestedCategory ?? '—' }}
          </p>
          <p v-if="suggestion.suggestedSubcategory" class="mt-0.5 truncate text-[11px] text-muted">
            {{ suggestion.suggestedSubcategory }}
          </p>
        </div>

        <div class="rounded-xl bg-cream p-3">
          <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Subcategory</p>
          <p class="truncate text-[14px] font-medium text-dark">
            {{ suggestion.suggestedSubcategory ?? '—' }}
          </p>
        </div>

        <div class="rounded-xl bg-cream p-3">
          <p class="mb-0.5 text-[11px] uppercase tracking-wide text-muted">Expiry</p>
          <p class="truncate text-[14px] font-medium text-dark">
            {{ suggestion.suggestedExpiryDate ?? 'No expiry' }}
          </p>
        </div>
      </div>

      <!-- Low confidence warning -->
      <div
        v-if="suggestion.confidence < 0.70"
        class="mb-3 flex items-start gap-2 rounded-xl bg-amber-light p-3"
      >
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
          class="mt-0.5 shrink-0 text-amber"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p class="text-[13px] text-amber-dark">
          Low confidence — please review carefully before confirming.
        </p>
      </div>

      <!-- Reasoning -->
      <div class="rounded-xl bg-cream p-3">
        <p class="mb-1 text-[11px] uppercase tracking-wide text-muted">AI Reasoning</p>
        <p class="text-[13px] leading-relaxed text-dark">{{ suggestion.reasoning }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ClassificationResult } from '@/services/api/classification';

const props = defineProps<{
  suggestion: ClassificationResult | null;
  loading?: boolean;
}>();

const confidenceLabel = computed(() => {
  if (!props.suggestion) return '';
  const pct = Math.round(props.suggestion.confidence * 100);
  return `${pct}%`;
});

const confidencePillClass = computed(() => {
  if (!props.suggestion) return '';
  const c = props.suggestion.confidence;
  if (c >= 0.7) return 'bg-sage/15 text-sage';
  if (c >= 0.5) return 'bg-amber-light text-amber-dark';
  return 'bg-red-100 text-red-700';
});
</script>
