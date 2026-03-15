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

      <div class="rounded-[20px] bg-amber px-5 py-6 text-cream shadow-[0_18px_60px_rgba(153,60,29,0.18)]">
        <p class="text-sm uppercase tracking-[0.2em] text-cream/70">Sprint 1</p>
        <h2 class="mt-2 text-xl font-semibold">Vault shell is live</h2>
        <p class="mt-2 text-sm text-cream/80">
          Auth, API connectivity, PWA plumbing, and native sync scaffolding are in place.
        </p>
      </div>
    </div>

    <AppNav />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppNav from '@/components/AppNav.vue';
import { useHealthCheck } from '@/composables/useHealthCheck';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
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
