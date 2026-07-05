import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadPhoto, type UploadInput } from '@/api/gasClient';

function input(overrides: Partial<UploadInput> = {}): UploadInput {
  return {
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    caption: '',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv('VITE_GAS_URL', 'https://example.test/exec');
  vi.stubEnv('VITE_UPLOAD_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('uploadPhoto', () => {
  it('returns success with fileId on an ok body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { status: 'ok', message: 'zapisano', fileId: 'abc' })),
    );
    const result = await uploadPhoto(input());
    expect(result).toEqual({ kind: 'success', fileId: 'abc' });
  });

  it('sends a text/plain POST with the token in the body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { status: 'ok', message: 'ok', fileId: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    await uploadPhoto(input());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/exec');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
    const parsedBody = JSON.parse(init.body as string) as { token: string; uploadId: string };
    expect(parsedBody.token).toBe('test-token');
    expect(parsedBody.uploadId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('treats a backend error body as permanent', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { status: 'error', message: 'Nieprawidłowy token.', fileId: null }),
        ),
    );
    const result = await uploadPhoto(input());
    expect(result).toEqual({ kind: 'permanent', reason: 'Nieprawidłowy token.' });
  });

  it('classifies 5xx as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, {})));
    expect((await uploadPhoto(input())).kind).toBe('retryable');
  });

  it('classifies 4xx as permanent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, {})));
    expect((await uploadPhoto(input())).kind).toBe('permanent');
  });

  it('classifies a network error as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await uploadPhoto(input())).kind).toBe('retryable');
  });

  it('classifies an abort/timeout as retryable', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    const result = await uploadPhoto(input());
    expect(result).toEqual({ kind: 'retryable', reason: 'Przekroczono czas oczekiwania.' });
  });

  it('treats malformed JSON as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('bad json')),
      } as unknown as Response),
    );
    expect((await uploadPhoto(input())).kind).toBe('retryable');
  });

  it('rejects an oversized photo as permanent before hitting the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const bigBlob = {
      size: 20_000_000,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Blob;
    const result = await uploadPhoto(input({ blob: bigBlob }));
    expect(result).toEqual({ kind: 'permanent', reason: 'Zdjęcie jest zbyt duże.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a schema-invalid body as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'weird' })));
    expect((await uploadPhoto(input())).kind).toBe('retryable');
  });
});
