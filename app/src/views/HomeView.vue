<template>
  <div class="min-h-screen bg-cream p-6 pb-24">
    <div class="mx-auto max-w-md">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">Good morning</p>
          <h1 class="text-2xl font-semibold text-dark">FamilyVault</h1>
        </div>
        <button @click="handleLogout" class="text-sm font-semibold text-amber">
          Sign out
        </button>
      </div>

      <div class="mb-4 rounded-xl border border-muted-light bg-white p-4">
        <p class="mb-1 text-sm text-muted">Logged in as</p>
        <p class="font-semibold text-dark">{{ authStore.user?.email }}</p>
        <p class="mt-1 text-sm text-muted">Role: {{ authStore.user?.role }}</p>
        <p class="text-sm text-muted">Vault ID: {{ authStore.user?.vaultId }}</p>
      </div>

      <div class="mb-4 rounded-xl border border-muted-light bg-white p-4">
        <p class="mb-2 text-sm font-semibold text-dark">API Health Check</p>
        <p v-if="apiStatus === 'loading'" class="text-sm text-muted">Checking...</p>
        <p v-else-if="apiStatus === 'ok'" class="text-sm font-semibold text-sage">
          API reachable
        </p>
        <p v-else class="text-sm text-red-600">API error: {{ apiError }}</p>
      </div>

      <!-- Pending review banner -->
      <button
        v-if="classificationStore.pendingCount > 0"
        class="mb-4 flex w-full items-center justify-between rounded-xl bg-amber-light px-4 py-3"
        @click="router.push(`/review/${classificationStore.pending[0].documentId}`)"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-amber"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div class="text-left">
            <p class="text-[14px] font-semibold text-amber-dark">Documents to review</p>
            <p class="text-[12px] text-amber">Tap to confirm AI suggestions</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-amber text-[12px] font-bold text-white"
          >
            {{ classificationStore.pendingCount }}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-amber"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>

      <div class="rounded-[20px] bg-amber px-5 py-6 text-cream shadow-[0_18px_60px_rgba(153,60,29,0.18)]">
        <p class="text-sm uppercase tracking-[0.2em] text-cream/70">Sprint 1</p>
        <h2 class="mt-2 text-xl font-semibold">Vault shell is live</h2>
        <p class="mt-2 text-sm text-cream/80">
          Auth, API connectivity, PWA plumbing, and native sync scaffolding are in place.
        </p>
      </div>
    </div>

    <!-- FAB: Upload Document -->
    <button
      class="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-sage shadow-lg"
      @click="router.push('/upload')"
      aria-label="Upload document"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>

    <AppNav />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppNav from '@/components/AppNav.vue';
import { useHealthCheck } from '@/composables/useHealthCheck';
import { useAuthStore } from '@/stores/auth';
import { useClassificationStore } from '@/stores/classification';

const authStore = useAuthStore();
const router = useRouter();
const classificationStore = useClassificationStore();
const { apiStatus, apiError, run } = useHealthCheck();

onMounted(async () => {
  try {
    const token = await authStore.getAccessToken();
    await run(token);
  } catch (err) {
    apiStatus.value = 'error';
    apiError.value = err instanceof Error ? err.message : String(err);
  }
});

async function handleLogout() {
  await authStore.logout();
  await router.push('/login');
}
</script>
