<template>
  <div v-if="authStore.isLoading" class="min-h-screen bg-cream flex items-center justify-center">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-muted text-sm">Loading FamilyVault...</p>
    </div>
  </div>

  <template v-else>
    <OfflineBanner />
    <RouterView />
    <BottomNav />
    <InstallBanner />
  </template>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useOnlineStatus } from '@/composables/useOnlineStatus';
import { useDarkMode } from '@/composables/useDarkMode';
import BottomNav from '@/components/BottomNav.vue';
import OfflineBanner from '@/components/OfflineBanner.vue';
import InstallBanner from '@/components/InstallBanner.vue';

const authStore = useAuthStore();
const appStore = useAppStore();

useOnlineStatus();
useDarkMode();

onMounted(() => {
  void authStore.loadUser();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appStore.setInstallPrompt(e as unknown as Parameters<typeof appStore.setInstallPrompt>[0]);
  });
});
</script>
