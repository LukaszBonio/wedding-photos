<script setup lang="ts">
import { computed } from 'vue';

import type { PhotoStatus } from '@/types';
import type { PhotoVm } from '@/stores/uploadStore';

const props = defineProps<{ photo: PhotoVm; removable?: boolean }>();
const emit = defineEmits<{ remove: [uploadId: string] }>();

const isVideo = computed(() => props.photo.mimeType?.startsWith('video/'));

const STATUS_LABEL: Record<PhotoStatus, string> = {
  ready: 'Gotowe do wysłania',
  uploading: 'Wysyłanie…',
  success: 'Wysłane',
  error: 'Nie udało się wysłać',
  offline: 'Poczeka na połączenie',
};
</script>

<template>
  <figure class="thumb" :class="`thumb--${photo.status}`">
    <video v-if="isVideo" class="thumb__img" :src="photo.objectUrl" muted playsinline preload="metadata" />
    <img v-else class="thumb__img" :src="photo.objectUrl" alt="Wybrane zdjęcie" />

    <span v-if="isVideo" class="thumb__video-badge" aria-label="Film">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </span>
    <figcaption class="visually-hidden">{{ STATUS_LABEL[photo.status] }}</figcaption>

    <span class="thumb__badge" role="img" :aria-label="STATUS_LABEL[photo.status]">
      <svg
        v-if="photo.status === 'success'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <svg
        v-else-if="photo.status === 'error'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v4" />
        <path d="M12 17.5h.01" />
      </svg>
      <svg
        v-else-if="photo.status === 'offline'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span v-else-if="photo.status === 'uploading'" class="thumb__spinner" />
    </span>

    <button
      v-if="removable"
      type="button"
      class="thumb__remove"
      aria-label="Usuń zdjęcie"
      @click="emit('remove', photo.uploadId)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  </figure>
</template>

<style scoped>
.thumb {
  position: relative;
  margin: 0;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-sand-soft);
  border: 1px solid var(--color-sand);
}

.thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb--uploading .thumb__img,
.thumb--offline .thumb__img {
  opacity: 0.6;
}

.thumb__badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  background: color-mix(in srgb, var(--color-ink) 55%, transparent);
}

.thumb__badge svg {
  width: 16px;
  height: 16px;
}

.thumb--success .thumb__badge {
  background: var(--color-gold-deep);
}
.thumb--error .thumb__badge {
  background: var(--color-error);
}

.thumb__spinner {
  width: 15px;
  height: 15px;
  border: 2.5px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.thumb__remove {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 999px;
  color: var(--color-ink);
  background: color-mix(in srgb, var(--color-ivory) 85%, transparent);
  cursor: pointer;
}

.thumb__remove svg {
  width: 16px;
  height: 16px;
}

.thumb__remove:focus-visible {
  outline: 3px solid var(--color-gold-deep);
  outline-offset: 2px;
}

.thumb__video-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  background: color-mix(in srgb, var(--color-ink) 50%, transparent);
  pointer-events: none;
}

.thumb__video-badge svg {
  width: 18px;
  height: 18px;
}
</style>
