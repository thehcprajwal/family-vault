<template>
  <div class="no-scrollbar flex gap-2 overflow-x-auto pb-1">
    <button
      class="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
      :class="
        activePersonId === null
          ? 'bg-amber text-white'
          : 'border border-muted-light bg-white text-dark'
      "
      @click="emit('filter', null)"
    >
      All
    </button>
    <button
      v-for="person in persons"
      :key="person.personId"
      class="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
      :class="
        activePersonId === person.personId
          ? 'bg-amber text-white'
          : 'border border-muted-light bg-white text-dark'
      "
      @click="emit('filter', person.personId)"
    >
      {{ person.displayName }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  persons: { personId: string; displayName: string }[];
  activePersonId: string | null;
}>();

const emit = defineEmits<{
  filter: [personId: string | null];
}>();
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
