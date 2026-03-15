import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  type SignInInput,
} from 'aws-amplify/auth';
import type { AuthUser } from '@/types/auth';

function toAuthUser(claims: Record<string, unknown>, userId: string): AuthUser {
  return {
    sub: userId,
    email: String(claims.email),
    vaultId: String(claims['custom:vaultId']),
    role: String(claims['custom:role']) as AuthUser['role'],
    displayName: String(claims.given_name ?? claims.email),
  };
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => user.value !== null);
  const isOwner = computed(() => user.value?.role === 'owner');

  async function loadUser(): Promise<void> {
    isLoading.value = true;
    try {
      const cognitoUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const claims = session.tokens?.idToken?.payload;

      if (!claims) {
        throw new Error('No token claims');
      }

      user.value = toAuthUser(claims, cognitoUser.userId);
    } catch {
      user.value = null;
      error.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function login(input: SignInInput): Promise<{ requiresNewPassword: boolean }> {
    error.value = null;
    try {
      const result = await signIn(input);

      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        return { requiresNewPassword: true };
      }

      await loadUser();
      return { requiresNewPassword: false };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    }
  }

  async function setNewPassword(newPassword: string): Promise<void> {
    error.value = null;
    try {
      await confirmSignIn({ challengeResponse: newPassword });
      await loadUser();
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to set password';
      throw err;
    }
  }

  async function logout(): Promise<void> {
    await signOut();
    user.value = null;
  }

  async function getAccessToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) {
      throw new Error('No access token');
    }
    return token;
  }

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    isOwner,
    loadUser,
    login,
    setNewPassword,
    logout,
    getAccessToken,
  };
});
