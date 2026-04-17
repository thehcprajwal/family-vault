<template>
  <nav
    v-if="!route.meta.hideNav"
    class="fixed bottom-0 left-0 right-0 flex items-end border-t border-[#E2CEBC] bg-[#FFFBF5]"
    style="height: 70px; padding-bottom: env(safe-area-inset-bottom)"
  >
    <!-- Home tab -->
    <button
      class="relative flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-3"
      @click="router.push('/')"
    >
      <span v-if="hasExpiredDocs" class="absolute right-[calc(50%-14px)] top-2 h-2 w-2 rounded-full bg-red-500" />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="isHome ? '#B86C2F' : '#A08060'"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <span class="text-[11px]" :class="isHome ? 'font-semibold text-[#B86C2F]' : 'text-muted'">Home</span>
    </button>

    <!-- Upload FAB -->
    <div class="flex flex-1 flex-col items-center" style="margin-top: -28px">
      <button
        class="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#B86C2F] shadow-lg"
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
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>

    <!-- Search tab -->
    <button
      class="flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-3"
      @click="router.push('/search')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="isSearch ? '#B86C2F' : '#A08060'"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span class="text-[11px]" :class="isSearch ? 'font-semibold text-[#B86C2F]' : 'text-muted'">Search</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useExpiryStore } from '@/stores/expiry';

const route = useRoute();
const router = useRouter();
const expiryStore = useExpiryStore();

const isHome = computed(() => route.name === 'home');
const isSearch = computed(() => route.name === 'search');
const hasExpiredDocs = computed(() => expiryStore.expiredCount > 0);
</script>
