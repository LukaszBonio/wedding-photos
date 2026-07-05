/**
 * Shared application limits and tuning constants.
 * Single source of truth for magic numbers used across services and UI.
 */

/** Caption hard cap (mirrors the backend). */
export const MAX_CAPTION_LENGTH = 200;

/** Maximum photos selectable in one gallery batch. */
export const MAX_GALLERY_BATCH = 10;

/** Maximum photos allowed to wait in the offline queue. */
export const MAX_OFFLINE_QUEUE = 20;

/** Maximum simultaneous uploads per device. */
export const MAX_CONCURRENT_UPLOADS = 1;

/**
 * Client-side hard guard on the Base64 payload length (~18 MB) before sending.
 * Stays comfortably under the ~20 MB practical GAS payload ceiling.
 */
export const MAX_UPLOAD_BASE64_LENGTH = 18 * 1024 * 1024;

/** Retry / backoff parameters (base 2 s, x2, jitter +/-30%, max 5 auto tries). */
export const RETRY = {
  baseMs: 2000,
  factor: 2,
  jitterRatio: 0.3,
  maxAutoAttempts: 5,
  maxDelayMs: 60000,
} as const;

/** Maximum video file size (raw, before Base64). */
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

/** Chunk size for video uploads (small enough to avoid browser OOM). */
export const VIDEO_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB


/** Video MIME types accepted by the app. */
export const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

/** Compression thresholds and quality bounds (quality > size). */
export const COMPRESSION = {
  maxLongEdgePx: 3200,
  // ~12.5 MP so a standard 12 MP phone photo (4032x3024 = 12.19 MP) is NOT
  // downscaled — only lightly recompressed to strip EXIF.
  megapixelThreshold: 12_500_000,
  sizeThresholdBytes: 8 * 1024 * 1024,
  qualityHigh: 0.95,
  qualityDynamicMax: 0.93,
  qualityDynamicMin: 0.9,
} as const;
