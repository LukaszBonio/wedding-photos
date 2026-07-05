/** Image formats the client can recognise from a byte signature. */
export type DetectedImageFormat = 'image/jpeg' | 'image/png' | 'image/heic';

/** Media kind flag attached to validated files. */
export type MediaKind = 'image' | 'video';

/** Lifecycle status of a photo in the upload queue. */
export type PhotoStatus = 'ready' | 'uploading' | 'success' | 'error' | 'offline';

/** Views driven by the upload state machine (see useHashRouter in Stage 4c). */
export type AppView = 'home' | 'preview' | 'uploading' | 'success' | 'error' | 'offline';

/** A compressed photo persisted in IndexedDB and processed by the queue. */
export interface QueuedPhoto {
  /** UUID v4 — stable across retries; used for backend idempotency. */
  uploadId: string;
  /** Compressed image data (always image/jpeg after processing). */
  blob: Blob;
  /** Advisory filename sent in the payload. */
  filename: string;
  /** MIME type of `blob`. */
  mimeType: string;
  /** Sanitized caption; empty string when none. */
  caption: string;
  /** Creation time (epoch ms). */
  createdAt: number;
  /** Number of upload attempts so far. */
  attempts: number;
  /** Current lifecycle status. */
  status: PhotoStatus;
  /** Upload progress 0..100. */
  progress: number;
  /** Last error message, or null. */
  lastError: string | null;
}

/** Parsed backend response body. */
export interface UploadResponse {
  status: 'ok' | 'error';
  message: string;
  fileId: string | null;
}

/** Classification of a single upload attempt outcome. */
export type UploadOutcomeKind =
  'success' | 'network' | 'timeout' | 'http-retryable' | 'http-permanent' | 'app-error';
