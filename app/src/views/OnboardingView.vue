<template>
  <div class="min-h-screen bg-cream">
    <!-- Header -->
    <div class="px-5 pt-12 pb-6">
      <button
        v-if="currentStep > 1"
        class="mb-6 flex items-center gap-2 text-[14px] text-muted"
        @click="currentStep--"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <!-- Progress dots -->
      <div class="mb-6 flex items-center gap-2">
        <div
          v-for="n in 3"
          :key="n"
          class="h-2 rounded-full transition-all duration-300"
          :class="currentStep === n ? 'w-6 bg-[#B86C2F]' : 'w-2 bg-[#E2CEBC]'"
        />
      </div>

      <h1 class="text-[22px] font-bold text-dark">{{ STEP_TITLES[currentStep] }}</h1>
      <p class="mt-1 text-[14px] text-muted">{{ STEP_SUBTITLES[currentStep] }}</p>
    </div>

    <!-- Step content -->
    <div class="px-5 pb-32">
      <StepProfile
        v-if="currentStep === 1"
        ref="stepProfileRef"
        @valid="stepIsValid = $event"
      />
      <StepFamily
        v-else-if="currentStep === 2"
        @valid="stepIsValid = $event"
      />
      <StepCategories
        v-else-if="currentStep === 3"
        @valid="stepIsValid = $event"
      />
    </div>

    <!-- Bottom action bar -->
    <div class="fixed bottom-0 left-0 right-0 border-t border-[#E2CEBC] bg-[#FFFBF5] px-5 py-4" style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
      <p v-if="error" class="mb-3 text-[13px] text-red-600">{{ error }}</p>
      <button
        class="w-full rounded-xl bg-[#B86C2F] py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        :disabled="!stepIsValid || isSubmitting"
        @click="handleAction"
      >
        <span v-if="isSubmitting">Saving...</span>
        <span v-else-if="currentStep < 3">Continue</span>
        <span v-else>Finish setup</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import StepProfile from '@/views/onboarding/StepProfile.vue';
import StepFamily from '@/views/onboarding/StepFamily.vue';
import StepCategories from '@/views/onboarding/StepCategories.vue';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';

const router = useRouter();
const authStore = useAuthStore();
const vaultStore = useVaultStore();

const currentStep = ref<1 | 2 | 3>(1);
const stepIsValid = ref(false);
const isSubmitting = ref(false);
const error = ref('');

const stepProfileRef = ref<InstanceType<typeof StepProfile> | null>(null);

const STEP_TITLES: Record<number, string> = {
  1: 'Set up your profile',
  2: 'Add family members',
  3: 'Choose categories',
};

const STEP_SUBTITLES: Record<number, string> = {
  1: 'Tell us your name so family members can identify you',
  2: 'Who do you manage documents for?',
  3: 'Select the document types you want to track',
};

async function handleAction(): Promise<void> {
  if (isSubmitting.value) return;
  error.value = '';

  if (currentStep.value === 1) {
    isSubmitting.value = true;
    try {
      await stepProfileRef.value?.save();
      currentStep.value = 2;
      stepIsValid.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save profile';
    } finally {
      isSubmitting.value = false;
    }
    return;
  }

  if (currentStep.value === 2) {
    currentStep.value = 3;
    stepIsValid.value = true;
    return;
  }

  // Step 3 — finish
  isSubmitting.value = true;
  try {
    if (import.meta.env.VITE_DEV_MOCK !== 'true') {
      const token = await authStore.getAccessToken();
      const response = await fetch(`${env.apiUrl}/v1/vault/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }
    vaultStore.onboardingComplete = true;
    await router.push('/');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to complete setup';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
