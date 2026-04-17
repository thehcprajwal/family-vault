import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useExpiryStore = defineStore('expiry', () => {
  const expiredCount = ref(0);

  function setExpiredCount(count: number): void {
    expiredCount.value = count;
  }

  return { expiredCount, setExpiredCount };
});
