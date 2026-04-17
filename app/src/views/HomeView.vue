<template>
  <div class="min-h-screen bg-cream pb-24">
    <!-- Header -->
    <div class="sticky top-0 z-10 border-b border-muted-light bg-cream px-4 pb-3 pt-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[12px] uppercase tracking-wide text-muted">FamilyVault</p>
          <h1 class="text-[20px] font-semibold text-dark">My Library</h1>
        </div>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full border border-muted-light bg-white"
          @click="router.push('/settings')"
          aria-label="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>

    <div class="p-4">
      <DocumentLibraryView />
    </div>

    <!-- Push notification bottom sheet -->
    <Transition name="slide-up">
      <div v-if="showPushSheet" class="fixed inset-0 z-50 flex items-end" @click.self="dismissPush">
        <div class="w-full rounded-t-3xl bg-white px-6 pb-10 pt-6 shadow-2xl">
          <div class="mb-1 flex justify-center">
            <div class="h-1 w-10 rounded-full bg-muted-light" />
          </div>
          <div class="mt-4 flex flex-col items-center text-center">
            <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber/10 text-[32px]">🔔</div>
            <h2 class="text-[18px] font-semibold text-dark">Stay on top of expiry dates</h2>
            <p class="mt-2 text-[14px] text-muted">Get notified when documents need renewal or classification</p>
          </div>
          <div class="mt-6 space-y-3">
            <button class="h-[50px] w-full rounded-xl bg-amber text-[15px] font-semibold text-white" @click="enablePush">
              Enable Notifications
            </button>
            <button class="h-[50px] w-full rounded-xl text-[15px] text-muted" @click="dismissPush">
              Not now
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DocumentLibraryView from '@/views/DocumentLibraryView.vue';
import { registerPushSubscription } from '@/services/push';

const router = useRouter();
const showPushSheet = ref(false);

onMounted(() => {
  const alreadyPrompted = localStorage.getItem('fv_push_prompted');
  if (!alreadyPrompted && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    setTimeout(() => {
      showPushSheet.value = true;
    }, 3000);
  }
});

async function enablePush(): Promise<void> {
  showPushSheet.value = false;
  localStorage.setItem('fv_push_prompted', 'granted');
  await registerPushSubscription().catch((err) => {
    console.warn('Push registration failed:', err instanceof Error ? err.message : err);
  });
}

function dismissPush(): void {
  showPushSheet.value = false;
  localStorage.setItem('fv_push_prompted', 'dismissed');
}
</script>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}
</style>
