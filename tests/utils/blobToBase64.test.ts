import { describe, expect, it } from 'vitest';

import { arrayBufferToBase64, blobToBase64, estimateBase64Length } from '@/utils/blobToBase64';

describe('estimateBase64Length', () => {
  it('matches the 4/3 expansion rounded up', () => {
    expect(estimateBase64Length(0)).toBe(0);
    expect(estimateBase64Length(1)).toBe(4);
    expect(estimateBase64Length(3)).toBe(4);
    expect(estimateBase64Length(6)).toBe(8);
  });
});

describe('arrayBufferToBase64', () => {
  it('encodes a short buffer', () => {
    const bytes = new TextEncoder().encode('Hello');
    expect(arrayBufferToBase64(bytes.buffer)).toBe('SGVsbG8=');
  });

  it('encodes across multiple chunks', () => {
    const size = 0x8000 * 2 + 5; // spans three chunks
    const bytes = new Uint8Array(size).fill(65); // 'A'
    const result = arrayBufferToBase64(bytes.buffer);
    expect(result).toBe(btoa('A'.repeat(size)));
  });
});

describe('blobToBase64', () => {
  it('round-trips a blob to Base64', async () => {
    const blob = new Blob([new TextEncoder().encode('Ala ma kota')]);
    expect(await blobToBase64(blob)).toBe(btoa('Ala ma kota'));
  });
});
