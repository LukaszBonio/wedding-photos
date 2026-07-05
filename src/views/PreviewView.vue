<script setup lang="ts">
import { computed } from 'vue';

import AppButton from '@/components/AppButton.vue';
import CaptionInput from '@/components/CaptionInput.vue';
import PhotoThumbnail from '@/components/PhotoThumbnail.vue';
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();

const captionModel = computed({
  get: () => store.caption,
  set: (value) => store.setCaption(value),
});

function remove(uploadId: string): void {
  void store.removePhoto(uploadId);
}

function send(): void {
  void store.send();
}

function addMore(): void {
  store.view = 'home';
}
</script>

<template>
  <section class="screen">
    <div class="screen__inner">
      <h2 class="title">Twoje pliki</h2>

      <ul class="grid" role="list">
        <li v-for="photo in store.photos" :key="photo.uploadId">
          <PhotoThumbnail :photo="photo" removable @remove="remove" />
        </li>
      </ul>

      <CaptionInput v-model="captionModel" />

      <div class="actions">
        <AppButton variant="primary" @click="send">Wyślij ({{ store.photos.length }})</AppButton>
        <AppButton variant="secondary" @click="addMore">Dodaj więcej zdjęć</AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.title {
  font-size: 1.6rem;
}
</style>
