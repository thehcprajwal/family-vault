<template>
  <div class="rounded-2xl border border-muted-light bg-white p-4" :style="{ height: props.height }">
    <div class="flex items-center gap-3">
      <div class="skeleton h-10 w-10 shrink-0 rounded-xl" />
      <div class="flex-1 space-y-2">
        <div v-for="n in props.lines" :key="n" class="skeleton rounded-lg" :style="{ height: '14px', width: n === 1 ? '60%' : n === 2 ? '40%' : '80%' }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ lines?: number; height?: string }>(), {
  lines: 3,
  height: '80px',
});
</script>
