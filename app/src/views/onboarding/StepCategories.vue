<template>
  <div class="space-y-3">
    <p class="text-[13px] text-muted">Choose which document types you want to track</p>

    <div
      v-for="cat in vaultStore.categories"
      :key="cat.categoryId"
      class="flex items-center gap-3 rounded-2xl border border-[#E2CEBC] bg-white p-4"
    >
      <!-- Icon box -->
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-[18px]"
        :style="{ backgroundColor: cat.colour }"
      >
        {{ CATEGORY_ICONS[cat.icon] ?? '📁' }}
      </div>

      <!-- Name -->
      <span class="flex-1 text-[15px] font-semibold text-dark">{{ cat.name }}</span>

      <!-- Toggle -->
      <button
        class="relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors"
        :class="cat.enabled ? 'bg-sage' : 'bg-[#D4B896]'"
        @click="vaultStore.toggleCategory(cat.categoryId, !cat.enabled)"
        :aria-label="`Toggle ${cat.name}`"
      >
        <span
          class="inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform"
          :class="cat.enabled ? 'translate-x-[20px]' : 'translate-x-[3px]'"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVaultStore } from '@/stores/vault';

const emit = defineEmits<{ valid: [value: boolean] }>();
emit('valid', true);

const vaultStore = useVaultStore();

const CATEGORY_ICONS: Record<string, string> = {
  'id-card': '🪪',
  'banknote': '💰',
  'heart-pulse': '🏥',
  'home': '🏠',
  'car': '🚗',
  'scale': '⚖️',
  'graduation-cap': '🎓',
  'folder': '📁',
};
</script>
