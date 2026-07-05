<script setup lang="ts">
import AppButton from '@/components/AppButton.vue';
import PhotoThumbnail from '@/components/PhotoThumbnail.vue';
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();

function retry(): void {
  store.retryFailed();
}

function finish(): void {
  store.reset();
}
</script>

<template>
  <section class="screen">
    <div class="screen__inner">
      <h2 class="title">Część plików nie dotarła</h2>
      <p class="lead">
        Wysłano {{ store.counts.success }} z {{ store.counts.total }}. Sprawdź połączenie i spróbuj
        ponownie.
      </p>

      <ul class="grid" role="list">
        <li v-for="photo in store.photos" :key="photo.uploadId">
          <PhotoThumbnail :photo="photo" />
        </li>
      </ul>

      <div class="actions">
        <AppButton variant="primary" @click="retry">Ponów wysyłkę</AppButton>
        <AppButton variant="secondary" @click="finish">Zakończ</AppButton>
      </div>
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
</style>
