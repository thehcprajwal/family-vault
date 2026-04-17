<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Edit Category</h1>
    </div>

    <div v-if="category" class="p-4 space-y-5 pb-24">
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

      <!-- Enabled toggle (always visible) -->
      <div class="flex items-center justify-between rounded-2xl border border-muted-light bg-white p-4">
        <div>
          <p class="text-[15px] font-semibold text-dark">Enabled</p>
          <p class="text-[12px] text-muted">Show in classification and upload prompts</p>
        </div>
        <button
          class="relative h-7 w-12 rounded-full transition-colors"
          :class="enabled ? 'bg-amber' : 'bg-muted-light'"
          @click="enabled = !enabled"
        >
          <span
            class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
            :class="enabled ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <!-- Name (disabled for defaults) -->
      <div>
        <label class="mb-1 block text-[13px] font-semibold" :class="isDefault ? 'text-muted' : 'text-dark'">Name</label>
        <input
          v-model="name"
          type="text"
          :disabled="isDefault"
          class="h-12 w-full rounded-xl border border-muted-light px-4 text-[15px] focus:outline-none"
          :class="isDefault ? 'bg-muted-light/30 text-muted cursor-not-allowed' : 'bg-white text-dark focus:border-amber'"
        />
        <p v-if="isDefault" class="mt-1 text-[11px] text-muted">Default category name cannot be changed</p>
      </div>

      <!-- Icon picker (disabled for defaults) -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold" :class="isDefault ? 'text-muted' : 'text-dark'">Icon</label>
        <div class="flex gap-3 flex-wrap">
          <button
            v-for="ic in ICONS"
            :key="ic"
            :disabled="isDefault"
            class="flex h-12 w-12 items-center justify-center rounded-xl text-[22px] transition-transform"
            :class="[
              selectedIcon === ic ? 'ring-2 ring-amber ring-offset-2' : 'bg-white border border-muted-light',
              isDefault ? 'opacity-40 cursor-not-allowed' : '',
            ]"
            :style="selectedIcon === ic ? { backgroundColor: selectedColour } : {}"
            @click="!isDefault && (selectedIcon = ic)"
          >
            {{ ICON_EMOJI[ic] }}
          </button>
        </div>
      </div>

      <!-- Colour picker (disabled for defaults) -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold" :class="isDefault ? 'text-muted' : 'text-dark'">Colour</label>
        <div class="flex gap-2 flex-wrap" :class="isDefault ? 'opacity-40' : ''">
          <button
            v-for="c in COLOURS"
            :key="c"
            :disabled="isDefault"
            class="h-9 w-9 rounded-full"
            :class="isDefault ? 'cursor-not-allowed' : ''"
            :style="{ backgroundColor: c, outline: selectedColour === c ? '2px solid #B86C2F' : 'none', outlineOffset: '2px' }"
            @click="!isDefault && (selectedColour = c)"
          />
        </div>
        <p v-if="isDefault" class="mt-1 text-[11px] text-muted">Default category colour cannot be changed</p>
      </div>

      <!-- Subcategory chips (disabled for defaults) -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold" :class="isDefault ? 'text-muted' : 'text-dark'">Subcategories</label>
        <div class="flex flex-wrap gap-2 mb-2">
          <div
            v-for="(sub, i) in subcategories"
            :key="sub"
            class="flex items-center gap-1 rounded-full bg-amber/10 px-3 py-1.5"
          >
            <span class="text-[13px] font-medium text-amber-dark">{{ sub }}</span>
            <button
              v-if="!isDefault"
              class="text-amber-dark/60 hover:text-red-500"
              @click="removeSubcategory(i)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <button
            v-if="!isDefault && !addingSubcategory"
            class="rounded-full border border-dashed border-amber px-3 py-1.5 text-[13px] text-amber"
            @click="addingSubcategory = true"
          >
            + Add
          </button>
        </div>
        <div v-if="!isDefault && addingSubcategory" class="flex gap-2">
          <input
            v-model="newSubcategory"
            class="flex-1 rounded-xl border border-amber px-3 py-2 text-[14px] focus:outline-none"
            placeholder="Subcategory name"
            @keydown.enter="saveSubcategory"
            @keydown.escape="addingSubcategory = false"
          />
          <button class="rounded-xl bg-amber px-4 py-2 text-[13px] font-semibold text-white" @click="saveSubcategory">Add</button>
        </div>
        <p v-if="isDefault" class="text-[11px] text-muted">Default subcategories cannot be modified</p>
      </div>

      <p v-if="errorMsg" class="text-[13px] text-red-600">{{ errorMsg }}</p>

      <button
        class="h-[50px] w-full rounded-xl bg-amber text-[15px] font-semibold text-white disabled:opacity-50"
        :disabled="isSaving || (!isDefault && !name.trim())"
        @click="handleSave"
      >
        {{ isSaving ? 'Saving…' : 'Save changes' }}
      </button>

      <!-- Danger zone: custom categories only -->
      <div v-if="!isDefault" class="rounded-2xl border border-red-100 bg-red-50 p-4">
        <p class="mb-1 text-[14px] font-semibold text-red-700">Delete category</p>
        <p class="mb-3 text-[12px] text-red-600">Documents in this category will remain but won't be categorised.</p>
        <button
          class="h-10 w-full rounded-xl border border-red-300 text-[13px] font-semibold text-red-700 disabled:opacity-50"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Deleting…' : 'Delete category' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVaultStore } from '@/stores/vault';
import { categoriesApi } from '@/services/api/categories';
import { useAuthStore } from '@/stores/auth';
import { env } from '@/config/env';

const route = useRoute();
const router = useRouter();
const vaultStore = useVaultStore();
const authStore = useAuthStore();

const DEFAULT_IDS = new Set(['identity', 'financial', 'medical', 'property', 'vehicle', 'legal', 'educational', 'other']);
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

const categoryId = computed(() => route.params.id as string);
const category = computed(() => vaultStore.categories.find((c) => c.categoryId === categoryId.value));
const isDefault = computed(() => DEFAULT_IDS.has(categoryId.value));

const name = ref('');
const selectedIcon = ref('folder');
const selectedColour = ref(COLOURS[0]!);
const enabled = ref(true);
const subcategories = ref<string[]>([]);
const addingSubcategory = ref(false);
const newSubcategory = ref('');
const isSaving = ref(false);
const isDeleting = ref(false);
const errorMsg = ref<string | null>(null);

onMounted(() => {
  if (category.value) {
    name.value = category.value.name;
    selectedIcon.value = category.value.icon ?? 'folder';
    selectedColour.value = category.value.colour ?? COLOURS[0]!;
    enabled.value = category.value.enabled !== false;
    subcategories.value = [...(category.value.subcategories ?? [])];
  }
});

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
  isSaving.value = true;
  errorMsg.value = null;
  try {
    if (isDefault.value) {
      await categoriesApi.update(categoryId.value, { enabled: enabled.value });
    } else {
      await categoriesApi.update(categoryId.value, {
        name: name.value.trim(),
        icon: selectedIcon.value,
        colour: selectedColour.value,
        subcategories: subcategories.value,
        enabled: enabled.value,
      });
    }
    await vaultStore.loadVault();
    void router.back();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to save';
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete(): Promise<void> {
  if (!confirm(`Delete "${category.value?.name}"? This cannot be undone.`)) return;
  isDeleting.value = true;
  try {
    const token = await authStore.getAccessToken();
    const res = await fetch(`${env.apiUrl}/v1/categories/${categoryId.value}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await vaultStore.loadVault();
    void router.push('/settings/categories');
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to delete';
  } finally {
    isDeleting.value = false;
  }
}
</script>
