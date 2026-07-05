/**
 * CanvasRenderer backed by HTMLCanvasElement — used on the main thread when
 * OffscreenCanvas is unavailable (older Safari). Must run on the main thread.
 */
import type { CanvasRenderer } from './compressionCore';

export const domRenderer: CanvasRenderer = {
  create(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return {
      getContext2d: () => canvas.getContext('2d'),
      toBlob: (quality) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
            'image/jpeg',
            quality,
          );
        }),
      release: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  },
};
