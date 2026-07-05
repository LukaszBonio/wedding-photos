/** CanvasRenderer backed by OffscreenCanvas — used inside the worker. */
import type { CanvasRenderer } from './compressionCore';

export const offscreenRenderer: CanvasRenderer = {
  create(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    return {
      getContext2d: () => canvas.getContext('2d'),
      toBlob: (quality) => canvas.convertToBlob({ type: 'image/jpeg', quality }),
      release: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  },
};
