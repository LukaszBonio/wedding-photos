import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory IndexedDB replacement (avoids the jsdom Blob/structured-clone quirk).
vi.mock('@/db/dexie', () => {
  const rows = new Map<string, unknown>();
  return {
    loadValidPhotos: vi.fn(async () => [...rows.values()]),
    putPhoto: vi.fn(async (photo: { uploadId: string }) => {
      rows.set(photo.uploadId, photo);
    }),
    getPhoto: vi.fn(async (id: string) => rows.get(id)),
    updatePhoto: vi.fn(async (id: string, changes: object) => {
      const current = rows.get(id);
      if (current) rows.set(id, { ...current, ...changes });
    }),
    deletePhoto: vi.fn(async (id: string) => {
      rows.delete(id);
    }),
    countPhotos: vi.fn(async () => rows.size),
  };
});

vi.mock('@/services/imageProcessor', () => ({
  supportsCompressionWorker: () => false,
  compressImage: vi.fn(async () => ({
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    width: 10,
    height: 10,
  })),
}));

vi.mock('@/api/gasClient', () => ({
  uploadPhoto: vi.fn(async () => ({ kind: 'success', fileId: 'drive-1' })),
}));

import { uploadPhoto } from '@/api/gasClient';
import { useUploadStore } from '@/stores/uploadStore';

function jpegFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'photo.jpg', { type: 'image/jpeg' });
}

describe('offline → reconnect flow (Stage 5 DoD)', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.clearAllMocks());

  it('queues while offline and auto-resumes on reconnect', async () => {
    const store = useUploadStore();
    store.online = false; // airplane mode

    await store.pickFiles([jpegFile()]);
    expect(store.view).toBe('preview');
    expect(store.photos).toHaveLength(1);

    await store.send();
    expect(store.view).toBe('offline');
    expect(store.photos[0]!.status).toBe('offline');
    expect(vi.mocked(uploadPhoto)).not.toHaveBeenCalled();

    // Network returns → the browser fires 'online'.
    window.dispatchEvent(new Event('online'));
    await flushPromises();

    expect(vi.mocked(uploadPhoto)).toHaveBeenCalledTimes(1);
    expect(store.photos[0]!.status).toBe('success');
    expect(store.view).toBe('success');
  });
});
