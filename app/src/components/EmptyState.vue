<template>
  <div class="flex flex-col items-center py-16 text-center">
    <slot name="illustration">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted-light">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
    </slot>
    <p class="text-[16px] font-semibold text-dark">{{ title }}</p>
    <p v-if="subtitle" class="mt-1 text-[14px] text-muted">{{ subtitle }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>
