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
export function buildClientFilename(uploadId: string, format: DetectedImageFormat): string {
  const shortId = uploadId.replace(/-/g, '').slice(0, 8);
  return `photo_${shortId}.${EXTENSION_BY_FORMAT[format]}`;
}
