import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateUploadId, UUID_REGEX } from '@/utils/uuid';

describe('generateUploadId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a valid UUID via native crypto.randomUUID', () => {
    const id = generateUploadId();
    expect(id).toMatch(UUID_REGEX);
  });

  it('produces unique values', () => {
    const a = generateUploadId();
    const b = generateUploadId();
    expect(a).not.toBe(b);
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) & 0xff;
        return arr;
      },
    });
    const id = generateUploadId();
    expect(id).toMatch(UUID_REGEX);
    // Version nibble must be 4.
    expect(id[14]).toBe('4');
    // Variant nibble must be one of 8, 9, a, b.
    expect('89ab').toContain(id[19]);
  });

  it('falls back to Math.random when crypto is entirely absent', () => {
    vi.stubGlobal('crypto', undefined);
    const id = generateUploadId();
    expect(id).toMatch(UUID_REGEX);
  });
});
