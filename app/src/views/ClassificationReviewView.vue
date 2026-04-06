<template>
  <div class="min-h-screen bg-cream">
    <!-- Header -->
    <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-muted-light bg-cream p-4">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full"
        @click="handleBack"
        aria-label="Go back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-dark"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-[17px] font-semibold text-dark">Review Document</h1>
    </div>

    <div class="p-4 pb-32">
      <!-- Success state -->
      <div v-if="viewState === 'done'" class="flex flex-col items-center py-12 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-sage"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p class="text-[17px] font-semibold text-dark">Document saved</p>
        <p class="mt-1 text-[14px] text-muted">It's now in your vault.</p>
        <button
          class="mt-6 h-[50px] w-full rounded-xl bg-sage text-[15px] font-semibold text-white"
          @click="router.push('/')"
        >
          Go to Home
        </button>
      </div>

      <template v-else>
        <!-- Error banner -->
        <div
          v-if="errorMessage"
          class="mb-4 rounded-xl bg-red-50 p-4 text-[14px] text-red-700"
        >
          {{ errorMessage }}
        </div>

        <!-- Suggestion card -->
        <SuggestionCard
          :suggestion="doc?.suggestion ?? null"
          :loading="doc?.loadState === 'loading'"
          class="mb-4"
        />

        <!-- Edit form -->
        <ClassificationEditForm
          v-if="viewState === 'editing' && doc?.suggestion"
          v-model="localEdits"
          :suggestion="doc.suggestion"
          class="mb-4"
        />

        <!-- Action buttons -->
        <div v-if="doc?.loadState === 'ready'" class="fixed bottom-0 left-0 right-0 bg-cream p-4 pb-8 shadow-[0_-1px_0_#E2CEBC]">
          <div class="mx-auto max-w-md space-y-2">
            <!-- Confirm -->
            <button
              class="flex h-[50px] w-full items-center justify-center rounded-xl bg-sage text-[15px] font-semibold text-white disabled:opacity-50"
              :disabled="viewState === 'confirming'"
              @click="handleConfirm"
            >
              <span v-if="viewState === 'confirming'" class="flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </span>
              <span v-else>{{ viewState === 'editing' ? 'Confirm with edits' : 'Confirm' }}</span>
            </button>

            <!-- Edit / Cancel edit -->
            <button
              v-if="viewState !== 'confirming'"
              class="h-[50px] w-full rounded-xl border border-muted-light bg-white text-[15px] text-dark"
              @click="toggleEdit"
            >
              {{ viewState === 'editing' ? 'Cancel edit' : 'Edit details' }}
            </button>

            <!-- Discard -->
            <button
              v-if="viewState !== 'confirming'"
              class="h-[50px] w-full rounded-xl text-[15px] text-terracotta"
              @click="handleDiscard"
            >
              Discard
            </button>
          </div>
        </div>

        <!-- Retry on error -->
        <button
          v-if="doc?.loadState === 'error'"
          class="mt-2 h-[50px] w-full rounded-xl bg-sage text-[15px] font-semibold text-white"
          @click="load"
        >
          Retry
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SuggestionCard from '@/components/SuggestionCard.vue';
import ClassificationEditForm from '@/components/ClassificationEditForm.vue';
import { useClassificationStore } from '@/stores/classification';
import type { ConfirmPayload } from '@/services/api/classification';

type ViewState = 'loading' | 'ready' | 'editing' | 'confirming' | 'done';

const route = useRoute();
const router = useRouter();
const classificationStore = useClassificationStore();

const documentId = computed(() => route.params.documentId as string);
const doc = computed(() => classificationStore.getDocument(documentId.value));

const viewState = ref<ViewState>('loading');
const errorMessage = ref<string | null>(null);
const localEdits = ref<Partial<ConfirmPayload>>({});

async function load(): Promise<void> {
  viewState.value = 'loading';
  errorMessage.value = null;
  await classificationStore.loadSuggestion(documentId.value);
  if (doc.value?.loadState === 'ready') {
    viewState.value = 'ready';
  }
}

onMounted(() => void load());

function toggleEdit(): void {
  if (viewState.value === 'editing') {
    localEdits.value = {};
    viewState.value = 'ready';
  } else {
    viewState.value = 'editing';
  }
}

async function handleConfirm(): Promise<void> {
  if (viewState.value === 'editing') {
    classificationStore.editDocument(documentId.value, localEdits.value);
  }
  viewState.value = 'confirming';
  errorMessage.value = null;
  try {
    await classificationStore.confirmDocument(documentId.value);
    viewState.value = 'done';
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to save document';
    viewState.value = 'ready';
  }
}

function handleDiscard(): void {
  classificationStore.discardDocument(documentId.value);
  void router.push('/');
}

function handleBack(): void {
  void router.push('/');
}
</script>
