<template>
  <div class="min-h-screen bg-cream pb-24">
    <div class="sticky top-0 z-10 border-b border-muted-light bg-cream px-4 py-3">
      <h1 class="text-[17px] font-semibold text-dark">Expiry Tracker</h1>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="p-4 space-y-3">
      <SkeletonCard v-for="n in 4" :key="n" />
    </div>

    <!-- Error -->
    <ErrorState v-else-if="loadError" :message="loadError" class="px-4" @retry="load" />

    <!-- Empty -->
    <template v-else-if="isEmpty">
      <EmptyState title="All documents are up to date" subtitle="Great job keeping things current!" class="px-4">
        <template #illustration>
          <div class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-sage/10 text-[40px]">🌿</div>
        </template>
      </EmptyState>
    </template>

    <!-- Results -->
    <div v-else class="p-4 space-y-6">
      <!-- Expired -->
      <div v-if="data.expired.length > 0">
        <div class="mb-3 flex items-center gap-2">
          <div class="h-2.5 w-2.5 rounded-full bg-red-500" />
          <p class="text-[12px] font-semibold uppercase tracking-wide text-red-600">Expired</p>
        </div>
        <div class="space-y-3">
          <ExpiryCard v-for="doc in data.expired" :key="doc.documentId" v-bind="doc" urgent @renew="renewDoc(doc)" />
        </div>
      </div>

      <!-- This month -->
      <div v-if="data.expiringThisMonth.length > 0">
        <div class="mb-3 flex items-center gap-2">
          <div class="h-2.5 w-2.5 rounded-full bg-amber" />
          <p class="text-[12px] font-semibold uppercase tracking-wide text-amber-dark">Expiring this month</p>
        </div>
        <div class="space-y-3">
          <ExpiryCard v-for="doc in data.expiringThisMonth" :key="doc.documentId" v-bind="doc" urgent @renew="renewDoc(doc)" />
        </div>
      </div>

      <!-- Upcoming -->
      <div v-if="data.expiringUpcoming.length > 0">
        <div class="mb-3 flex items-center gap-2">
          <div class="h-2.5 w-2.5 rounded-full bg-muted" />
          <p class="text-[12px] font-semibold uppercase tracking-wide text-muted">Expiring in 1–3 months</p>
        </div>
        <div class="space-y-3">
          <ExpiryCard v-for="doc in data.expiringUpcoming" :key="doc.documentId" v-bind="doc" :urgent="false" @renew="renewDoc(doc)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h } from 'vue';
import { useRouter } from 'vue-router';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';
import { useExpiryStore } from '@/stores/expiry';
import SkeletonCard from '@/components/SkeletonCard.vue';
import ErrorState from '@/components/ErrorState.vue';
import EmptyState from '@/components/EmptyState.vue';

const router = useRouter();
const authStore = useAuthStore();
const expiryStore = useExpiryStore();

interface ExpiryDoc {
  documentId: string;
  displayName: string;
  personDisplay: string | null;
  personId: string | null;
  categoryName: string | null;
  categoryId: string | null;
  subcategory: string | null;
  expiryDate: string;
  daysLeft: number;
  previewUrl: string;
}

interface ExpiryData {
  expired: ExpiryDoc[];
  expiringThisMonth: ExpiryDoc[];
  expiringUpcoming: ExpiryDoc[];
}

const isLoading = ref(true);
const loadError = ref<string | null>(null);
const data = ref<ExpiryData>({ expired: [], expiringThisMonth: [], expiringUpcoming: [] });

const isEmpty = computed(() =>
  data.value.expired.length === 0 &&
  data.value.expiringThisMonth.length === 0 &&
  data.value.expiringUpcoming.length === 0,
);

async function load(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;
  try {
    const token = await authStore.getAccessToken();
    const res = await fetch(`${env.apiUrl}/v1/expiry?withinDays=90`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data.value = await res.json() as ExpiryData;
    expiryStore.setExpiredCount(data.value.expired.length);
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load expiry data';
  } finally {
    isLoading.value = false;
  }
}

function renewDoc(doc: ExpiryDoc): void {
  const params = new URLSearchParams();
  if (doc.personId) params.set('personId', doc.personId);
  if (doc.categoryId) params.set('categoryId', doc.categoryId);
  if (doc.subcategory) params.set('subcategory', doc.subcategory);
  void router.push(`/upload?${params.toString()}`);
}

onMounted(load);

// ── Inline ExpiryCard subcomponent ────────────────────────────
const ExpiryCard = defineComponent({
  name: 'ExpiryCard',
  props: {
    documentId: String,
    displayName: String,
    personDisplay: { type: String, default: null },
    categoryName: { type: String, default: null },
    expiryDate: String,
    daysLeft: Number,
    previewUrl: String,
    urgent: { type: Boolean, default: false },
  },
  emits: ['renew'],
  setup(props, { emit }) {
    function label() {
      const d = props.daysLeft ?? 0;
      if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
      if (d === 0) return 'Today';
      return `${d} day${d === 1 ? '' : 's'} left`;
    }
    return () => h('div', { class: 'flex items-start gap-3 rounded-2xl border border-muted-light bg-white p-4' }, [
      h('div', { class: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted-light text-[16px]' }, '📄'),
      h('div', { class: 'flex-1 min-w-0' }, [
        h('p', { class: 'text-[14px] font-semibold text-dark truncate' }, props.displayName ?? 'Untitled'),
        h('p', { class: 'text-[12px] text-muted mt-0.5' }, [
          props.personDisplay ? `${props.personDisplay} · ` : '',
          props.categoryName ?? '',
        ]),
        h('p', { class: `text-[12px] font-medium mt-1 ${(props.daysLeft ?? 0) < 0 ? 'text-red-600' : (props.daysLeft ?? 0) === 0 ? 'text-amber' : 'text-muted'}` }, label()),
      ]),
      props.urgent
        ? h('button', {
            class: 'shrink-0 rounded-xl bg-amber px-3 py-1.5 text-[12px] font-semibold text-white',
            onClick: () => emit('renew'),
          }, 'Renew')
        : null,
    ]);
  },
});
</script>
