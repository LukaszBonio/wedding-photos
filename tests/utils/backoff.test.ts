import { describe, expect, it } from 'vitest';

import { computeBackoffDelay, isRetryableHttpStatus, shouldRetry } from '@/utils/backoff';

describe('computeBackoffDelay', () => {
  const noJitter = { rng: () => 0.5 }; // jitterFactor === 1

  it('grows exponentially with default parameters', () => {
    expect(computeBackoffDelay(1, noJitter)).toBe(2000);
    expect(computeBackoffDelay(2, noJitter)).toBe(4000);
    expect(computeBackoffDelay(3, noJitter)).toBe(8000);
  });

  it('applies the lower jitter bound when rng returns 0', () => {
    expect(computeBackoffDelay(1, { rng: () => 0 })).toBe(1400); // 2000 * 0.7
  });

  it('applies the upper jitter bound when rng returns 1', () => {
    expect(computeBackoffDelay(1, { rng: () => 1 })).toBe(2600); // 2000 * 1.3
  });

  it('caps the delay at maxDelayMs', () => {
    expect(computeBackoffDelay(20, { rng: () => 0.5, maxDelayMs: 60000 })).toBe(60000);
  });

  it('treats attempts below 1 as attempt 1', () => {
    expect(computeBackoffDelay(0, noJitter)).toBe(2000);
  });

  it('honours custom options', () => {
    expect(
      computeBackoffDelay(2, { baseMs: 1000, factor: 3, jitterRatio: 0, rng: () => 0.5 }),
    ).toBe(3000);
  });

  it('uses Math.random by default and stays within jitter bounds', () => {
    const delay = computeBackoffDelay(1);
    expect(delay).toBeGreaterThanOrEqual(1400);
    expect(delay).toBeLessThanOrEqual(2600);
  });
});

describe('isRetryableHttpStatus', () => {
  it('retries transient statuses', () => {
    for (const s of [408, 429, 500, 502, 503, 504]) {
      expect(isRetryableHttpStatus(s)).toBe(true);
    }
  });

  it('does not retry permanent statuses', () => {
    for (const s of [200, 400, 401, 403, 404]) {
      expect(isRetryableHttpStatus(s)).toBe(false);
    }
  });
});

describe('shouldRetry', () => {
  it('allows retries below the cap', () => {
    expect(shouldRetry(1)).toBe(true);
    expect(shouldRetry(4)).toBe(true);
  });

  it('stops at the cap', () => {
    expect(shouldRetry(5)).toBe(false);
    expect(shouldRetry(2, 2)).toBe(false);
  });
});
