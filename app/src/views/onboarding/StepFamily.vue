<template>
  <div class="space-y-5">
    <!-- Added persons chips -->
    <div v-if="addedPersons.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="person in addedPersons"
        :key="person.displayName"
        class="flex items-center gap-2 rounded-full bg-[#EAF3DE] px-3 py-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span class="text-[13px] font-medium text-[#3B6D11]">{{ person.displayName }}</span>
        <span class="rounded-full bg-[#3B6D11]/10 px-2 py-0.5 text-[11px] text-[#3B6D11]">{{ person.relationship }}</span>
      </div>
    </div>

    <!-- Add person form -->
    <div class="rounded-2xl border border-[#E2CEBC] bg-white p-4 space-y-4">
      <div>
        <label class="mb-1.5 block text-[13px] font-medium text-muted">Name</label>
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. Appa"
          class="w-full rounded-xl border border-[#E2CEBC] bg-white px-4 py-3 text-[15px] text-dark placeholder:text-muted focus:border-[#B86C2F] focus:outline-none"
        />
      </div>

      <div>
        <label class="mb-2 block text-[13px] font-medium text-muted">Relationship</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="rel in relationships"
            :key="rel"
            class="rounded-xl border py-2.5 text-[13px] font-medium transition-colors"
            :class="newRelationship === rel
              ? 'border-[#B86C2F] bg-[#B86C2F]/10 text-[#B86C2F]'
              : 'border-[#E2CEBC] text-dark'"
            @click="newRelationship = rel"
          >
            {{ rel }}
          </button>
        </div>
      </div>

      <button
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-sage py-3 text-[14px] font-semibold text-white disabled:opacity-50"
        :disabled="!newName.trim() || !newRelationship || isAdding"
        @click="addPerson"
      >
        <span v-if="isAdding">Adding...</span>
        <span v-else>+ Add this person</span>
      </button>

      <p v-if="addError" class="text-[13px] text-red-600">{{ addError }}</p>
    </div>

    <p class="text-center text-[13px] text-muted">You can add more family members later</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useVaultStore } from '@/stores/vault';

const emit = defineEmits<{ valid: [value: boolean] }>();
emit('valid', true);

const vaultStore = useVaultStore();
const newName = ref('');
const newRelationship = ref('');
const isAdding = ref(false);
const addError = ref('');
const addedPersons = ref<{ displayName: string; relationship: string }[]>([]);

const relationships = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Child', 'Other'];

async function addPerson(): Promise<void> {
  if (!newName.value.trim() || !newRelationship.value) return;
  isAdding.value = true;
  addError.value = '';
  try {
    await vaultStore.addPerson({
      displayName: newName.value.trim(),
      relationship: newRelationship.value,
    });
    addedPersons.value.push({ displayName: newName.value.trim(), relationship: newRelationship.value });
    newName.value = '';
    newRelationship.value = '';
  } catch (err) {
    addError.value = err instanceof Error ? err.message : 'Failed to add person';
  } finally {
    isAdding.value = false;
  }
}
</script>
