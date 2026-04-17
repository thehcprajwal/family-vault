<template>
  <button
    class="flex w-full items-center gap-3 rounded-2xl border border-muted-light bg-white p-4 text-left"
    @click="emit('open', documentId)"
  >
    <!-- Category icon box -->
    <div
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      :style="{ backgroundColor: categoryColour + '22' }"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{ color: categoryColour }"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>

    <!-- Text content -->
    <div class="min-w-0 flex-1">
      <p class="truncate text-[14px] font-semibold text-dark">
        {{ displayName ?? suggestedDisplayName ?? 'Untitled document' }}
      </p>
      <div class="mt-0.5 flex items-center gap-1.5">
        <span v-if="categoryName" class="text-[12px] text-muted">{{ categoryName }}</span>
        <span v-if="categoryName && subcategory" class="text-[10px] text-muted">·</span>
        <span v-if="subcategory" class="text-[12px] text-muted">{{ subcategory }}</span>
      </div>
      <div class="mt-1 flex items-center gap-2">
        <span class="text-[11px] text-muted">{{ formatDate(uploadedAt) }}</span>
        <span v-if="personDisplay" class="text-[11px] text-muted">· {{ personDisplay }}</span>
      </div>
    </div>

    <!-- Right side: expiry badge or pending indicator -->
    <div class="shrink-0">
      <span
        v-if="status === 'PENDING'"
        class="rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-semibold text-amber-dark"
      >
        Pending
      </span>
      <span
        v-else-if="expiryBadge"
        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="{
          'bg-red-100 text-red-700': expiryBadge.colour === 'red',
          'bg-amber-light text-amber-dark': expiryBadge.colour === 'amber',
          'bg-muted-light text-muted': expiryBadge.colour === 'muted',
        }"
      >
        {{ expiryBadge.label }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  documentId: string;
  displayName: string | null;
  suggestedDisplayName?: string | null;
  categoryName: string;
  subcategory: string | null;
  mimeType: string;
  uploadedAt: string;
  expiryDate: string | null;
  status: 'PENDING' | 'CONFIRMED';
  personDisplay?: string | null;
  llmConfidence?: number | null;
}>();

const emit = defineEmits<{
  open: [documentId: string];
}>();

const CATEGORY_COLOURS: Record<string, string> = {
  Identity: '#185FA5',
  Medical: '#993C1D',
  Vehicle: '#3B6D11',
  Financial: '#854F0B',
  Property: '#6B3FA0',
  Education: '#0F6E56',
  Insurance: '#B86C2F',
  Other: '#555555',
};

const categoryColour = computed(
  () => CATEGORY_COLOURS[props.categoryName] ?? CATEGORY_COLOURS['Other'],
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

const expiryBadge = computed((): { label: string; colour: 'red' | 'amber' | 'muted' } | null => {
  if (!props.expiryDate) return null;
  const today = new Date();
  const [year, month] = props.expiryDate.split('-').map(Number);
  const expiry = new Date(year!, month! - 1, 1);
  const months = monthDiff(today, expiry);
  if (months < 0) return { label: 'Expired', colour: 'red' };
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (months <= 1) return { label: `${daysLeft}d left`, colour: 'amber' };
  if (months <= 3) return { label: `${months}mo left`, colour: 'muted' };
  return null;
});
</script>
