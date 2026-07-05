/**
 * The reactive bridge between the UI and the framework-agnostic services.
 * Owns the view state machine and the session's photo view-models, and wires
 * the upload queue to IndexedDB, the API client, and network status.
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { uploadPhoto } from '@/api/gasClient';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { MAX_GALLERY_BATCH, MAX_OFFLINE_QUEUE } from '@/constants';
import { deletePhoto, getPhoto, loadValidPhotos, putPhoto, updatePhoto } from '@/db/dexie';
import { compressImage } from '@/services/imageProcessor';
import { createUploadQueue, type QueueItem } from '@/services/uploadQueue';
import type { AppView, PhotoStatus, QueuedPhoto } from '@/types';
import { buildClientFilename } from '@/utils/filename';
import { sanitizeCaption } from '@/utils/sanitizeCaption';
import { generateUploadId } from '@/utils/uuid';
import { validateFile, type FileRejectReason } from '@/utils/fileValidation';
import { deriveSendingView } from '@/utils/viewState';

/** Per-photo view-model for the current session (thumbnail + live status). */
export interface PhotoVm {
  uploadId: string;
  objectUrl: string;
  mimeType: string;
  status: PhotoStatus;
  progress: number;
  error: string | null;
}

const SENDING_VIEWS: readonly AppView[] = ['uploading', 'offline', 'success', 'error'];

function rejectionMessage(_reason: FileRejectReason): string {
  return 'Ten plik jest pusty. Wybierz inne zdjęcie.';
}

export const useUploadStore = defineStore('upload', () => {
  const view = ref<AppView>('home');
  const photos = ref<PhotoVm[]>([]);
  const caption = ref('');
  const processing = ref(false);
  const processingTotal = ref(0);
  const processingDone = ref(0);
  const pickError = ref<string | null>(null);
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

  const toQueueItem = (photo: QueuedPhoto): QueueItem => ({
    uploadId: photo.uploadId,
    filename: photo.filename,
    mimeType: photo.mimeType,
    caption: photo.caption,
    createdAt: photo.createdAt,
    attempts: photo.attempts,
    status: photo.status,
    progress: photo.progress,
    lastError: photo.lastError,
  });

  const queue = createUploadQueue({
    upload: async (item, _onProgress) => {
      const photo = await getPhoto(item.uploadId);
      if (!photo) return { kind: 'success', fileId: '' };
      return uploadPhoto({
        uploadId: photo.uploadId,
        blob: photo.blob,
        filename: photo.filename,
        mimeType: photo.mimeType,
        caption: photo.caption,
      });
    },
    persist: (id, changes) => updatePhoto(id, changes),
    remove: (id) => deletePhoto(id),
    isOnline: () => online.value,
    onChange: (item) => {
      const vm = photos.value.find((photo) => photo.uploadId === item.uploadId);
      if (vm) {
        vm.status = item.status;
        vm.progress = item.progress;
        vm.error = item.lastError;
      }
      reconcile();
    },
  });

  useNetworkStatus(online, () => queue.resume());

  /** Recomputes the view from photo statuses while in the sending phase. */
  function reconcile(): void {
    if (photos.value.length === 0 || !SENDING_VIEWS.includes(view.value)) return;
    view.value = deriveSendingView(
      photos.value.map((photo) => photo.status),
      online.value,
    );
  }

  const counts = computed(() => {
    let success = 0;
    let failed = 0;
    let pending = 0;
    for (const photo of photos.value) {
      if (photo.status === 'success') success += 1;
      else if (photo.status === 'error') failed += 1;
      else pending += 1;
    }
    return { total: photos.value.length, success, failed, pending };
  });

  const hasPhotos = computed(() => photos.value.length > 0);

  /** Restores any persisted (unsent) photos on load and resumes uploading. */
  async function init(): Promise<void> {
    const persisted = await loadValidPhotos();
    for (const photo of persisted) {
      photos.value.push({
        uploadId: photo.uploadId,
        objectUrl: URL.createObjectURL(photo.blob),
        mimeType: photo.mimeType,
        status: photo.status,
        progress: photo.progress,
        error: photo.lastError,
      });
      queue.enqueue(toQueueItem(photo));
    }
    if (persisted.length > 0) {
      view.value = deriveSendingView(
        photos.value.map((photo) => photo.status),
        online.value,
      );
    }
  }

  /** Validates and compresses picked image files, then shows the preview. */
  async function pickFiles(files: File[]): Promise<void> {
    pickError.value = null;
    const remaining = MAX_OFFLINE_QUEUE - photos.value.length;
    const batch = files.slice(0, Math.min(MAX_GALLERY_BATCH, Math.max(0, remaining)));
    if (files.length > batch.length) {
      pickError.value = `Możesz dodać maksymalnie ${MAX_GALLERY_BATCH} plików naraz.`;
    }

    processing.value = true;
    processingTotal.value = batch.length;
    processingDone.value = 0;
    try {
      for (const file of batch) {
        const validation = await validateFile(file);
        if (!validation.ok) {
          pickError.value = rejectionMessage(validation.reason);
          processingDone.value += 1;
          continue;
        }
        const uploadId = generateUploadId();

        try {
          const output = await compressImage(file, uploadId);
          const photo: QueuedPhoto = {
            uploadId,
            blob: output.blob,
            filename: buildClientFilename(uploadId, 'image/jpeg'),
            mimeType: 'image/jpeg',
            caption: '',
            createdAt: Date.now(),
            attempts: 0,
            status: 'ready',
            progress: 100,
            lastError: null,
          };
          await putPhoto(photo);
          photos.value.push({
            uploadId,
            objectUrl: URL.createObjectURL(output.blob),
            mimeType: 'image/jpeg',
            status: 'ready',
            progress: 100,
            error: null,
          });
        } catch (error) {
          pickError.value =
            error instanceof Error ? error.message : 'Nie udało się przetworzyć zdjęcia.';
        }
        processingDone.value += 1;
      }
    } finally {
      processing.value = false;
    }

    if (photos.value.length > 0) view.value = 'preview';
  }

  /** Removes a staged photo before sending. */
  async function removePhoto(uploadId: string): Promise<void> {
    const index = photos.value.findIndex((photo) => photo.uploadId === uploadId);
    if (index === -1) return;
    URL.revokeObjectURL(photos.value[index]!.objectUrl);
    photos.value.splice(index, 1);
    await deletePhoto(uploadId);
    if (photos.value.length === 0) view.value = 'home';
  }

  function setCaption(text: string): void {
    caption.value = text;
  }

  /** Applies the caption and enqueues every staged photo for upload. */
  async function send(): Promise<void> {
    const clean = sanitizeCaption(caption.value);
    for (const vm of photos.value) {
      const photo = await getPhoto(vm.uploadId);
      if (!photo) continue;
      if (clean !== photo.caption) await updatePhoto(vm.uploadId, { caption: clean });
      queue.enqueue(toQueueItem({ ...photo, caption: clean }));
    }
    view.value = online.value ? 'uploading' : 'offline';
  }

  /** Re-attempts every failed photo. */
  function retryFailed(): void {
    for (const vm of photos.value) {
      if (vm.status === 'error') queue.retry(vm.uploadId);
    }
    view.value = online.value ? 'uploading' : 'offline';
  }

  /** Clears the finished session and returns to the start. */
  function reset(): void {
    for (const vm of photos.value) URL.revokeObjectURL(vm.objectUrl);
    photos.value = [];
    caption.value = '';
    pickError.value = null;
    view.value = 'home';
  }

  function dismissPickError(): void {
    pickError.value = null;
  }

  return {
    view,
    photos,
    caption,
    processing,
    processingTotal,
    processingDone,
    pickError,
    online,
    counts,
    hasPhotos,
    init,
    pickFiles,
    removePhoto,
    setCaption,
    send,
    retryFailed,
    reset,
    dismissPickError,
  };
});
