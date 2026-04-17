<template>
  <div class="flex flex-col items-center py-16 text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
    <p class="text-[15px] font-semibold text-dark">{{ message }}</p>
    <button class="mt-4 rounded-xl bg-amber px-6 py-2.5 text-[14px] font-semibold text-white" @click="emit('retry')">
      Try Again
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
  message: 'Something went wrong',
});
const emit = defineEmits<{ retry: [] }>();
</script>
