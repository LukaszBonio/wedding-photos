<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchRecentPhotos, type RecentPhoto } from '@/api/gasClient';

const photos = ref<RecentPhoto[]>([]);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    photos.value = await fetchRecentPhotos();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-if="loading" class="gallery-loading">
    <div class="gallery-spinner" />
    <p class="gallery-loading-text">Ładuję galerię…</p>
  </div>

  <div v-else-if="photos.length > 0" class="gallery" aria-label="Ostatnie zdjęcia gości">
    <p class="gallery-title">Ostatnie zdjęcia gości</p>
    <div class="gallery-grid">
      <img
        v-for="photo in photos"
        :key="photo.id"
        :src="photo.thumbnail"
        alt=""
        class="gallery-thumb"
        draggable="false"
      />
    </div>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.gallery-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1rem;
  text-align: center;
  color: var(--color-text-muted);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
}

.gallery-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius-sm);
  pointer-events: none;
  user-select: none;
}

.gallery-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0;
}

.gallery-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-sand);
  border-top-color: var(--color-gold);
  border-radius: 50%;
  animation: gallery-spin 0.7s linear infinite;
}

.gallery-loading-text {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

@keyframes gallery-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .gallery-spinner { animation: none; }
}
</style>
