<script setup lang="ts">
/**
 * Root shell. The upload store owns the view state machine; this component
 * mirrors it into the URL hash (Back button + refresh-restores-view) and
 * renders the active view with a gentle transition.
 */
import { onMounted, watch, type Component } from 'vue';

import { useHashRouter } from '@/composables/useHashRouter';
import { useUploadStore } from '@/stores/uploadStore';
import type { AppView } from '@/types';
import ErrorView from '@/views/ErrorView.vue';
import HomeView from '@/views/HomeView.vue';
import OfflineView from '@/views/OfflineView.vue';
import PreviewView from '@/views/PreviewView.vue';
import SuccessView from '@/views/SuccessView.vue';
import UploadingView from '@/views/UploadingView.vue';

const store = useUploadStore();
const router = useHashRouter();

const VIEWS: Record<AppView, Component> = {
  home: HomeView,
  preview: PreviewView,
  uploading: UploadingView,
  success: SuccessView,
  error: ErrorView,
  offline: OfflineView,
};

onMounted(() => {
  void store.init().then(() => router.navigate(store.view));
});

// Store → URL.
watch(
  () => store.view,
  (next) => router.navigate(next),
);

// URL → store (Back button / refresh).
watch(
  () => router.view.value,
  (next) => {
    if (next !== store.view) store.view = next;
  },
);
</script>

<template>
  <main class="app">
    <Transition name="view" mode="out-in">
      <component :is="VIEWS[store.view]" :key="store.view" />
    </Transition>
  </main>
</template>

<style scoped>
.app {
  position: relative;
  min-height: 100dvh;
}
</style>
