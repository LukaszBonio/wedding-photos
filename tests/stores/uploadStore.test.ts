import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/dexie', () => {
  const rows = new Map<string, unknown>();
  return {
    __rows: rows,
    loadValidPhotos: vi.fn(async () => [...rows.values()]),
    putPhoto: vi.fn(async (photo: { uploadId: string }) => void rows.set(photo.uploadId, photo)),
    getPhoto: vi.fn(async (id: string) => rows.get(id)),
    updatePhoto: vi.fn(async (id: string, changes: object) => {
      const current = rows.get(id);
      if (current) rows.set(id, { ...current, ...changes });
    }),
    deletePhoto: vi.fn(async (id: string) => void rows.delete(id)),
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

import { compressImage } from '@/services/imageProcessor';
import { uploadPhoto } from '@/api/gasClient';
import * as dexie from '@/db/dexie';
import { useUploadStore } from '@/stores/uploadStore';

const jpeg = (name = 'p.jpg'): File =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: 'image/jpeg' });

describe('uploadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (dexie as unknown as { __rows: Map<string, unknown> }).__rows.clear();
  });
  afterEach(() => vi.clearAllMocks());

  it('picks, compresses, and stages photos into the preview', async () => {
    const store = useUploadStore();
    await store.pickFiles([jpeg('a.jpg'), jpeg('b.jpg')]);
    expect(store.photos).toHaveLength(2);
    expect(store.view).toBe('preview');
    expect(store.photos.every((p) => p.status === 'ready')).toBe(true);
  });

  it('caps a batch at the gallery limit and warns', async () => {
    const store = useUploadStore();
    const files = Array.from({ length: 11 }, (_, i) => jpeg(`p${i}.jpg`));
    await store.pickFiles(files);
    expect(store.photos).toHaveLength(10);
    expect(store.pickError).toContain('10');
  });

  it('surfaces a compression error (e.g. HEIC) and skips that photo', async () => {
    vi.mocked(compressImage).mockRejectedValueOnce(
      new Error(
        'Twój telefon zapisuje zdjęcia w formacie HEIC. Wybierz JPEG lub zmień ustawienia aparatu.',
      ),
    );
    const store = useUploadStore();
    await store.pickFiles([jpeg()]);
    expect(store.photos).toHaveLength(0);
    expect(store.pickError).toContain('HEIC');
  });

  it('sends online and reaches success', async () => {
    const store = useUploadStore();
    await store.pickFiles([jpeg('a.jpg'), jpeg('b.jpg')]);
    await store.send();
    await flushPromises();
    expect(vi.mocked(uploadPhoto)).toHaveBeenCalledTimes(2);
    expect(store.view).toBe('success');
    expect(store.counts.success).toBe(2);
  });

  it('shows the error view on a permanent failure and recovers on retry', async () => {
    vi.mocked(uploadPhoto)
      .mockResolvedValueOnce({ kind: 'permanent', reason: 'Nieprawidłowy token.' })
      .mockResolvedValue({ kind: 'success', fileId: 'drive-2' });
    const store = useUploadStore();
    await store.pickFiles([jpeg()]);
    await store.send();
    await flushPromises();
    expect(store.view).toBe('error');
    expect(store.counts.failed).toBe(1);

    store.retryFailed();
    await flushPromises();
    expect(store.view).toBe('success');
    expect(store.counts.success).toBe(1);
  });

  it('removes a staged photo and returns home when empty', async () => {
    const store = useUploadStore();
    await store.pickFiles([jpeg()]);
    const id = store.photos[0]!.uploadId;
    await store.removePhoto(id);
    expect(store.photos).toHaveLength(0);
    expect(store.view).toBe('home');
  });

  it('resets the session', async () => {
    const store = useUploadStore();
    await store.pickFiles([jpeg()]);
    store.reset();
    expect(store.photos).toHaveLength(0);
    expect(store.caption).toBe('');
    expect(store.view).toBe('home');
  });

  it('restores persisted photos on init and resumes uploading', async () => {
    await dexie.putPhoto({
      uploadId: '550e8400-e29b-41d4-a716-446655440000',
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
      filename: 'photo_550e8400.jpg',
      mimeType: 'image/jpeg',
      caption: '',
      createdAt: 1,
      attempts: 0,
      status: 'ready',
      progress: 100,
      lastError: null,
    });
    const store = useUploadStore();
    await store.init();
    await flushPromises();
    expect(vi.mocked(uploadPhoto)).toHaveBeenCalledTimes(1);
    expect(store.view).toBe('success');
  });
});
