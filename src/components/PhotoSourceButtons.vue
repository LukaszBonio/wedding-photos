<script setup lang="ts">
// Two capture paths, matching the brief exactly:
//  - "Zrób zdjęcie": opens the camera (accept image/*, capture=environment),
//  - "Wybierz z galerii": multi-select from the library (no capture).
// The inputs are visually hidden; styled buttons trigger them.
import { ref } from 'vue';

import AppButton from '@/components/AppButton.vue';

const emit = defineEmits<{ select: [files: File[]] }>();

const cameraInput = ref<HTMLInputElement | null>(null);
const galleryInput = ref<HTMLInputElement | null>(null);

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  if (files.length > 0) emit('select', files);
  input.value = ''; // let the guest re-pick the same file
}
</script>

<template>
  <div class="sources">
    <AppButton variant="primary" @click="cameraInput?.click()">Zrób zdjęcie</AppButton>
    <AppButton variant="secondary" @click="galleryInput?.click()">Wybierz z galerii</AppButton>

    <input
      ref="cameraInput"
      class="visually-hidden"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onChange"
    />
    <input
      ref="galleryInput"
      class="visually-hidden"
      type="file"
      accept="image/*"
      multiple
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.sources {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
</style>
