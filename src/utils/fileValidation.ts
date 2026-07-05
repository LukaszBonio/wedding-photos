/**
 * File-level validation for picked image files. Reads the header bytes,
 * classifies the format from magic bytes, and rejects empty files early.
 * Whether an image is actually decodable (notably HEIC outside Safari) is
 * decided later in the compression worker by attempting a real decode.
 */
import { MAX_GALLERY_BATCH } from '@/constants';
import type { DetectedImageFormat, MediaKind } from '@/types';

import { detectImageFormat } from './magicBytes';

/** Number of leading bytes needed to identify every supported format. */
export const HEADER_BYTES_TO_READ = 32;

/** Reason a picked file is rejected outright, before any decode attempt. */
export type FileRejectReason = 'empty';

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

/** True when a gallery batch size is within the allowed limit. */
export function isBatchSizeAllowed(count: number): boolean {
  return count > 0 && count <= MAX_GALLERY_BATCH;
}

/**
 * Classifies a picked file. Rejects empty files; accepts images with format detection.
 */
export async function validateFile(file: File): Promise<FileValidation> {
  if (file.size === 0) {
    return { ok: false, reason: 'empty' };
  }

  const header = await readHeaderBytes(file);
  return { ok: true, kind: 'image', format: detectImageFormat(header) };
}
