/**
 * Compression worker entry. Receives a file, compresses it off the main thread
 * with OffscreenCanvas, and streams progress + a result (or a coded error).
 */
import { CompressionError, runCompression } from './compressionCore';
import { offscreenRenderer } from './offscreenRenderer';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Both DOM and WebWorker libs are loaded, so `self` is ambiguously typed; cast
// once to the dedicated worker scope.
const ctx = globalThis as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse): void {
  ctx.postMessage(message);
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
  const request = event.data;
  if (request.type !== 'compress') return;

  const { id, file } = request;
  try {
    const result = await runCompression(file, offscreenRenderer, (progress) => {
      post({ type: 'progress', id, progress });
    });
    post({ type: 'result', id, blob: result.blob, width: result.width, height: result.height });
  } catch (error) {
    const code = error instanceof CompressionError ? error.code : 'unknown';
    const message = error instanceof Error ? error.message : 'Nieznany błąd kompresji.';
    post({ type: 'error', id, code, message });
  }
};
