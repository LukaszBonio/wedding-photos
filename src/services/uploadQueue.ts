/**
 * Client-side upload queue. Framework-agnostic and fully injectable so it can
 * be unit-tested with fake timers and mocks.
 *
 * Guarantees:
 *  - at most `maxConcurrent` uploads in flight per device,
 *  - exponential backoff with jitter for retryable failures (up to
 *    `maxAutoAttempts`), then the item is left in `error` for a manual retry,
 *  - a photo is removed from storage only after a confirmed success,
 *  - idempotency lives in the uploadId, so retries never duplicate on Drive.
 */
import type { UploadResult } from '@/api/gasClient';
import { MAX_CONCURRENT_UPLOADS, RETRY } from '@/constants';
import { computeBackoffDelay } from '@/utils/backoff';
import type { PhotoStatus } from '@/types';

/** Queue item — metadata only; the blob stays in IndexedDB until upload time. */
export interface QueueItem {
  uploadId: string;
  filename: string;
  mimeType: string;
  caption: string;
  createdAt: number;
  attempts: number;
  status: PhotoStatus;
  progress: number;
  lastError: string | null;
}

export interface UploadQueueDeps {
  /** Performs one upload attempt (fetches the blob, calls the API). */
  upload: (item: QueueItem) => Promise<UploadResult>;
  /** Persists a status/progress change to IndexedDB. */
  persist: (uploadId: string, changes: Partial<QueueItem>) => Promise<void>;
  /** Removes a photo from IndexedDB after a confirmed success. */
  remove: (uploadId: string) => Promise<void>;
  /** Whether the network is currently available. */
  isOnline: () => boolean;
  /** Emits a snapshot after every item state change (for the reactive store). */
  onChange: (item: QueueItem) => void;
  /** Backoff delay for a given attempt number (injectable for tests). */
  computeDelay?: (attempt: number) => number;
  /** Schedules a callback after ms; returns a cancel function (injectable). */
  schedule?: (fn: () => void, ms: number) => () => void;
  maxConcurrent?: number;
  maxAutoAttempts?: number;
}

export interface UploadQueue {
  /** Adds a photo to the queue and starts pumping. */
  enqueue: (item: QueueItem) => void;
  /** Resumes after reconnecting / returning to the foreground. */
  resume: () => void;
  /** Manually re-attempts a failed item (resets its attempt counter). */
  retry: (uploadId: string) => void;
  /** Current queue snapshot. */
  items: () => QueueItem[];
  /** Number of photos still awaiting a confirmed upload. */
  pendingCount: () => number;
}

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

export function createUploadQueue(deps: UploadQueueDeps): UploadQueue {
  const maxConcurrent = deps.maxConcurrent ?? MAX_CONCURRENT_UPLOADS;
  const maxAutoAttempts = deps.maxAutoAttempts ?? RETRY.maxAutoAttempts;
  const computeDelay = deps.computeDelay ?? computeBackoffDelay;
  const schedule = deps.schedule ?? defaultSchedule;

  const items = new Map<string, QueueItem>();
  const inFlight = new Set<string>();
  const retryTimers = new Map<string, () => void>();

  const emit = (item: QueueItem): void => deps.onChange({ ...item });

  function pump(): void {
    if (!deps.isOnline()) return;
    for (const item of items.values()) {
      if (inFlight.size >= maxConcurrent) break;
      if (
        item.status === 'ready' &&
        !inFlight.has(item.uploadId) &&
        !retryTimers.has(item.uploadId)
      ) {
        void attempt(item);
      }
    }
  }

  async function attempt(item: QueueItem): Promise<void> {
    inFlight.add(item.uploadId);
    item.attempts += 1;
    item.status = 'uploading';
    item.progress = 0;
    emit(item);
    await deps.persist(item.uploadId, {
      attempts: item.attempts,
      status: 'uploading',
      progress: 0,
    });

    let result: UploadResult;
    try {
      result = await deps.upload(item);
    } catch {
      result = { kind: 'retryable', reason: 'Błąd sieci.' };
    }
    inFlight.delete(item.uploadId);

    if (result.kind === 'success') {
      items.delete(item.uploadId);
      item.status = 'success';
      item.progress = 100;
      item.lastError = null;
      emit(item);
      await deps.remove(item.uploadId);
    } else if (result.kind === 'retryable' && item.attempts < maxAutoAttempts) {
      item.status = 'ready';
      item.lastError = result.reason;
      emit(item);
      await deps.persist(item.uploadId, { status: 'ready', lastError: result.reason });
      const cancel = schedule(() => {
        retryTimers.delete(item.uploadId);
        pump();
      }, computeDelay(item.attempts));
      retryTimers.set(item.uploadId, cancel);
    } else {
      item.status = 'error';
      item.lastError = result.reason;
      emit(item);
      await deps.persist(item.uploadId, { status: 'error', lastError: result.reason });
    }

    pump();
  }

  function enqueue(item: QueueItem): void {
    const status: PhotoStatus = deps.isOnline() ? 'ready' : 'offline';
    const stored: QueueItem = { ...item, status };
    items.set(stored.uploadId, stored);
    emit(stored);
    pump();
  }

  function resume(): void {
    for (const item of items.values()) {
      if (item.status === 'offline') {
        item.status = 'ready';
        emit(item);
      }
    }
    pump();
  }

  function retry(uploadId: string): void {
    const item = items.get(uploadId);
    if (!item || item.status !== 'error') return;
    item.status = 'ready';
    item.attempts = 0;
    item.lastError = null;
    emit(item);
    pump();
  }

  return {
    enqueue,
    resume,
    retry,
    items: () => [...items.values()],
    pendingCount: () => items.size,
  };
}
