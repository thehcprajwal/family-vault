<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Categories</h1>
      <div class="w-9" />
    </div>

    <div class="p-4 space-y-5 pb-24">
      <!-- Default categories -->
      <div>
        <p class="mb-2 text-[12px] uppercase tracking-wide text-muted">Default</p>
        <div class="space-y-2">
          <div
            v-for="cat in defaultCategories"
            :key="cat.categoryId"
            class="flex items-center gap-3 rounded-2xl border border-muted-light bg-white p-4"
            :class="isOwner ? 'cursor-pointer' : ''"
            @click="isOwner && router.push(`/settings/categories/${cat.categoryId}/edit`)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-[16px] font-bold" :style="{ backgroundColor: cat.colour }">
              {{ ICON_EMOJI[cat.icon] ?? '📁' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-semibold text-dark">{{ cat.name }}</p>
              <p class="text-[12px] text-muted">{{ cat.subcategories.length }} subcategories</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="!cat.enabled" class="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-500">Off</span>
              <svg v-if="isOwner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom categories -->
      <div>
        <p class="mb-2 text-[12px] uppercase tracking-wide text-muted">Custom</p>
        <div class="space-y-2">
          <div
            v-for="cat in customCategories"
            :key="cat.categoryId"
            class="flex items-center gap-3 rounded-2xl border border-muted-light bg-white p-4"
            :class="isOwner ? 'cursor-pointer' : ''"
            @click="isOwner && router.push(`/settings/categories/${cat.categoryId}/edit`)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-[16px] font-bold" :style="{ backgroundColor: cat.colour || '#6B6B6B' }">
              {{ ICON_EMOJI[cat.icon] ?? '📁' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-semibold text-dark">{{ cat.name }}</p>
              <p class="text-[12px] text-muted">{{ cat.subcategories.length }} subcategories</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="!cat.enabled" class="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-500">Off</span>
              <svg v-if="isOwner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </div>

          <button
            v-if="isOwner"
            class="flex w-full items-center gap-3 rounded-2xl border border-dashed border-amber bg-amber/5 p-4"
            @click="router.push('/settings/categories/add')"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
            <p class="text-[15px] font-semibold text-amber">Add custom category</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useVaultStore } from '@/stores/vault';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const vaultStore = useVaultStore();
const authStore = useAuthStore();

const DEFAULT_IDS = new Set(['identity', 'financial', 'medical', 'property', 'vehicle', 'legal', 'educational', 'other']);

const isOwner = computed(() => authStore.user?.role === 'owner');
const defaultCategories = computed(() => vaultStore.categories.filter((c) => DEFAULT_IDS.has(c.categoryId)));
const customCategories = computed(() => vaultStore.categories.filter((c) => !DEFAULT_IDS.has(c.categoryId)));

const ICON_EMOJI: Record<string, string> = {
  'id-card': '🪪',
  'banknote': '💵',
  'heart-pulse': '❤️',
  'home': '🏠',
  'car': '🚗',
  'scale': '⚖️',
  'graduation-cap': '🎓',
  'folder': '📁',
  'star': '⭐',
};
</script>
