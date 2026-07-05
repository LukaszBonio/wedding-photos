import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUploadQueue, type QueueItem, type UploadQueueDeps } from '@/services/uploadQueue';
import type { UploadResult } from '@/api/gasClient';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    caption: '',
    createdAt: 1,
    attempts: 0,
    status: 'ready',
    progress: 0,
    lastError: null,
    ...overrides,
  };
}

interface Harness {
  scheduled: Array<() => void>;
  changes: QueueItem[];
  upload: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  online: { value: boolean };
  deps: UploadQueueDeps;
}

function harness(overrides: Partial<UploadQueueDeps> = {}): Harness {
  const scheduled: Array<() => void> = [];
  const changes: QueueItem[] = [];
  const online = { value: true };
  const upload = vi.fn<(item: QueueItem) => Promise<UploadResult>>();
  const persist = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);

  const deps: UploadQueueDeps = {
    upload,
    persist,
    remove,
    isOnline: () => online.value,
    onChange: (item) => changes.push(item),
    computeDelay: () => 1000,
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
    ...overrides,
  };

  return { scheduled, changes, upload, persist, remove, online, deps };
}

const lastStatus = (changes: QueueItem[], id: string): string | undefined =>
  [...changes].reverse().find((c) => c.uploadId === id)?.status;

const ID = '550e8400-e29b-41d4-a716-446655440000';

describe('createUploadQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads a ready item and removes it on success', async () => {
    const h = harness();
    h.upload.mockResolvedValue({ kind: 'success', fileId: 'f1' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.remove).toHaveBeenCalledWith(ID);
    expect(q.pendingCount()).toBe(0);
    expect(lastStatus(h.changes, ID)).toBe('success');
  });

  it('marks a permanent failure as error without removing', async () => {
    const h = harness();
    h.upload.mockResolvedValue({ kind: 'permanent', reason: 'Nieprawidłowy token.' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    expect(h.remove).not.toHaveBeenCalled();
    expect(q.pendingCount()).toBe(1);
    expect(lastStatus(h.changes, ID)).toBe('error');
  });

  it('retries a retryable failure via the scheduler, then succeeds', async () => {
    const h = harness();
    h.upload
      .mockResolvedValueOnce({ kind: 'retryable', reason: 'HTTP 503' })
      .mockResolvedValueOnce({ kind: 'success', fileId: 'f1' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.scheduled).toHaveLength(1);

    h.scheduled[0]!();
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(2);
    expect(q.pendingCount()).toBe(0);
    expect(h.remove).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAutoAttempts and leaves the item in error', async () => {
    const h = harness({ maxAutoAttempts: 2 });
    h.upload.mockResolvedValue({ kind: 'retryable', reason: 'HTTP 500' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    h.scheduled[0]!();
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(2);
    expect(lastStatus(h.changes, ID)).toBe('error');
    expect(q.pendingCount()).toBe(1);
  });

  it('never exceeds maxConcurrent in-flight uploads', async () => {
    const h = harness({ maxConcurrent: 2 });
    let resolveFirst: (r: UploadResult) => void = () => {};
    h.upload.mockImplementation(
      (item: QueueItem) =>
        new Promise<UploadResult>((resolve) => {
          if (item.uploadId.endsWith('1')) resolveFirst = resolve;
        }),
    );
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem({ uploadId: '11111111-1111-4111-8111-111111111111' }));
    q.enqueue(makeItem({ uploadId: '22222222-2222-4222-8222-222222222222' }));
    q.enqueue(makeItem({ uploadId: '33333333-3333-4333-8333-333333333333' }));
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(2);

    resolveFirst({ kind: 'success', fileId: 'f1' });
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(3);
  });

  it('holds items while offline and sends them on resume', async () => {
    const h = harness();
    h.online.value = false;
    h.upload.mockResolvedValue({ kind: 'success', fileId: 'f1' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    expect(h.upload).not.toHaveBeenCalled();
    expect(lastStatus(h.changes, ID)).toBe('offline');

    h.online.value = true;
    q.resume();
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(q.pendingCount()).toBe(0);
  });

  it('manually retries a failed item', async () => {
    const h = harness();
    h.upload
      .mockResolvedValueOnce({ kind: 'permanent', reason: 'Błąd' })
      .mockResolvedValueOnce({ kind: 'success', fileId: 'f1' });
    const q = createUploadQueue(h.deps);
    q.enqueue(makeItem());
    await tick();
    expect(lastStatus(h.changes, ID)).toBe('error');

    q.retry(ID);
    await tick();
    expect(h.upload).toHaveBeenCalledTimes(2);
    expect(q.pendingCount()).toBe(0);
  });
});
