import { ref } from 'vue';
import { defineStore } from 'pinia';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';
import type { PersonRecord, CategoryRecord } from '@/types/vault';

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((err['error'] as string) ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === 'true';

export const useVaultStore = defineStore('vault', () => {
  const vaultId = ref<string | null>(null);
  const ownerSub = ref<string | null>(null);
  const onboardingComplete = ref(false);
  const persons = ref<PersonRecord[]>([]);
  const categories = ref<CategoryRecord[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function loadVault(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      if (DEV_MOCK) {
        vaultId.value = 'mock-vault-id-001';
        ownerSub.value = 'mock-sub-001';
        onboardingComplete.value = false;
        persons.value = [];
        categories.value = DEFAULT_CATEGORIES;
        return;
      }

      const [vaultMe, fetchedPersons, fetchedCategories] = await Promise.all([
        apiRequest<{ vaultId: string; ownerSub: string; onboardingComplete: boolean; createdAt: string }>(
          'GET', '/v1/vault/me',
        ),
        apiRequest<{ persons: PersonRecord[] }>('GET', '/v1/persons'),
        apiRequest<{ categories: CategoryRecord[] }>('GET', '/v1/categories'),
      ]);

      vaultId.value = vaultMe.vaultId;
      ownerSub.value = vaultMe.ownerSub;
      onboardingComplete.value = vaultMe.onboardingComplete;
      persons.value = fetchedPersons.persons;
      categories.value = fetchedCategories.categories.length > 0
        ? fetchedCategories.categories
        : DEFAULT_CATEGORIES;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load vault';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function addPerson(data: { displayName: string; relationship: string }): Promise<void> {
    if (DEV_MOCK) {
      persons.value.push({
        personId: `mock-person-${Date.now()}`,
        displayName: data.displayName,
        relationship: data.relationship,
      });
      return;
    }
    const result = await apiRequest<PersonRecord>('POST', '/v1/persons', data);
    persons.value.push(result);
  }

  async function toggleCategory(categoryId: string, enabled: boolean): Promise<void> {
    const idx = categories.value.findIndex((c) => c.categoryId === categoryId);
    if (idx === -1) return;
    categories.value[idx] = { ...categories.value[idx], enabled };
    if (!DEV_MOCK) {
      await apiRequest('PATCH', `/v1/categories/${categoryId}`, { enabled }).catch(() => {
        // Revert on failure
        categories.value[idx] = { ...categories.value[idx], enabled: !enabled };
      });
    }
  }

  return {
    vaultId,
    ownerSub,
    onboardingComplete,
    persons,
    categories,
    isLoading,
    error,
    loadVault,
    addPerson,
    toggleCategory,
  };
});

const DEFAULT_CATEGORIES: CategoryRecord[] = [
  { categoryId: 'identity',    name: 'Identity',    subcategories: ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving Licence'], enabled: true, colour: '#185FA5', icon: 'id-card' },
  { categoryId: 'financial',   name: 'Financial',   subcategories: ['Bank Statement', 'ITR', 'Form 16', 'Salary Slip'], enabled: true, colour: '#3B6D11', icon: 'banknote' },
  { categoryId: 'medical',     name: 'Medical',     subcategories: ['Prescription', 'Report', 'Insurance', 'Vaccination'], enabled: true, colour: '#993C1D', icon: 'heart-pulse' },
  { categoryId: 'property',    name: 'Property',    subcategories: ['Sale Deed', 'Rental Agreement', 'NOC'], enabled: true, colour: '#854F0B', icon: 'home' },
  { categoryId: 'vehicle',     name: 'Vehicle',     subcategories: ['RC', 'Insurance', 'PUC'], enabled: true, colour: '#6B3FA0', icon: 'car' },
  { categoryId: 'legal',       name: 'Legal',       subcategories: ['Will', 'Power of Attorney', 'Affidavit'], enabled: true, colour: '#0F6E56', icon: 'scale' },
  { categoryId: 'educational', name: 'Educational', subcategories: ['Degree', 'Marksheet', 'Certificate'], enabled: true, colour: '#1A5F7A', icon: 'graduation-cap' },
  { categoryId: 'other',       name: 'Other',       subcategories: [], enabled: true, colour: '#6B6B6B', icon: 'folder' },
];
