<template>
  <div class="rounded-2xl border border-muted-light bg-white p-4">
    <p class="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Edit Details</p>

    <div class="space-y-3">
      <!-- Person picker -->
      <div>
        <label class="mb-1 block text-[12px] text-muted">Person</label>
        <select
          :value="modelValue.personId !== undefined ? (modelValue.personId ?? '') : (suggestion.suggestedPersonId ?? '')"
          @change="emit('update:modelValue', { ...modelValue, personId: ($event.target as HTMLSelectElement).value || null })"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
          :disabled="personsLoading"
        >
          <option value="">— Unassigned —</option>
          <option v-for="person in persons" :key="person.personId" :value="person.personId">
            {{ person.displayName }}{{ person.relationship ? ` (${person.relationship})` : '' }}
          </option>
        </select>
        <p v-if="personsError" class="mt-1 text-[11px] text-red-600">{{ personsError }}</p>
      </div>

      <!-- Document name -->
      <div>
        <label class="mb-1 block text-[12px] text-muted">Document Name</label>
        <input
          type="text"
          :value="modelValue.displayName ?? suggestion.suggestedDisplayName"
          @input="emit('update:modelValue', { ...modelValue, displayName: ($event.target as HTMLInputElement).value })"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
          placeholder="e.g. Aadhaar Card"
        />
      </div>

      <!-- Category -->
      <div>
        <label class="mb-1 block text-[12px] text-muted">Category</label>
        <select
          :value="modelValue.categoryId ?? suggestion.suggestedCategory ?? ''"
          @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
        >
          <option value="">— Select category —</option>
          <option v-for="cat in CATEGORIES" :key="cat.name" :value="cat.name">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- Subcategory -->
      <div>
        <label class="mb-1 block text-[12px] text-muted">Subcategory</label>
        <select
          v-if="availableSubcategories.length > 0"
          :value="modelValue.subcategory ?? suggestion.suggestedSubcategory ?? ''"
          @change="emit('update:modelValue', { ...modelValue, subcategory: ($event.target as HTMLSelectElement).value || null })"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
        >
          <option value="">— None —</option>
          <option v-for="sub in availableSubcategories" :key="sub" :value="sub">
            {{ sub }}
          </option>
        </select>
        <input
          v-else
          type="text"
          :value="modelValue.subcategory ?? suggestion.suggestedSubcategory ?? ''"
          @input="emit('update:modelValue', { ...modelValue, subcategory: ($event.target as HTMLInputElement).value || null })"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
          placeholder="Optional"
        />
      </div>

      <!-- Expiry date -->
      <div>
        <label class="mb-1 block text-[12px] text-muted">Expiry Date (optional)</label>
        <input
          type="date"
          :value="modelValue.expiryDate ?? suggestion.suggestedExpiryDate ?? ''"
          @input="emit('update:modelValue', { ...modelValue, expiryDate: ($event.target as HTMLInputElement).value || null })"
          class="h-11 w-full rounded-xl border border-muted-light bg-cream px-3 text-[14px] text-dark focus:border-sage focus:outline-none"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import type { ClassificationResult, ConfirmPayload } from '@/services/api/classification';
import { listPersons, type Person } from '@/services/api/persons';

const CATEGORIES = [
  { name: 'Identity', subcategories: ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving Licence'] },
  { name: 'Financial', subcategories: ['Bank Statement', 'ITR', 'Form 16'] },
  { name: 'Medical', subcategories: ['Prescription', 'Report', 'Insurance'] },
  { name: 'Property', subcategories: ['Sale Deed', 'Rental Agreement'] },
  { name: 'Vehicle', subcategories: ['RC', 'Insurance'] },
  { name: 'Legal', subcategories: [] },
  { name: 'Educational', subcategories: [] },
  { name: 'Other', subcategories: [] },
];

const props = defineProps<{
  modelValue: Partial<ConfirmPayload>;
  suggestion: ClassificationResult;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Partial<ConfirmPayload>];
}>();

const persons = ref<Person[]>([]);
const personsLoading = ref(true);
const personsError = ref<string | null>(null);

onMounted(async () => {
  try {
    persons.value = await listPersons();
  } catch {
    personsError.value = 'Could not load family members';
  } finally {
    personsLoading.value = false;
  }
});

const selectedCategory = computed(
  () => props.modelValue.categoryId ?? props.suggestion.suggestedCategory ?? '',
);

const availableSubcategories = computed(() => {
  const cat = CATEGORIES.find((c) => c.name === selectedCategory.value);
  return cat?.subcategories ?? [];
});

function onCategoryChange(value: string): void {
  emit('update:modelValue', {
    ...props.modelValue,
    categoryId: value || null,
    subcategory: null, // reset subcategory when category changes
  });
}
</script>
