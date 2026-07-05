import { describe, expect, it } from 'vitest';

import { detectImageFormat } from '@/utils/magicBytes';

function heif(brand: string): Uint8Array {
  const size = [0x00, 0x00, 0x00, 0x18];
  const ftyp = [...'ftyp'].map((c) => c.charCodeAt(0));
  const brandBytes = [...brand].map((c) => c.charCodeAt(0));
  return new Uint8Array([...size, ...ftyp, ...brandBytes, 0x00, 0x00, 0x00, 0x00]);
}

describe('detectImageFormat', () => {
  it('detects JPEG', () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('detects PNG', () => {
    expect(
      detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
  });

  it('detects HEIC (brand heic)', () => {
    expect(detectImageFormat(heif('heic'))).toBe('image/heic');
  });

  it('detects HEIF (brand mif1)', () => {
    expect(detectImageFormat(heif('mif1'))).toBe('image/heic');
  });

  it('returns null for an unknown signature', () => {
    expect(detectImageFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it('returns null for a too-short buffer', () => {
    expect(detectImageFormat(new Uint8Array([0xff]))).toBeNull();
  });

  it('returns null for ftyp with an unrecognised brand', () => {
    expect(detectImageFormat(heif('qt  '))).toBeNull();
  });

  it('returns null for a long buffer that is not an ftyp box', () => {
    expect(detectImageFormat(new Uint8Array(16))).toBeNull();
  });
});
