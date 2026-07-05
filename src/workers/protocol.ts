/**
 * Message contract between the main thread and the compression worker.
 * Shared by the worker entry and the service that wraps it (Stage 4c).
 */

/** Reason a compression attempt failed. */
export type CompressErrorCode = 'heic-unsupported' | 'decode-failed' | 'encode-failed' | 'unknown';

/** Main thread → worker: compress this file. */
export interface CompressRequest {
  type: 'compress';
  id: string;
  file: File;
}

/** Worker → main thread: progress update (0..100). */
export interface CompressProgress {
  type: 'progress';
  id: string;
  progress: number;
}

/** Worker → main thread: compression succeeded. */
export interface CompressSuccess {
  type: 'result';
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Worker → main thread: compression failed. */
export interface CompressFailure {
  type: 'error';
  id: string;
  code: CompressErrorCode;
  message: string;
}

export type WorkerRequest = CompressRequest;
export type WorkerResponse = CompressProgress | CompressSuccess | CompressFailure;
