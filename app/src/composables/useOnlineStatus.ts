import { onMounted, onUnmounted } from 'vue';
import { useAppStore } from '@/stores/app';

export function useOnlineStatus(): void {
  const appStore = useAppStore();

  const handleOnline = () => appStore.setOffline(false);
  const handleOffline = () => appStore.setOffline(true);

  onMounted(() => {
    appStore.setOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });
}
