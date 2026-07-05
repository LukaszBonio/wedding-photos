// @vitest-environment node
import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  countPhotos,
  db,
  deletePhoto,
  getPhoto,
  loadValidPhotos,
  putPhoto,
  updatePhoto,
} from '@/db/dexie';
import type { QueuedPhoto } from '@/types';

function makePhoto(overrides: Partial<QueuedPhoto> = {}): QueuedPhoto {
  return {
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    filename: 'photo_550e8400.jpg',
    mimeType: 'image/jpeg',
    caption: '',
    createdAt: 1000,
    attempts: 0,
    status: 'ready',
    progress: 0,
    lastError: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await db.photos.clear();
});

afterEach(async () => {
  await db.photos.clear();
});

describe('dexie photo repository', () => {
  it('stores and retrieves a photo, preserving the blob', async () => {
    const photo = makePhoto();
    await putPhoto(photo);
    const loaded = await getPhoto(photo.uploadId);
    expect(loaded?.uploadId).toBe(photo.uploadId);
    expect(typeof loaded?.blob.arrayBuffer).toBe('function');
    expect(loaded?.blob.size).toBe(3);
  });

  it('applies partial updates', async () => {
    const photo = makePhoto();
    await putPhoto(photo);
    await updatePhoto(photo.uploadId, { status: 'uploading', progress: 50, attempts: 1 });
    const loaded = await getPhoto(photo.uploadId);
    expect(loaded?.status).toBe('uploading');
    expect(loaded?.progress).toBe(50);
    expect(loaded?.attempts).toBe(1);
  });

  it('deletes a photo', async () => {
    const photo = makePhoto();
    await putPhoto(photo);
    await deletePhoto(photo.uploadId);
    expect(await getPhoto(photo.uploadId)).toBeUndefined();
    expect(await countPhotos()).toBe(0);
  });

  it('returns undefined for a missing photo', async () => {
    expect(await getPhoto('11111111-1111-4111-8111-111111111111')).toBeUndefined();
  });

  it('loads photos oldest-first', async () => {
    await putPhoto(
      makePhoto({ uploadId: '11111111-1111-4111-8111-111111111111', createdAt: 3000 }),
    );
    await putPhoto(
      makePhoto({ uploadId: '22222222-2222-4222-8222-222222222222', createdAt: 1000 }),
    );
    await putPhoto(
      makePhoto({ uploadId: '33333333-3333-4333-8333-333333333333', createdAt: 2000 }),
    );
    const loaded = await loadValidPhotos();
    expect(loaded.map((p) => p.createdAt)).toEqual([1000, 2000, 3000]);
  });

  it('prunes invalid records on load', async () => {
    await putPhoto(makePhoto());
    // Insert a structurally invalid record directly (bypassing validation).
    await db.photos.put({ uploadId: 'bogus-record', status: 'nonsense' } as unknown as QueuedPhoto);
    const loaded = await loadValidPhotos();
    expect(loaded).toHaveLength(1);
    expect(await countPhotos()).toBe(1);
  });
});
