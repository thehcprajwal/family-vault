import { ref } from 'vue';
import { defineStore } from 'pinia';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'fv_install_dismissed';

export const useAppStore = defineStore('app', () => {
  const isOffline = ref(false);
  const installPromptEvent = ref<BeforeInstallPromptEvent | null>(null);
  const showInstallBanner = ref(false);

  function setOffline(val: boolean): void {
    isOffline.value = val;
  }

  function setInstallPrompt(event: BeforeInstallPromptEvent): void {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    installPromptEvent.value = event;
    showInstallBanner.value = true;
  }

  function dismissInstallBanner(): void {
    showInstallBanner.value = false;
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function triggerInstall(): Promise<void> {
    if (!installPromptEvent.value) return;
    await installPromptEvent.value.prompt();
    await installPromptEvent.value.userChoice;
    showInstallBanner.value = false;
    installPromptEvent.value = null;
  }

  return {
    isOffline,
    installPromptEvent,
    showInstallBanner,
    setOffline,
    setInstallPrompt,
    dismissInstallBanner,
    triggerInstall,
  };
});
