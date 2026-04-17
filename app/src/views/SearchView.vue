<template>
  <div class="min-h-screen bg-cream">
    <!-- Header -->
    <div class="sticky top-0 z-10 border-b border-muted-light bg-cream px-4 pb-3 pt-4">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <input
            v-model="query"
            type="search"
            placeholder="Search documents…"
            class="h-11 w-full rounded-xl border border-muted-light bg-white pl-10 pr-4 text-[15px] text-dark placeholder:text-muted focus:border-amber focus:outline-none"
            @input="onInput"
            @keydown.enter="doSearch"
          />
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-3.5 text-muted">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <div v-if="isSearching" class="absolute right-3 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-muted-light" style="border-top-color: #b86c2f" />
        </div>
        <button v-if="query" class="text-[14px] text-muted" @click="clearSearch">Cancel</button>
      </div>
    </div>

    <div class="p-4 pb-24">
      <!-- Idle: recent searches + suggestions -->
      <template v-if="!query && !results">
        <div v-if="recentSearches.length > 0" class="mb-6">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-[12px] uppercase tracking-wide text-muted">Recent</p>
            <button class="text-[12px] text-amber" @click="clearRecent">Clear</button>
          </div>
          <div class="space-y-2">
            <button
              v-for="s in recentSearches"
              :key="s"
              class="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left text-[14px] text-dark"
              @click="selectQuery(s)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {{ s }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-[12px] uppercase tracking-wide text-muted">Try searching for</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="chip in SUGGESTION_CHIPS"
              :key="chip"
              class="rounded-full border border-muted-light bg-white px-4 py-1.5 text-[13px] text-dark"
              @click="selectQuery(chip)"
            >
              {{ chip }}
            </button>
          </div>
        </div>
      </template>

      <!-- Results -->
      <template v-else-if="results">
        <p class="mb-3 text-[13px] text-muted">
          {{ results.resultCount }} result{{ results.resultCount === 1 ? '' : 's' }}
          <span v-if="results.fallbackTextSearch"> (keyword match)</span>
        </p>

        <div v-if="results.results.length === 0" class="flex flex-col items-center py-12 text-center">
          <p class="text-[15px] font-semibold text-dark">No documents found</p>
          <p class="mt-1 text-[13px] text-muted">Try different keywords or upload the document</p>
          <button class="mt-4 rounded-xl bg-amber px-6 py-3 text-[14px] font-semibold text-white" @click="router.push('/upload')">
            Upload document
          </button>
        </div>

        <div v-else class="space-y-3">
          <SearchResultCard
            v-for="r in results.results"
            :key="r.documentId"
            v-bind="r"
            @open="router.push(`/documents/${$event}`)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SearchResultCard from '@/components/SearchResultCard.vue';
import { search, type SearchResponse } from '@/services/api/search';

const router = useRouter();
const query = ref('');
const isSearching = ref(false);
const results = ref<SearchResponse | null>(null);
const recentSearches = ref<string[]>([]);

const SUGGESTION_CHIPS = ["Appa's Aadhaar", 'Passport', 'Insurance', 'Bank statement', 'Medical report'];
const RECENT_KEY = 'fv_recent_searches';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  try {
    recentSearches.value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch { recentSearches.value = []; }
});

function saveRecent(q: string): void {
  const list = [q, ...recentSearches.value.filter((s) => s !== q)].slice(0, 10);
  recentSearches.value = list;
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function clearRecent(): void {
  recentSearches.value = [];
  localStorage.removeItem(RECENT_KEY);
}

function clearSearch(): void {
  query.value = '';
  results.value = null;
  if (debounceTimer) clearTimeout(debounceTimer);
}

function selectQuery(q: string): void {
  query.value = q;
  void doSearch();
}

function onInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!query.value.trim()) { results.value = null; return; }
  debounceTimer = setTimeout(() => void doSearch(), 400);
}

async function doSearch(): Promise<void> {
  if (!query.value.trim()) return;
  isSearching.value = true;
  try {
    saveRecent(query.value.trim());
    results.value = await search(query.value.trim());
  } catch {
    results.value = { results: [], extractedSlots: { person: null, category: null, subcategory: null }, fallbackTextSearch: false, resultCount: 0 };
  } finally {
    isSearching.value = false;
  }
}
</script>
