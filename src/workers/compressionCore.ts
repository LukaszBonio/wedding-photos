/**
 * Shared image-compression pipeline used by both the worker (OffscreenCanvas)
 * and the main-thread fallback (HTMLCanvasElement). The canvas backend is
 * injected via CanvasRenderer so this module stays environment-agnostic.
 *
 * Orientation + EXIF handling: createImageBitmap with imageOrientation
 * 'from-image' bakes EXIF orientation into the pixels (native in Safari 16.4+
 * and Chrome). Re-encoding through a canvas then drops all metadata, so the
 * output is physically oriented and EXIF-free without a manual EXIF parser.
 */
import { COMPRESSION } from '@/constants';
import { detectImageFormat } from '@/utils/magicBytes';
import { readHeaderBytes } from '@/utils/fileValidation';
import {
  computeTargetDimensions,
  decideResizeNeeded,
  isLargerThanOriginal,
  pickDynamicQuality,
} from '@/utils/compression';

import type { CompressErrorCode } from './protocol';

/** Error carrying a machine-readable code so the UI can pick the right message. */
export class CompressionError extends Error {
  constructor(
    readonly code: CompressErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CompressionError';
  }
}

/** A drawable, encodable canvas surface (OffscreenCanvas or HTMLCanvasElement). */
export interface CanvasSurface {
  getContext2d(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  toBlob(quality: number): Promise<Blob>;
  /** Frees the backing canvas memory. */
  release(): void;
}

/** Creates canvas surfaces of a given size. */
export interface CanvasRenderer {
  create(width: number, height: number): CanvasSurface;
}

/** Result of a successful compression. */
export interface CompressionOutput {
  blob: Blob;
  width: number;
  height: number;
}

/** Draws a (possibly resized) bitmap onto a fresh canvas and encodes to JPEG. */
async function encodeBitmap(
  source: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  renderer: CanvasRenderer,
): Promise<Blob> {
  let drawSource = source;
  let createdResized = false;

  // Use the browser's high-quality resampler for the downscale itself.
  if (targetWidth !== source.width || targetHeight !== source.height) {
    drawSource = await createImageBitmap(source, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: 'high',
    });
    createdResized = true;
  }

  const surface = renderer.create(targetWidth, targetHeight);
  try {
    const ctx = surface.getContext2d();
    if (!ctx) {
      throw new CompressionError('encode-failed', 'Nie udało się utworzyć kontekstu canvas.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawSource, 0, 0);
    return await surface.toBlob(quality);
  } finally {
    if (createdResized) drawSource.close();
    surface.release();
  }
}

/**
 * Compresses an image: decode (oriented) → optional high-quality downscale →
 * JPEG re-encode (EXIF stripped) → never larger than the original.
 * @throws CompressionError with a code the caller maps to a user message.
 */
export async function runCompression(
  file: Blob,
  renderer: CanvasRenderer,
  onProgress?: (progress: number) => void,
): Promise<CompressionOutput> {
  const header = await readHeaderBytes(file);
  const format = detectImageFormat(header);
  onProgress?.(5);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC decode only succeeds natively in Safari; elsewhere it lands here.
    if (format === 'image/heic') {
      throw new CompressionError('heic-unsupported', 'Format HEIC nie jest obsługiwany.');
    }
    throw new CompressionError('decode-failed', 'Nie udało się odczytać zdjęcia.');
  }

  onProgress?.(30);

  try {
    const { width, height } = bitmap;
    const resizeNeeded = decideResizeNeeded(width, height, file.size);

    let output: Blob;
    let outWidth = width;
    let outHeight = height;

    if (resizeNeeded) {
      const target = computeTargetDimensions(width, height);
      const quality = pickDynamicQuality(target.width * target.height);
      output = await encodeBitmap(bitmap, target.width, target.height, quality, renderer);
      outWidth = target.width;
      outHeight = target.height;
      onProgress?.(75);

      // Never larger than the original: fall back to the full-res light variant
      // and keep whichever is smaller. We never send the raw original (EXIF).
      if (isLargerThanOriginal(output.size, file.size)) {
        const light = await encodeBitmap(bitmap, width, height, COMPRESSION.qualityHigh, renderer);
        if (light.size < output.size) {
          output = light;
          outWidth = width;
          outHeight = height;
        }
      }
    } else {
      // Light path: full resolution, high quality — needed to strip EXIF.
      output = await encodeBitmap(bitmap, width, height, COMPRESSION.qualityHigh, renderer);
    }

    onProgress?.(100);
    return { blob: output, width: outWidth, height: outHeight };
  } finally {
    bitmap.close();
  }
}
