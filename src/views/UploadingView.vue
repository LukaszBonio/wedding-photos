<script setup lang="ts">
import { computed } from 'vue';

import PhotoThumbnail from '@/components/PhotoThumbnail.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();

const percent = computed(() =>
  store.counts.total === 0 ? 0 : Math.round((store.counts.success / store.counts.total) * 100),
);
</script>

<template>
  <section class="screen">
    <div class="screen__inner">
      <h2 class="title">Wysyłam…</h2>
      <p class="lead">{{ store.counts.success }} z {{ store.counts.total }} wysłane</p>

      <ProgressBar :value="percent" label="Postęp wysyłki" />

      <ul class="grid" role="list">
        <li v-for="photo in store.photos" :key="photo.uploadId">
          <PhotoThumbnail :photo="photo" />
        </li>
      </ul>

      <p class="hint">Nie zamykaj tej karty, dopóki wysyłka się nie zakończy.</p>
    </div>
  </section>
</template>

<style scoped>
.title {
  font-size: 1.6rem;
}
.lead {
  margin: 0;
  color: var(--color-text-muted);
}
.hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
</style>
