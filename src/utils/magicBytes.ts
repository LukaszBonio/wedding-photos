import type { DetectedImageFormat } from '@/types';

/** JPEG start-of-image marker. */
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
/** PNG 8-byte signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * ISO-BMFF (HEIC/HEIF) major/compatible brands found in the `ftyp` box.
 * iPhones may hand back HEIC from the gallery; we detect it to route decoding
 * (native in Safari) or to reject it with a clear message elsewhere.
 */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
  'heif',
]);

/** Whether `bytes` begins with the given signature. */
function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

/** Reads a 4-character ASCII code at `start` (no indexed access → no undefined). */
function fourCC(bytes: Uint8Array, start: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + 4));
}

/** Detects HEIC/HEIF by its `ftyp` box brand. */
function isHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (fourCC(bytes, 4) !== 'ftyp') return false;
  return HEIF_BRANDS.has(fourCC(bytes, 8).toLowerCase());
}

/**
 * Detects the image format from its byte signature (magic bytes), independent
 * of file extension or declared MIME type.
 * @returns the detected format, or null when unrecognised.
 */
export function detectImageFormat(bytes: Uint8Array): DetectedImageFormat | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (isHeif(bytes)) return 'image/heic';
  return null;
}
