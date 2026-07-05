import { describe, expect, it } from 'vitest';

import {
  HEADER_BYTES_TO_READ,
  isBatchSizeAllowed,
  readHeaderBytes,
  validateFile,
} from '@/utils/fileValidation';

function fileFrom(bytes: number[], type: string, name = 'f'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

describe('isBatchSizeAllowed', () => {
  it('rejects zero and over-limit, accepts within limit', () => {
    expect(isBatchSizeAllowed(0)).toBe(false);
    expect(isBatchSizeAllowed(1)).toBe(true);
    expect(isBatchSizeAllowed(10)).toBe(true);
    expect(isBatchSizeAllowed(11)).toBe(false);
  });
});

describe('readHeaderBytes', () => {
  it('reads at most the requested number of leading bytes', async () => {
    const file = fileFrom([1, 2, 3, 4, 5], 'image/jpeg');
    const header = await readHeaderBytes(file, 3);
    expect(Array.from(header)).toEqual([1, 2, 3]);
  });

  it('defaults to HEADER_BYTES_TO_READ', async () => {
    const file = fileFrom(new Array(64).fill(0x41), 'image/jpeg');
    const header = await readHeaderBytes(file);
    expect(header.length).toBe(HEADER_BYTES_TO_READ);
  });
});

describe('validateFile', () => {
  it('rejects an empty file', async () => {
    const result = await validateFile(fileFrom([], 'image/jpeg'));
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts a JPEG and reports its format', async () => {
    const result = await validateFile(fileFrom(JPEG, 'image/jpeg'));
    expect(result).toEqual({ ok: true, kind: 'image', format: 'image/jpeg' });
  });

  it('accepts an unrecognised signature with a null format', async () => {
    const result = await validateFile(fileFrom([0x00, 0x01, 0x02, 0x03], 'image/webp'));
    expect(result).toEqual({ ok: true, kind: 'image', format: null });
  });
});
