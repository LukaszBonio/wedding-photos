<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@/components/AppButton.vue';

const emit = defineEmits<{ select: [files: File[]] }>();

const cameraInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);
const galleryInput = ref<HTMLInputElement | null>(null);

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  if (files.length > 0) emit('select', files);
  input.value = '';
}
</script>

<template>
  <div class="sources">
    <div class="sources__capture">
      <AppButton variant="primary" @click="cameraInput?.click()">Zrób zdjęcie</AppButton>
      <AppButton variant="primary" @click="videoInput?.click()">Nagraj wideo</AppButton>
    </div>
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
      ref="videoInput"
      class="visually-hidden"
      type="file"
      accept="video/*"
      capture="environment"
      @change="onChange"
    />
    <input
      ref="galleryInput"
      class="visually-hidden"
      type="file"
      accept="image/*,video/*"
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
.sources__capture {
  display: flex;
  gap: 0.55rem;
}
.sources__capture :deep(.btn) {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  padding: 0.8rem 0.4rem;
}
</style>
