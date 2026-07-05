import { MAX_CAPTION_LENGTH } from '@/constants';

/** Control characters removed from captions (C0 range + DEL). */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Sanitizes a guest caption: strip control chars, trim, cap at MAX_CAPTION_LENGTH.
 * Mirrors the backend sanitisation (defence in depth + accurate UI counter).
 */
export function sanitizeCaption(caption: string): string {
  const cleaned = caption.replace(CONTROL_CHARS, '').trim();
  return cleaned.length > MAX_CAPTION_LENGTH ? cleaned.slice(0, MAX_CAPTION_LENGTH) : cleaned;
}
