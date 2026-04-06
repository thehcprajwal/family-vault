import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

export interface Person {
  personId: string;
  displayName: string;
  relationship: string | null;
}

const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === 'true';

const MOCK_PERSONS: Person[] = [
  { personId: 'mock-person-001', displayName: 'Raj Kumar', relationship: 'father' },
  { personId: 'mock-person-002', displayName: 'Priya Kumar', relationship: 'mother' },
  { personId: 'mock-person-003', displayName: 'Arjun Kumar', relationship: 'son' },
];

export async function listPersons(): Promise<Person[]> {
  if (DEV_MOCK) return MOCK_PERSONS;

  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();

  const response = await fetch(`${env.apiUrl}/v1/persons`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to load persons: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { persons: Person[] };
  return data.persons;
}
