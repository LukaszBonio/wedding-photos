import { RETRY } from '@/constants';

/** HTTP statuses worth retrying (transient/infra). */
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Whether an HTTP status code should trigger an automatic retry. */
export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

/** Options for computeBackoffDelay; `rng` is injectable for deterministic tests. */
export interface BackoffOptions {
  baseMs?: number;
  factor?: number;
  jitterRatio?: number;
  maxDelayMs?: number;
  rng?: () => number;
}

/**
 * Exponential backoff with symmetric jitter. The jitter prevents dozens of
 * devices from retrying in the same second (thundering herd against GAS).
 * @param attempt 1-based attempt number.
 */
export function computeBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? RETRY.baseMs;
  const factor = options.factor ?? RETRY.factor;
  const jitterRatio = options.jitterRatio ?? RETRY.jitterRatio;
  const maxDelayMs = options.maxDelayMs ?? RETRY.maxDelayMs;
  const rng = options.rng ?? Math.random;

  const safeAttempt = attempt < 1 ? 1 : attempt;
  const raw = baseMs * Math.pow(factor, safeAttempt - 1);
  const capped = Math.min(raw, maxDelayMs);

  // jitterFactor in [1 - jitterRatio, 1 + jitterRatio].
  const jitterFactor = 1 + (rng() * 2 - 1) * jitterRatio;
  const withJitter = capped * jitterFactor;

  return Math.max(0, Math.round(withJitter));
}

/** Whether another automatic attempt is allowed. */
export function shouldRetry(attempt: number, maxAttempts: number = RETRY.maxAutoAttempts): boolean {
  return attempt < maxAttempts;
}
