/**
 * Wraps image compression, choosing the best available backend:
 *  - OffscreenCanvas in a worker (Safari 16.4+, Chrome) — keeps the main thread
 *    free and streams progress,
 *  - HTMLCanvasElement on the main thread as a fallback (older Safari).
 * Compression error codes are mapped to guest-facing Polish messages.
 */
import {
  CompressionError,
  runCompression,
  type CompressionOutput,
} from '@/workers/compressionCore';
import { domRenderer } from '@/workers/domRenderer';
import { compressionErrorMessage } from '@/utils/errorMessages';
import type { WorkerRequest, WorkerResponse } from '@/workers/protocol';

/** Whether the OffscreenCanvas worker path is available. */
export function supportsCompressionWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
}

interface PendingRequest {
  resolve: (output: CompressionOutput) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();

/** Lazily creates the singleton compression worker and wires its message pump. */
function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;

    if (message.type === 'progress') {
      request.onProgress?.(message.progress);
      return;
    }
    pending.delete(message.id);
    if (message.type === 'result') {
      request.resolve({ blob: message.blob, width: message.width, height: message.height });
    } else {
      request.reject(new Error(compressionErrorMessage(message.code)));
    }
  });

  return worker;
}

function compressWithWorker(
  file: File,
  id: string,
  onProgress?: (progress: number) => void,
): Promise<CompressionOutput> {
  const activeWorker = getWorker();
  return new Promise<CompressionOutput>((resolve, reject) => {
    pending.set(id, onProgress ? { resolve, reject, onProgress } : { resolve, reject });
    const request: WorkerRequest = { type: 'compress', id, file };
    activeWorker.postMessage(request);
  });
}

async function compressOnMainThread(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<CompressionOutput> {
  try {
    return await runCompression(file, domRenderer, onProgress);
  } catch (error) {
    if (error instanceof CompressionError) {
      throw new Error(compressionErrorMessage(error.code));
    }
    throw new Error(compressionErrorMessage('unknown'));
  }
}

/**
 * Compresses one image. Resolves with the JPEG blob and dimensions, or rejects
 * with an Error whose message is already Polish and guest-facing.
 */
export function compressImage(
  file: File,
  id: string,
  onProgress?: (progress: number) => void,
): Promise<CompressionOutput> {
  return supportsCompressionWorker()
    ? compressWithWorker(file, id, onProgress)
    : compressOnMainThread(file, onProgress);
}
