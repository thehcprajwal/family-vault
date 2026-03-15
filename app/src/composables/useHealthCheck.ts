import { ref } from 'vue';
import { fetchHealthStatus } from '@/services/api/health';

export function useHealthCheck() {
  const apiStatus = ref<'loading' | 'ok' | 'error'>('loading');
  const apiError = ref('');

  async function run(accessToken: string): Promise<void> {
    apiStatus.value = 'loading';
    apiError.value = '';

    try {
      await fetchHealthStatus(accessToken);
      apiStatus.value = 'ok';
    } catch (error) {
      apiStatus.value = 'error';
      apiError.value = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    apiStatus,
    apiError,
    run,
  };
}
