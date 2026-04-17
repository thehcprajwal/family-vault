<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Edit Member</h1>
    </div>

    <div v-if="person" class="p-4 space-y-5">
      <!-- Avatar preview -->
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-bold text-white" :style="{ backgroundColor: selectedColour }">
          {{ displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="flex gap-2">
          <button
            v-for="c in COLOURS"
            :key="c"
            class="h-8 w-8 rounded-full"
            :style="{ backgroundColor: c, outline: selectedColour === c ? '2px solid #B86C2F' : 'none', outlineOffset: '2px' }"
            @click="selectedColour = c"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-[13px] font-semibold text-dark">Name</label>
        <input v-model="displayName" type="text" class="h-12 w-full rounded-xl border border-muted-light bg-white px-4 text-[15px] text-dark focus:border-amber focus:outline-none" />
      </div>

      <div>
        <label class="mb-2 block text-[13px] font-semibold text-dark">Relationship</label>
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

      <p v-if="errorMsg" class="text-[13px] text-red-600">{{ errorMsg }}</p>

      <button
        class="h-[50px] w-full rounded-xl bg-amber text-[15px] font-semibold text-white disabled:opacity-50"
        :disabled="isSaving"
        @click="handleSave"
      >
        {{ isSaving ? 'Saving…' : 'Save changes' }}
      </button>

      <!-- Danger zone -->
      <div class="rounded-2xl border border-red-100 bg-red-50 p-4">
        <p class="mb-1 text-[14px] font-semibold text-red-700">Remove from family</p>
        <p class="mb-3 text-[12px] text-red-600">Their documents will remain in the vault but won't be linked to anyone.</p>
        <button
          class="h-10 w-full rounded-xl border border-red-300 text-[13px] font-semibold text-red-700 disabled:opacity-50"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Removing…' : 'Remove from family' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVaultStore } from '@/stores/vault';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const vaultStore = useVaultStore();
const authStore = useAuthStore();

const COLOURS = ['#185FA5', '#993C1D', '#3B6D11', '#854F0B', '#6B3FA0', '#0F6E56'];
const RELATIONSHIPS = ['father', 'mother', 'brother', 'sister', 'spouse', 'child', 'grandparent', 'other'];

const personId = computed(() => route.params.id as string);
const person = computed(() => vaultStore.persons.find((p) => p.personId === personId.value));

const displayName = ref('');
const relationship = ref('');
const selectedColour = ref(COLOURS[0]!);
const isSaving = ref(false);
const isDeleting = ref(false);
const errorMsg = ref<string | null>(null);

onMounted(() => {
  if (person.value) {
    displayName.value = person.value.displayName;
    relationship.value = person.value.relationship ?? '';
  }
});

async function handleSave(): Promise<void> {
  isSaving.value = true;
  errorMsg.value = null;
  try {
    const token = await authStore.getAccessToken();
    await fetch(`${env.apiUrl}/v1/persons/${personId.value}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: displayName.value, relationship: relationship.value, avatarColour: selectedColour.value }),
    });
    // Reload vault to reflect changes
    await vaultStore.loadVault();
    void router.back();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to save';
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete(): Promise<void> {
  if (!confirm(`Remove ${person.value?.displayName} from the family?`)) return;
  isDeleting.value = true;
  try {
    const token = await authStore.getAccessToken();
    await fetch(`${env.apiUrl}/v1/persons/${personId.value}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await vaultStore.loadVault();
    void router.push('/settings/family');
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to remove';
  } finally {
    isDeleting.value = false;
  }
}
</script>
