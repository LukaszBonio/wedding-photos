/**
 * The single API client: posts one photo to the Google Apps Script Web App.
 *
 * Transport constraints (GAS cannot answer a CORS preflight):
 *  - method POST, Content-Type text/plain → a "simple request", no preflight,
 *  - no custom headers,
 *  - JSON body with Base64 image data inside.
 *
 * GAS always returns HTTP 200, so success/failure is read from the body's
 * `status` field. Transport-level failures (network, timeout, 429/5xx) are
 * classified as retryable; backend rejections and 4xx as permanent.
 */
import { MAX_UPLOAD_BASE64_LENGTH } from '@/constants';
import { safeParseUploadResponse } from '@/schemas';
import { isRetryableHttpStatus } from '@/utils/backoff';
import { blobToBase64, estimateBase64Length } from '@/utils/blobToBase64';

/** Everything needed to upload one photo. */
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

/**
 * Uploads a single photo. Never throws — every outcome is a classified result.
 */
export async function uploadPhoto(
  input: UploadInput,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<UploadResult> {
  // Cheap guard before encoding a possibly-huge blob.
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(import.meta.env.VITE_GAS_URL, {
      method: 'POST',
      // Only a safelisted Content-Type — no custom headers, so no CORS preflight.
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

  const parsed = safeParseUploadResponse(json);
  if (!parsed.success) {
    return { kind: 'retryable', reason: 'Nieoczekiwana odpowiedź serwera.' };
  }
  if (parsed.data.status === 'ok' && parsed.data.fileId) {
    return { kind: 'success', fileId: parsed.data.fileId };
  }
  // Backend rejected the upload (bad token, validation, event closed, ...).
  return { kind: 'permanent', reason: parsed.data.message };
}
