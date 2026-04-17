<template>
  <div class="min-h-screen bg-cream pb-24">
    <div class="sticky top-0 z-10 border-b border-muted-light bg-cream px-4 py-3">
      <h1 class="text-[17px] font-semibold text-dark">Settings</h1>
    </div>

    <div class="p-4 space-y-5">
      <!-- Profile card -->
      <div class="rounded-2xl border border-muted-light bg-white p-4">
        <div class="flex items-center gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber text-[22px] font-bold text-white">
            {{ (authStore.user?.displayName ?? '?').charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[16px] font-semibold text-dark truncate">{{ authStore.user?.displayName }}</p>
            <p class="text-[13px] text-muted truncate">{{ authStore.user?.email }}</p>
            <span
              class="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="authStore.user?.role === 'owner' ? 'bg-amber/15 text-amber-dark' : 'bg-muted-light text-muted'"
            >
              {{ authStore.user?.role === 'owner' ? 'Owner' : 'Member' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Vault section (owner only) -->
      <div v-if="isOwner" class="rounded-2xl border border-muted-light bg-white overflow-hidden">
        <p class="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted">Vault</p>

        <button class="flex w-full items-center gap-3 px-4 py-3.5 border-b border-muted-light/60" @click="router.push('/settings/family')">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-[18px]">👨‍👩‍👧‍👦</div>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-[14px] font-semibold text-dark">Family Members</p>
            <p class="text-[12px] text-muted">{{ vaultStore.persons.length }} member{{ vaultStore.persons.length === 1 ? '' : 's' }}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        <button class="flex w-full items-center gap-3 px-4 py-3.5 border-b border-muted-light/60" @click="router.push('/settings/categories')">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-[18px]">📂</div>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-[14px] font-semibold text-dark">Categories</p>
            <p class="text-[12px] text-muted">{{ defaultCategoryCount }} default · {{ customCategoryCount }} custom</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        <div class="flex items-center gap-3 px-4 py-3.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted-light text-[18px]">💾</div>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-[14px] font-semibold text-dark">Storage Used</p>
          </div>
          <p class="text-[13px] text-muted">Available</p>
        </div>
      </div>

      <!-- Preferences section -->
      <div class="rounded-2xl border border-muted-light bg-white overflow-hidden">
        <p class="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted">Preferences</p>

        <!-- Notifications toggle -->
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-muted-light/60">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-[18px]">🔔</div>
          <div class="flex-1">
            <p class="text-[14px] font-semibold text-dark">Notifications</p>
            <p class="text-[12px] text-muted">Expiry reminders and alerts</p>
          </div>
          <button
            class="relative h-7 w-12 rounded-full transition-colors"
            :class="notificationsEnabled ? 'bg-amber' : 'bg-muted-light'"
            @click="toggleNotifications"
          >
            <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform" :class="notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'" />
          </button>
        </div>

        <!-- Dark mode toggle -->
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-muted-light/60">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted-light text-[18px]">🌙</div>
          <div class="flex-1">
            <p class="text-[14px] font-semibold text-dark">Dark Mode</p>
          </div>
          <button
            class="relative h-7 w-12 rounded-full transition-colors"
            :class="darkMode.isDark.value ? 'bg-amber' : 'bg-muted-light'"
            @click="darkMode.toggle()"
          >
            <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform" :class="darkMode.isDark.value ? 'translate-x-5' : 'translate-x-0.5'" />
          </button>
        </div>

        <!-- Biometric toggle (UI only) -->
        <div class="flex items-center gap-3 px-4 py-3.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted-light text-[18px]">🔐</div>
          <div class="flex-1">
            <p class="text-[14px] font-semibold text-dark">Biometric Unlock</p>
            <p class="text-[12px] text-muted">Coming soon</p>
          </div>
          <button
            class="relative h-7 w-12 rounded-full transition-colors opacity-40 cursor-not-allowed"
            :class="biometricEnabled ? 'bg-amber' : 'bg-muted-light'"
          >
            <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform" :class="biometricEnabled ? 'translate-x-5' : 'translate-x-0.5'" />
          </button>
        </div>
      </div>

      <!-- Account section -->
      <div class="rounded-2xl border border-muted-light bg-white overflow-hidden">
        <p class="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted">Account</p>

        <a href="mailto:hcprajwal.cloud@gmail.com" class="flex items-center gap-3 px-4 py-3.5 border-b border-muted-light/60">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted-light text-[18px]">❓</div>
          <p class="flex-1 text-[14px] font-semibold text-dark text-left">Help &amp; Support</p>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M9 18l6-6-6-6" /></svg>
        </a>

        <button class="flex w-full items-center gap-3 px-4 py-3.5" @click="handleSignOut">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[18px]">🚪</div>
          <p class="flex-1 text-left text-[14px] font-semibold text-red-600">Sign Out</p>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';
import { useDarkMode } from '@/composables/useDarkMode';
import { registerPushSubscription } from '@/services/push';

const router = useRouter();
const authStore = useAuthStore();
const vaultStore = useVaultStore();
const darkMode = useDarkMode();

const DEFAULT_IDS = new Set(['identity', 'financial', 'medical', 'property', 'vehicle', 'legal', 'educational', 'other']);

const isOwner = computed(() => authStore.user?.role === 'owner');
const defaultCategoryCount = computed(() => vaultStore.categories.filter((c) => DEFAULT_IDS.has(c.categoryId)).length);
const customCategoryCount = computed(() => vaultStore.categories.filter((c) => !DEFAULT_IDS.has(c.categoryId)).length);

const notificationsEnabled = ref(localStorage.getItem('fv_notifications_enabled') === 'true');
const biometricEnabled = ref(localStorage.getItem('fv_biometric_enabled') === 'true');

async function toggleNotifications(): Promise<void> {
  const next = !notificationsEnabled.value;
  notificationsEnabled.value = next;
  localStorage.setItem('fv_notifications_enabled', String(next));
  if (next) {
    await registerPushSubscription().catch((err) => {
      console.warn('Push registration failed:', err);
    });
  }
}

async function handleSignOut(): Promise<void> {
  await authStore.logout();
  void router.push('/login');
}
</script>
