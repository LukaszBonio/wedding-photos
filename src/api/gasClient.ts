/**
 * API client: posts photos and videos (single request each) to the
 * Google Apps Script Web App.
 *
 * Transport constraints (GAS cannot answer a CORS preflight):
 *  - method POST, Content-Type text/plain → a "simple request", no preflight,
 *  - no custom headers,
 *  - JSON body with Base64 data inside.
 */
import { MAX_UPLOAD_BASE64_LENGTH, VIDEO_CHUNK_SIZE } from '@/constants';
import { safeParseUploadResponse } from '@/schemas';
import { isRetryableHttpStatus } from '@/utils/backoff';
import { blobToBase64, estimateBase64Length } from '@/utils/blobToBase64';

/** Everything needed to upload one media file. */
export interface UploadInput {
  uploadId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  caption: string;
}

/** Outcome of a single upload attempt. */
export type UploadResult =
  | { kind: 'success'; fileId: string }
  | { kind: 'retryable'; reason: string }
  | { kind: 'permanent'; reason: string };

/** Per-attempt request timeout. */
export const REQUEST_TIMEOUT_MS = 60_000;
/** Longer timeout for video chunk uploads. */
export const VIDEO_CHUNK_TIMEOUT_MS = 120_000;

async function postToGas(
  body: string,
  timeoutMs: number,
): Promise<UploadResult | { kind: 'json'; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(import.meta.env.VITE_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as { name?: string }).name === 'AbortError';
    return {
      kind: 'retryable',
      reason: aborted ? 'Przekroczono czas oczekiwania.' : 'Błąd sieci.',
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return isRetryableHttpStatus(response.status)
      ? { kind: 'retryable', reason: `HTTP ${response.status}` }
      : { kind: 'permanent', reason: `HTTP ${response.status}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { kind: 'retryable', reason: 'Nieprawidłowa odpowiedź serwera.' };
  }

  return { kind: 'json', data: json };
}

function classifyResponse(raw: UploadResult | { kind: 'json'; data: unknown }): UploadResult {
  if (raw.kind !== 'json') return raw as UploadResult;
  const parsed = safeParseUploadResponse(raw.data);
  if (!parsed.success) return { kind: 'retryable', reason: 'Nieoczekiwana odpowiedź serwera.' };
  if (parsed.data.status === 'ok' && parsed.data.fileId)
    return { kind: 'success', fileId: parsed.data.fileId };
  if (parsed.data.status === 'error')
    return { kind: 'permanent', reason: parsed.data.message };
  return { kind: 'retryable', reason: parsed.data.message };
}

/** Uploads a single photo. Never throws. */
export async function uploadPhoto(input: UploadInput): Promise<UploadResult> {
  if (estimateBase64Length(input.blob.size) > MAX_UPLOAD_BASE64_LENGTH) {
    return { kind: 'permanent', reason: 'Zdjęcie jest zbyt duże.' };
  }

  const dataBase64 = await blobToBase64(input.blob);
  const body = JSON.stringify({
    token: import.meta.env.VITE_UPLOAD_TOKEN,
    uploadId: input.uploadId,
    filename: input.filename,
    mimeType: input.mimeType,
    caption: input.caption,
    dataBase64,
  });

  const raw = await postToGas(body, REQUEST_TIMEOUT_MS);
  return classifyResponse(raw);
}

/**
 * Uploads a video in chunks. Each chunk is saved as a temp file on Drive;
 * the last chunk triggers server-side merge into the final video.
 * Never throws. Reports progress via optional callback.
 */
export async function uploadVideo(
  input: UploadInput,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const totalChunks = Math.ceil(input.blob.size / VIDEO_CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * VIDEO_CHUNK_SIZE;
    const end = Math.min(start + VIDEO_CHUNK_SIZE, input.blob.size);
    const chunkBlob = input.blob.slice(start, end);
    const dataBase64 = await blobToBase64(chunkBlob);

    const body = JSON.stringify({
      action: 'uploadVideoChunk',
      token: import.meta.env.VITE_UPLOAD_TOKEN,
      uploadId: input.uploadId,
      chunkIndex: i,
      totalChunks,
      filename: input.filename,
      mimeType: input.mimeType,
      caption: input.caption,
      dataBase64,
    });

    const raw = await postToGas(body, VIDEO_CHUNK_TIMEOUT_MS);

    if (raw.kind !== 'json') return raw as UploadResult;

    const parsed = safeParseUploadResponse(raw.data);
    if (!parsed.success)
      return { kind: 'retryable', reason: 'Nieoczekiwana odpowiedź serwera.' };
    if (parsed.data.status === 'error')
      return { kind: 'permanent', reason: parsed.data.message };

    if (i === totalChunks - 1) {
      if (parsed.data.fileId) return { kind: 'success', fileId: parsed.data.fileId };
      return { kind: 'retryable', reason: 'Brak potwierdzenia zapisu.' };
    }

    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
  }

  return { kind: 'retryable', reason: 'Nieoczekiwany koniec przesyłania.' };
}
