<template>
  <div class="min-h-screen bg-cream">
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-muted-light bg-cream px-4 py-3">
      <button class="flex h-9 w-9 items-center justify-center rounded-full" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Family Members</h1>
      <button v-if="isOwner" class="text-[14px] font-semibold text-amber" @click="router.push('/settings/family/add')">
        + Add
      </button>
      <div v-else class="w-9" />
    </div>

    <div class="p-4 space-y-2">
      <div
        v-for="person in vaultStore.persons"
        :key="person.personId"
        class="flex items-center gap-3 rounded-2xl border border-muted-light bg-white p-4"
        :class="isOwner ? 'cursor-pointer' : ''"
        @click="isOwner && router.push(`/settings/family/${person.personId}/edit`)"
      >
        <!-- Avatar -->
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber/20 text-[16px] font-bold text-amber">
          {{ person.displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[15px] font-semibold text-dark">{{ person.displayName }}</p>
          <p class="text-[12px] text-muted capitalize">{{ person.relationship ?? 'Family member' }}</p>
        </div>
        <svg v-if="isOwner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
      </div>

      <div v-if="vaultStore.persons.length === 0" class="flex flex-col items-center py-12 text-center">
        <p class="text-[15px] font-semibold text-dark">No family members yet</p>
        <p class="mt-1 text-[13px] text-muted">Add family members to organize documents by person</p>
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
const isOwner = computed(() => authStore.user?.role === 'owner');
</script>
