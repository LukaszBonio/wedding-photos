import { z } from 'zod';

import { MAX_CAPTION_LENGTH } from '@/constants';
import { UUID_REGEX } from '@/utils/uuid';

/**
 * Structural Blob check. Prefer instanceof, but fall back to duck-typing so
 * validation survives Blobs that cross realms (e.g. structured-clone through
 * IndexedDB), while still rejecting non-blob values.
 */
function isBlobLike(value: unknown): boolean {
  if (value instanceof Blob) return true;
  const candidate = value as { arrayBuffer?: unknown; size?: unknown } | null | undefined;
  return typeof candidate?.arrayBuffer === 'function' && typeof candidate?.size === 'number';
}

/** Backend response body. Validated at the API boundary. */
export const uploadResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  message: z.string(),
  fileId: z.string().nullable(),
});

export type UploadResponseParsed = z.infer<typeof uploadResponseSchema>;

/**
 * Shape validated when reading a record back from IndexedDB, guarding against
 * records written by an older app version. The Blob is validated structurally.
 */
export const queuedPhotoSchema = z.object({
  uploadId: z.string().regex(UUID_REGEX),
  blob: z.custom<Blob>(isBlobLike, { message: 'Nieprawidłowy plik.' }),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  caption: z.string().max(MAX_CAPTION_LENGTH),
  createdAt: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  status: z.enum(['ready', 'uploading', 'success', 'error', 'offline']),
  progress: z.number().min(0).max(100),
  lastError: z.string().nullable(),
});

export type QueuedPhotoParsed = z.infer<typeof queuedPhotoSchema>;

/** Parses a backend response, throwing on invalid input. */
export function parseUploadResponse(data: unknown): UploadResponseParsed {
  return uploadResponseSchema.parse(data);
}

/** Non-throwing variant for the API boundary. */
export function safeParseUploadResponse(
  data: unknown,
): ReturnType<typeof uploadResponseSchema.safeParse> {
  return uploadResponseSchema.safeParse(data);
}

/** Parses a persisted IndexedDB record, throwing on invalid input. */
export function parsePersistedPhoto(data: unknown): QueuedPhotoParsed {
  return queuedPhotoSchema.parse(data);
}
