/**
 * API client: posts photos and videos to the Google Apps Script Web App.
 *
 * Transport constraints (GAS cannot answer a CORS preflight):
 *  - method POST, Content-Type text/plain → a "simple request", no preflight,
 *  - no custom headers,
 *  - JSON body with Base64 data inside.
 */
import { MAX_UPLOAD_BASE64_LENGTH } from '@/constants';
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

/** Per-attempt request timeout (60s for photos, 120s for videos). */
export const REQUEST_TIMEOUT_MS = 60_000;
export const VIDEO_TIMEOUT_MS = 120_000;

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

/** Uploads a video in a single request (same as photos but with action flag). Never throws. */
export async function uploadVideo(input: UploadInput): Promise<UploadResult> {
  if (estimateBase64Length(input.blob.size) > MAX_UPLOAD_BASE64_LENGTH) {
    return { kind: 'permanent', reason: 'Film jest zbyt duży (max 25 MB).' };
  }

  const dataBase64 = await blobToBase64(input.blob);
  const body = JSON.stringify({
    action: 'uploadVideo',
    token: import.meta.env.VITE_UPLOAD_TOKEN,
    uploadId: input.uploadId,
    filename: input.filename,
    mimeType: input.mimeType,
    caption: input.caption,
    dataBase64,
  });

  const raw = await postToGas(body, VIDEO_TIMEOUT_MS);
  return classifyResponse(raw);
}
