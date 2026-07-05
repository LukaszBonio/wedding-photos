import type { DetectedImageFormat } from '@/types';

/** File extension per detected format. HEIC is always converted to JPEG. */
const EXTENSION_BY_FORMAT: Record<DetectedImageFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'jpg',
};

/**
 * Builds the advisory filename sent in the upload payload. The backend assigns
 * the authoritative Drive filename; this value is metadata only.
 */
export function buildClientFilename(uploadId: string, mimeType: string): string {
  const shortId = uploadId.replace(/-/g, '').slice(0, 8);
  const ext = EXTENSION_BY_FORMAT[mimeType as DetectedImageFormat] ?? 'bin';
  return `photo_${shortId}.${ext}`;
}
