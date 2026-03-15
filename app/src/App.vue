<template>
  <div v-if="authStore.isLoading" class="min-h-screen bg-cream flex items-center justify-center">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-muted text-sm">Loading FamilyVault...</p>
    </div>
  </div>
  <RouterView v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  void authStore.loadUser();
});
</script>
