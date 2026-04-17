import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useVaultStore } from '@/stores/vault';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, hideNav: true },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/views/UploadView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/review/:documentId',
      name: 'review',
      component: () => import('@/views/ClassificationReviewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/documents/:documentId',
      name: 'document-detail',
      component: () => import('@/views/DocumentDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/family',
      name: 'family-list',
      component: () => import('@/views/FamilyListView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings/family/add',
      name: 'add-person',
      component: () => import('@/views/AddPersonView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings/family/:id/edit',
      name: 'edit-person',
      component: () => import('@/views/EditPersonView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings/categories',
      name: 'category-list',
      component: () => import('@/views/CategoryListView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings/categories/add',
      name: 'add-category',
      component: () => import('@/views/AddCategoryView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings/categories/:id/edit',
      name: 'edit-category',
      component: () => import('@/views/EditCategoryView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true, hideNav: true },
    },
    {
      path: '/expiry',
      name: 'expiry',
      component: () => import('@/views/ExpiryView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (authStore.isLoading) {
    await authStore.loadUser();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' };
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'home' };
  }

  if (to.meta.requiresAuth && authStore.isAuthenticated) {
    const vaultStore = useVaultStore();

    if (!vaultStore.vaultId) {
      await vaultStore.loadVault().catch(() => {});
    }

    if (!vaultStore.onboardingComplete && to.name !== 'onboarding') {
      return { name: 'onboarding' };
    }

    if (vaultStore.onboardingComplete && to.name === 'onboarding') {
      return { name: 'home' };
    }
  }

  return true;
});

export default router;
