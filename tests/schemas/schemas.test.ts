import { describe, expect, it } from 'vitest';

import {
  parsePersistedPhoto,
  parseUploadResponse,
  queuedPhotoSchema,
  safeParseUploadResponse,
  uploadResponseSchema,
} from '@/schemas';

describe('uploadResponse helpers', () => {
  it('parses a valid ok response', () => {
    expect(parseUploadResponse({ status: 'ok', message: 'Zapisano', fileId: 'abc' }).status).toBe(
      'ok',
    );
  });

  it('parses an error response with null fileId', () => {
    expect(
      parseUploadResponse({ status: 'error', message: 'Zły token', fileId: null }).fileId,
    ).toBeNull();
  });

  it('throws on an unknown status', () => {
    expect(() => parseUploadResponse({ status: 'maybe', message: 'x', fileId: null })).toThrow();
  });

  it('safeParse reports failure on a missing message', () => {
    expect(safeParseUploadResponse({ status: 'ok', fileId: null }).success).toBe(false);
  });

  it('safeParse reports success on a valid body', () => {
    expect(safeParseUploadResponse({ status: 'ok', message: 'ok', fileId: 'f1' }).success).toBe(
      true,
    );
  });

  it('exposes the raw schema object', () => {
    expect(
      uploadResponseSchema.safeParse({ status: 'ok', message: 'm', fileId: null }).success,
    ).toBe(true);
  });
});

describe('persistedPhoto helpers', () => {
  const valid = {
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    filename: 'photo_550e8400.jpg',
    mimeType: 'image/jpeg',
    caption: '',
    createdAt: 1_700_000_000_000,
    attempts: 0,
    status: 'ready' as const,
    progress: 0,
    lastError: null,
  };

  it('parses a valid record', () => {
    expect(parsePersistedPhoto(valid).uploadId).toBe(valid.uploadId);
  });

  it('parses a record with an error message', () => {
    expect(parsePersistedPhoto({ ...valid, lastError: 'timeout' }).lastError).toBe('timeout');
  });

  it('throws on a bad uploadId', () => {
    expect(() => parsePersistedPhoto({ ...valid, uploadId: 'nope' })).toThrow();
  });

  it('throws on a non-Blob blob', () => {
    expect(() => parsePersistedPhoto({ ...valid, blob: 'not-a-blob' })).toThrow();
  });

  it('accepts a blob-like object (cross-realm Blob)', () => {
    const blobLike = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
      size: 1,
      type: 'image/jpeg',
    };
    expect(parsePersistedPhoto({ ...valid, blob: blobLike }).blob).toBe(blobLike);
  });

  it('throws on a blob-like object with a non-numeric size', () => {
    const bad = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)), size: 'big' };
    expect(() => parsePersistedPhoto({ ...valid, blob: bad })).toThrow();
  });

  it('throws on an over-long caption', () => {
    expect(() => parsePersistedPhoto({ ...valid, caption: 'x'.repeat(201) })).toThrow();
  });

  it('throws on an unknown status', () => {
    expect(() => parsePersistedPhoto({ ...valid, status: 'weird' })).toThrow();
  });

  it('throws on progress above 100', () => {
    expect(() => parsePersistedPhoto({ ...valid, progress: 101 })).toThrow();
  });

  it('exposes the raw schema object', () => {
    expect(queuedPhotoSchema.safeParse({ ...valid, attempts: -1 }).success).toBe(false);
  });
});
