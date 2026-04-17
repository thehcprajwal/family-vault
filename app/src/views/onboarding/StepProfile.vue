<template>
  <div class="space-y-6">
    <!-- Avatar preview -->
    <div class="flex flex-col items-center gap-4">
      <div
        class="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-bold text-white"
        :style="{ backgroundColor: selectedColour }"
      >
        {{ displayName.trim().charAt(0).toUpperCase() || '?' }}
      </div>

      <!-- Colour picker -->
      <div class="flex gap-3">
        <button
          v-for="colour in colours"
          :key="colour"
          class="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
          :style="{ backgroundColor: colour }"
          @click="selectedColour = colour"
        >
          <svg
            v-if="selectedColour === colour"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Name input -->
    <div>
      <label class="mb-1.5 block text-[13px] font-medium text-muted">Your name</label>
      <input
        v-model="displayName"
        type="text"
        placeholder="e.g. Prajwal"
        class="w-full rounded-xl border border-[#E2CEBC] bg-white px-4 py-3 text-[15px] text-dark placeholder:text-muted focus:border-[#B86C2F] focus:outline-none"
        @input="emit('valid', displayName.trim().length > 0)"
      />
      <p class="mt-1 text-[12px] text-muted">This is how you appear to family members</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { updateUserAttribute } from 'aws-amplify/auth';
import { useAuthStore } from '@/stores/auth';

const emit = defineEmits<{ valid: [value: boolean] }>();

const authStore = useAuthStore();
const displayName = ref('');
const selectedColour = ref('#185FA5');

const colours = ['#185FA5', '#993C1D', '#3B6D11', '#854F0B', '#6B3FA0', '#0F6E56'];

watch(displayName, (val) => {
  emit('valid', val.trim().length > 0);
});

async function save(): Promise<void> {
  if (import.meta.env.VITE_DEV_MOCK === 'true') {
    if (authStore.user) authStore.user.displayName = displayName.value;
    return;
  }
  await updateUserAttribute({
    userAttribute: { attributeKey: 'given_name', value: displayName.value },
  });
  if (authStore.user) authStore.user.displayName = displayName.value;
}

defineExpose({ save });
</script>
