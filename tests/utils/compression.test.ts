import { describe, expect, it } from 'vitest';

import {
  computeTargetDimensions,
  decideResizeNeeded,
  isLargerThanOriginal,
  pickDynamicQuality,
} from '@/utils/compression';

const MB = 1024 * 1024;

describe('decideResizeNeeded', () => {
  it('keeps a standard 12 MP photo under 8 MB at full resolution', () => {
    expect(decideResizeNeeded(4032, 3024, 5 * MB)).toBe(false); // 12.19 MP
  });

  it('resizes when megapixels exceed the threshold', () => {
    expect(decideResizeNeeded(6000, 4000, 5 * MB)).toBe(true); // 24 MP
  });

  it('resizes when the file is 8 MB or larger, even at low resolution', () => {
    expect(decideResizeNeeded(2000, 1500, 8 * MB)).toBe(true);
  });

  it('keeps small low-resolution photos', () => {
    expect(decideResizeNeeded(1000, 800, 1 * MB)).toBe(false);
  });
});

describe('computeTargetDimensions', () => {
  it('leaves dimensions within the limit unchanged', () => {
    expect(computeTargetDimensions(3000, 2000)).toEqual({ width: 3000, height: 2000 });
  });

  it('scales a landscape photo to a 3200 px long edge', () => {
    expect(computeTargetDimensions(4032, 3024)).toEqual({ width: 3200, height: 2400 });
  });

  it('scales a portrait photo to a 3200 px long edge', () => {
    expect(computeTargetDimensions(3024, 4032)).toEqual({ width: 2400, height: 3200 });
  });

  it('preserves aspect ratio via rounding', () => {
    const result = computeTargetDimensions(8000, 6000);
    expect(result.width).toBe(3200);
    expect(result.height).toBe(2400);
  });
});

describe('pickDynamicQuality', () => {
  it('uses 0.90 for large outputs', () => {
    expect(pickDynamicQuality(8_000_000)).toBe(0.9);
  });

  it('uses 0.91 above 6 MP', () => {
    expect(pickDynamicQuality(6_500_000)).toBe(0.91);
  });

  it('uses 0.92 above 4 MP', () => {
    expect(pickDynamicQuality(5_000_000)).toBe(0.92);
  });

  it('uses 0.93 for small outputs', () => {
    expect(pickDynamicQuality(2_000_000)).toBe(0.93);
  });

  it('never drops below 0.90', () => {
    expect(pickDynamicQuality(50_000_000)).toBeGreaterThanOrEqual(0.9);
  });
});

describe('isLargerThanOriginal', () => {
  it('is true when the candidate is bigger', () => {
    expect(isLargerThanOriginal(1000, 900)).toBe(true);
  });

  it('is false when the candidate is smaller', () => {
    expect(isLargerThanOriginal(800, 900)).toBe(false);
  });

  it('is false when sizes are equal', () => {
    expect(isLargerThanOriginal(900, 900)).toBe(false);
  });
});
