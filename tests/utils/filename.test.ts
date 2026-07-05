import { describe, expect, it } from 'vitest';

import { buildClientFilename } from '@/utils/filename';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('buildClientFilename', () => {
  it('uses the first 8 hex chars and .jpg for JPEG', () => {
    expect(buildClientFilename(uuid, 'image/jpeg')).toBe('photo_550e8400.jpg');
  });

  it('uses .png for PNG', () => {
    expect(buildClientFilename(uuid, 'image/png')).toBe('photo_550e8400.png');
  });

  it('uses .jpg for HEIC (converted to JPEG)', () => {
    expect(buildClientFilename(uuid, 'image/heic')).toBe('photo_550e8400.jpg');
  });
});
