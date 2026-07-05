import { COMPRESSION } from '@/constants';

/** A width/height pair in device pixels. */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Whether the image should be downscaled. Per the spec: photos up to ~12 MP and
 * under 8 MB are kept at full resolution (light recompress only); anything
 * larger is downscaled.
 */
export function decideResizeNeeded(width: number, height: number, fileSize: number): boolean {
  const megapixels = width * height;
  return megapixels > COMPRESSION.megapixelThreshold || fileSize >= COMPRESSION.sizeThresholdBytes;
}

/**
 * Target dimensions after clamping the long edge to maxLongEdgePx, preserving
 * aspect ratio. Returns the input unchanged when already within the limit.
 */
export function computeTargetDimensions(width: number, height: number): Dimensions {
  const longEdge = Math.max(width, height);
  if (longEdge <= COMPRESSION.maxLongEdgePx) {
    return { width, height };
  }
  const scale = COMPRESSION.maxLongEdgePx / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * JPEG quality for the downscale path, chosen dynamically within [0.90, 0.93]:
 * larger outputs get slightly stronger compression, never below 0.90.
 */
export function pickDynamicQuality(targetPixels: number): number {
  if (targetPixels >= 8_000_000) return COMPRESSION.qualityDynamicMin; // 0.90
  if (targetPixels >= 6_000_000) return 0.91;
  if (targetPixels >= 4_000_000) return 0.92;
  return COMPRESSION.qualityDynamicMax; // 0.93
}

/** Whether a produced candidate is larger than the original file. */
export function isLargerThanOriginal(candidateSize: number, originalSize: number): boolean {
  return candidateSize > originalSize;
}
