/**
 * Base64 helpers for the upload payload. Base64 is forced by the GAS transport
 * (JSON body over a text/plain simple request); the ~33% size overhead is an
 * accepted trade-off.
 */

/** Chunk size (chars) for String.fromCharCode to avoid call-stack limits. */
const CHUNK_SIZE = 0x8000;

/** Estimates the Base64 string length for a given byte count (no encoding). */
export function estimateBase64Length(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

/** Encodes an ArrayBuffer to a Base64 string in chunks. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Reads a Blob and returns its Base64 representation (without a data-URL prefix). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return arrayBufferToBase64(buffer);
}
