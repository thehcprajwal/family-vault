<template>
  <div
    v-if="appStore.showInstallBanner"
    class="fixed bottom-[70px] left-0 right-0 z-40 border-t border-[#E2CEBC] bg-[#FFFBF5] px-5 py-4 shadow-lg"
  >
    <div class="flex items-center gap-4">
      <img src="/icons/icon-72.png" alt="FamilyVault" class="h-12 w-12 rounded-xl" />
      <div class="flex-1">
        <p class="text-[15px] font-semibold text-dark">Install FamilyVault</p>
        <p class="text-[13px] text-muted">Add to home screen for quick access</p>
      </div>
    </div>
    <div class="mt-4 flex gap-3">
      <button
        class="flex-1 rounded-xl bg-[#B86C2F] py-2.5 text-[14px] font-semibold text-white"
        @click="appStore.triggerInstall()"
      >
        Install
      </button>
      <button
        class="rounded-xl border border-[#E2CEBC] px-4 py-2.5 text-[14px] text-muted"
        @click="appStore.dismissInstallBanner()"
      >
        Dismiss
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
</script>
