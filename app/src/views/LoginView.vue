<template>
  <div class="min-h-screen bg-cream">
    <div
      class="flex min-h-[45vh] flex-col items-center justify-center px-8 text-center text-white"
      :style="{ backgroundColor: isNewPasswordFlow ? '#5C7A4E' : '#B86C2F' }"
    >
      <div class="mb-5 rounded-[26px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
        <svg
          class="h-12 w-12 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.25 9.75V20a1 1 0 0 0 1 1h3.75v-6.5h4V21h3.75a1 1 0 0 0 1-1V9.75" />
        </svg>
      </div>
      <template v-if="!isNewPasswordFlow">
        <h1 class="text-[30px] font-bold leading-none">FamilyVault</h1>
        <p class="mt-3 max-w-xs text-sm text-white/80">
          Your family's documents, safe and always findable.
        </p>
      </template>
      <template v-else>
        <h1 class="text-[30px] font-bold leading-none">Welcome!</h1>
        <p class="mt-2 text-base text-white/90">{{ form.email }}</p>
        <p class="mt-3 text-sm text-white/80">Set a password to get started</p>
      </template>
    </div>

    <div class="min-h-[55vh] bg-cream px-7 py-8">
      <div class="mx-auto max-w-md">
        <div
          v-if="displayError"
          class="mb-5 flex items-start gap-3 rounded-[13px] border border-[#F5C0C0] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]"
        >
          <svg
            class="mt-0.5 h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 10v5" />
            <path d="M12 7.5h.01" />
          </svg>
          <span>{{ displayError }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <template v-if="!isNewPasswordFlow">
            <div>
              <label class="mb-2 block text-sm font-medium text-dark" for="email">Email</label>
              <input
                id="email"
                v-model.trim="form.email"
                type="email"
                autocomplete="email"
                class="fv-input"
                :class="fieldErrorClass(errors.email)"
              />
              <p v-if="errors.email" class="mt-2 text-sm text-red-600">{{ errors.email }}</p>
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium text-dark" for="password">Password</label>
              <div class="relative">
                <input
                  id="password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  class="fv-input pr-12"
                  :class="fieldErrorClass(errors.password)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
                  @click="showPassword = !showPassword"
                >
                  <svg
                    v-if="!showPassword"
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg
                    v-else
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 16a2 2 0 0 0 1.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-4.09 4.95" />
                    <path d="M6.61 6.61A17.32 17.32 0 0 0 2.5 12s3.5 7 9.5 7a10.6 10.6 0 0 0 3.1-.46" />
                  </svg>
                </button>
              </div>
              <p v-if="errors.password" class="mt-2 text-sm text-red-600">{{ errors.password }}</p>
            </div>

            <div class="text-right">
              <button type="button" class="text-[13px] font-medium text-amber">Forgot password?</button>
            </div>

            <button type="submit" class="fv-btn-primary" :disabled="isSubmitting">
              <span v-if="isSubmitting">Signing In...</span>
              <span v-else>Sign In</span>
            </button>
          </template>

          <template v-else>
            <div>
              <label class="mb-2 block text-sm font-medium text-dark" for="new-password">
                New Password
              </label>
              <div class="relative">
                <input
                  id="new-password"
                  v-model="form.newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="fv-input pr-12"
                  :class="fieldErrorClass(errors.newPassword)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
                  @click="showNewPassword = !showNewPassword"
                >
                  <svg
                    v-if="!showNewPassword"
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg
                    v-else
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 16a2 2 0 0 0 1.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-4.09 4.95" />
                    <path d="M6.61 6.61A17.32 17.32 0 0 0 2.5 12s3.5 7 9.5 7a10.6 10.6 0 0 0 3.1-.46" />
                  </svg>
                </button>
              </div>
              <p v-if="errors.newPassword" class="mt-2 text-sm text-red-600">{{ errors.newPassword }}</p>
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium text-dark" for="confirm-password">
                Confirm Password
              </label>
              <div class="relative">
                <input
                  id="confirm-password"
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="fv-input pr-12"
                  :class="fieldErrorClass(errors.confirmPassword)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <svg
                    v-if="!showConfirmPassword"
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg
                    v-else
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 16a2 2 0 0 0 1.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-4.09 4.95" />
                    <path d="M6.61 6.61A17.32 17.32 0 0 0 2.5 12s3.5 7 9.5 7a10.6 10.6 0 0 0 3.1-.46" />
                  </svg>
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="mt-2 text-sm text-red-600">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <div>
              <div class="mb-2 flex gap-2">
                <div
                  v-for="segment in 4"
                  :key="segment"
                  class="h-2 flex-1 rounded-full"
                  :class="segment <= passwordStrength.score ? passwordStrength.color : 'bg-[#E2CEBC]'"
                />
              </div>
              <p class="text-sm text-muted">{{ passwordStrength.label }}</p>
            </div>

            <button type="submit" class="fv-btn-primary !bg-sage" :disabled="isSubmitting">
              <span v-if="isSubmitting">Setting Password...</span>
              <span v-else>Set Password &amp; Enter</span>
            </button>
          </template>
        </form>

        <p class="mt-8 text-center text-[13px] text-muted">
          First time? Ask Prajwal to invite you.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

type LoginErrors = {
  email?: string;
  password?: string;
  newPassword?: string;
  confirmPassword?: string;
};

const authStore = useAuthStore();
const router = useRouter();
const isSubmitting = ref(false);
const isNewPasswordFlow = ref(false);
const showPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const localError = ref('');

const form = reactive({
  email: '',
  password: '',
  newPassword: '',
  confirmPassword: '',
});

const errors = reactive<LoginErrors>({});

const passwordStrength = computed(() => {
  const password = form.newPassword;
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;

  if (score <= 1) {
    return { score, color: 'bg-red-400', label: 'Use at least 8 characters and one digit.' };
  }

  if (score <= 3) {
    return {
      score,
      color: 'bg-amber',
      label: 'Decent start. Add more variety for a stronger password.',
    };
  }

  return { score, color: 'bg-sage', label: 'Strong password.' };
});

const displayError = computed(() => localError.value || authStore.error);

onMounted(async () => {
  await authStore.loadUser();
  if (authStore.isAuthenticated) {
    await router.push('/');
  }
});

function resetErrors() {
  errors.email = '';
  errors.password = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
  localError.value = '';
}

function fieldErrorClass(value?: string) {
  return value ? '!border-red-400' : '';
}

function validateLoginForm(): boolean {
  resetErrors();

  if (!form.email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.password) {
    errors.password = 'Password is required.';
  }

  return !errors.email && !errors.password;
}

function validateNewPasswordForm(): boolean {
  resetErrors();

  if (!form.newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (form.newPassword.length < 8 || !/[0-9]/.test(form.newPassword)) {
    errors.newPassword = 'Password must be at least 8 characters and contain one digit.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return !errors.newPassword && !errors.confirmPassword;
}

async function handleSubmit() {
  if (isSubmitting.value) {
    return;
  }

  const isValid = isNewPasswordFlow.value ? validateNewPasswordForm() : validateLoginForm();
  if (!isValid) {
    return;
  }

  isSubmitting.value = true;
  localError.value = '';

  try {
    if (!isNewPasswordFlow.value) {
      const result = await authStore.login({
        username: form.email,
        password: form.password,
      });

      if (result.requiresNewPassword) {
        isNewPasswordFlow.value = true;
        form.password = '';
        return;
      }

      await router.push('/');
      return;
    }

    await authStore.setNewPassword(form.newPassword);
    await router.push('/');
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Authentication failed.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
