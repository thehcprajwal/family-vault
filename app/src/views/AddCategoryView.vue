<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Add Category</h1>
    </div>

    <div class="p-4 space-y-5 pb-24">
      <!-- Live preview card -->
      <div class="flex items-center gap-3 rounded-2xl border border-muted-light bg-white p-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white text-[20px] font-bold" :style="{ backgroundColor: selectedColour }">
          {{ ICON_EMOJI[selectedIcon] ?? '📁' }}
        </div>
        <div>
          <p class="text-[16px] font-semibold text-dark">{{ name || 'Category name' }}</p>
          <p class="text-[12px] text-muted">{{ subcategories.length }} subcategories</p>
        </div>
      </div>

      <!-- Name -->
      <div>
        <label class="mb-1 block text-[13px] font-semibold text-dark">Name *</label>
        <input
          v-model="name"
          type="text"
          placeholder="e.g. Insurance"
          class="h-12 w-full rounded-xl border border-muted-light bg-white px-4 text-[15px] text-dark focus:border-amber focus:outline-none"
        />
      </div>

      <!-- Icon picker -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold text-dark">Icon</label>
        <div class="flex gap-3">
          <button
            v-for="ic in ICONS"
            :key="ic"
            class="flex h-12 w-12 items-center justify-center rounded-xl text-[22px] transition-transform"
            :class="selectedIcon === ic ? 'ring-2 ring-amber ring-offset-2' : 'bg-white border border-muted-light'"
            :style="selectedIcon === ic ? { backgroundColor: selectedColour } : {}"
            @click="selectedIcon = ic"
          >
            {{ ICON_EMOJI[ic] }}
          </button>
        </div>
      </div>

      <!-- Colour picker -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold text-dark">Colour</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="c in COLOURS"
            :key="c"
            class="h-9 w-9 rounded-full"
            :style="{ backgroundColor: c, outline: selectedColour === c ? '2px solid #B86C2F' : 'none', outlineOffset: '2px' }"
            @click="selectedColour = c"
          />
        </div>
      </div>

      <!-- Subcategory chips -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold text-dark">Subcategories</label>
        <div class="flex flex-wrap gap-2 mb-2">
          <div
            v-for="(sub, i) in subcategories"
            :key="sub"
            class="flex items-center gap-1 rounded-full bg-amber/10 px-3 py-1.5"
          >
            <span class="text-[13px] font-medium text-amber-dark">{{ sub }}</span>
            <button class="text-amber-dark/60 hover:text-red-500" @click="removeSubcategory(i)">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <button
            v-if="!addingSubcategory"
            class="rounded-full border border-dashed border-amber px-3 py-1.5 text-[13px] text-amber"
            @click="addingSubcategory = true"
          >
            + Add
          </button>
        </div>
        <div v-if="addingSubcategory" class="flex gap-2">
          <input
            v-model="newSubcategory"
            class="flex-1 rounded-xl border border-amber px-3 py-2 text-[14px] focus:outline-none"
            placeholder="Subcategory name"
            @keydown.enter="saveSubcategory"
            @keydown.escape="addingSubcategory = false"
          />
          <button class="rounded-xl bg-amber px-4 py-2 text-[13px] font-semibold text-white" @click="saveSubcategory">Add</button>
        </div>
      </div>

      <p v-if="errorMsg" class="text-[13px] text-red-600">{{ errorMsg }}</p>

      <button
        class="h-[50px] w-full rounded-xl bg-amber text-[15px] font-semibold text-white disabled:opacity-50"
        :disabled="!name.trim() || isSaving"
        @click="handleSave"
      >
        {{ isSaving ? 'Saving…' : 'Save Category' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { categoriesApi } from '@/services/api/categories';
import { useVaultStore } from '@/stores/vault';

const router = useRouter();
const vaultStore = useVaultStore();

const ICONS = ['id-card', 'banknote', 'heart-pulse', 'home', 'car', 'scale', 'graduation-cap', 'folder', 'star'];
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
const COLOURS = ['#185FA5', '#3B6D11', '#993C1D', '#854F0B', '#6B3FA0', '#0F6E56', '#1A5F7A', '#6B6B6B'];

const name = ref('');
const selectedIcon = ref(ICONS[7]!);
const selectedColour = ref(COLOURS[0]!);
const subcategories = ref<string[]>([]);
const addingSubcategory = ref(false);
const newSubcategory = ref('');
const isSaving = ref(false);
const errorMsg = ref<string | null>(null);

function saveSubcategory(): void {
  const val = newSubcategory.value.trim();
  if (val && !subcategories.value.includes(val)) {
    subcategories.value.push(val);
  }
  newSubcategory.value = '';
  addingSubcategory.value = false;
}

function removeSubcategory(index: number): void {
  subcategories.value.splice(index, 1);
}

async function handleSave(): Promise<void> {
  if (!name.value.trim()) return;
  isSaving.value = true;
  errorMsg.value = null;
  try {
    const result = await categoriesApi.create({
      name: name.value.trim(),
      icon: selectedIcon.value,
      colour: selectedColour.value,
      subcategories: subcategories.value,
    });
    await vaultStore.loadVault();
    void router.push(`/settings/categories/${result.categoryId}/edit`);
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to create category';
  } finally {
    isSaving.value = false;
  }
}
</script>
