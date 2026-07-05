/**
 * File-level validation for picked media files. Reads the header bytes,
 * classifies the format from magic bytes, and rejects empty files early.
 * Whether an image is actually decodable (notably HEIC outside Safari) is
 * decided later in the compression worker by attempting a real decode.
 */
import { ALLOWED_VIDEO_TYPES, MAX_GALLERY_BATCH } from '@/constants';
import type { DetectedImageFormat, MediaKind } from '@/types';

import { detectImageFormat } from './magicBytes';

/** Number of leading bytes needed to identify every supported format. */
export const HEADER_BYTES_TO_READ = 32;

/** Reason a picked file is rejected outright, before any decode attempt. */
export type FileRejectReason = 'unsupported-video' | 'empty';

/**
 * Result of validating a picked file. `format` is null when the byte signature
 * is unrecognised — the file is still passed forward, and the worker makes the
 * final decodability decision.
 */
export type FileValidation =
  | { readonly ok: true; readonly kind: MediaKind; readonly format: DetectedImageFormat | null }
  | { readonly ok: false; readonly reason: FileRejectReason };

/** Reads the first `count` bytes of a blob as a Uint8Array. */
export async function readHeaderBytes(
  blob: Blob,
  count = HEADER_BYTES_TO_READ,
): Promise<Uint8Array> {
  const buffer = await blob.slice(0, count).arrayBuffer();
  return new Uint8Array(buffer);
}

/** True when the file's declared type is a video. */
export function isVideoType(type: string): boolean {
  return type.startsWith('video/');
}

/** True when a gallery batch size is within the allowed limit. */
export function isBatchSizeAllowed(count: number): boolean {
  return count > 0 && count <= MAX_GALLERY_BATCH;
}

/**
 * Classifies a picked file. Rejects empty files and unsupported video formats;
 * accepts images (with format detection) and supported videos.
 */
export async function validateFile(file: File): Promise<FileValidation> {
  if (file.size === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (isVideoType(file.type)) {
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      return { ok: false, reason: 'unsupported-video' };
    }
    return { ok: true, kind: 'video', format: null };
  }

  const header = await readHeaderBytes(file);
  return { ok: true, kind: 'image', format: detectImageFormat(header) };
}
