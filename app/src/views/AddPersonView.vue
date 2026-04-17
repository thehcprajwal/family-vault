<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Add Family Member</h1>
    </div>

    <div class="p-4 space-y-5">
      <!-- Avatar preview + colour picker -->
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-bold text-white" :style="{ backgroundColor: selectedColour }">
          {{ displayName.charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="flex gap-2">
          <button
            v-for="c in COLOURS"
            :key="c"
            class="h-8 w-8 rounded-full transition-transform"
            :style="{ backgroundColor: c, outline: selectedColour === c ? '2px solid #B86C2F' : 'none', outlineOffset: '2px' }"
            @click="selectedColour = c"
          />
        </div>
      </div>

      <!-- Name -->
      <div>
        <label class="mb-1 block text-[13px] font-semibold text-dark">Name *</label>
        <input v-model="displayName" type="text" placeholder="Full name" class="h-12 w-full rounded-xl border border-muted-light bg-white px-4 text-[15px] text-dark focus:border-amber focus:outline-none" />
      </div>

      <!-- Relationship -->
      <div>
        <label class="mb-2 block text-[13px] font-semibold text-dark">Relationship *</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="rel in RELATIONSHIPS"
            :key="rel"
            class="rounded-xl py-2.5 text-[13px] font-medium capitalize transition-colors"
            :class="relationship === rel ? 'bg-amber text-white' : 'border border-muted-light bg-white text-dark'"
            @click="relationship = rel"
          >
            {{ rel }}
          </button>
        </div>
      </div>

      <!-- Optional email -->
      <div>
        <label class="mb-1 block text-[13px] font-semibold text-dark">Email (optional)</label>
        <input v-model="email" type="email" placeholder="Send app invite" class="h-12 w-full rounded-xl border border-muted-light bg-white px-4 text-[15px] text-dark focus:border-amber focus:outline-none" />
        <p class="mt-1 text-[12px] text-muted">We'll send them a link to join the vault</p>
      </div>

      <!-- Error -->
      <p v-if="errorMsg" class="text-[13px] text-red-600">{{ errorMsg }}</p>

      <!-- Submit -->
      <button
        class="h-[50px] w-full rounded-xl bg-amber text-[15px] font-semibold text-white disabled:opacity-50"
        :disabled="!displayName.trim() || !relationship || isSaving"
        @click="handleAdd"
      >
        <span v-if="isSaving">Adding…</span>
        <span v-else>Add {{ displayName || 'person' }} to Family</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useVaultStore } from '@/stores/vault';

const router = useRouter();
const vaultStore = useVaultStore();

const COLOURS = ['#185FA5', '#993C1D', '#3B6D11', '#854F0B', '#6B3FA0', '#0F6E56'];
const RELATIONSHIPS = ['father', 'mother', 'brother', 'sister', 'spouse', 'child', 'grandparent', 'other'];

const displayName = ref('');
const relationship = ref('');
const selectedColour = ref(COLOURS[0]!);
const email = ref('');
const isSaving = ref(false);
const errorMsg = ref<string | null>(null);

async function handleAdd(): Promise<void> {
  if (!displayName.value.trim() || !relationship.value) return;
  isSaving.value = true;
  errorMsg.value = null;
  try {
    await vaultStore.addPerson({ displayName: displayName.value.trim(), relationship: relationship.value });
    void router.back();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to add person';
  } finally {
    isSaving.value = false;
  }
}
</script>
