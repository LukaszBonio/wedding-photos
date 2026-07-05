/** RFC 4122 canonical UUID pattern (any version). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generates a UUID v4. Prefers the native crypto.randomUUID; falls back to a
 * manual RFC 4122 v4 implementation for older runtimes.
 */
export function generateUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackUuidV4();
}

/** Fills a byte array with cryptographic randomness where available. */
function fillRandom(target: Uint8Array<ArrayBuffer>): void {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(target);
    return;
  }
  for (let i = 0; i < target.length; i++) {
    target[i] = Math.floor(Math.random() * 256);
  }
}

/** Manual UUID v4 fallback. Assembled from hex to avoid indexed byte mutation. */
function fallbackUuidV4(): string {
  const bytes = new Uint8Array(16);
  fillRandom(bytes);

  const hexParts: string[] = [];
  bytes.forEach((b) => hexParts.push(b.toString(16).padStart(2, '0')));
  const hex = hexParts.join('');

  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);
  // Force version nibble to 4.
  const timeHi = '4' + hex.slice(13, 16);
  // Force variant bits to 10xx (8..b).
  const variantFirst = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  const clockSeq = variantFirst + hex.slice(17, 20);
  const node = hex.slice(20, 32);

  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
}
