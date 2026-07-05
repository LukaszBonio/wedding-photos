import type { CompressErrorCode } from '@/workers/protocol';

/** Polish, guest-facing messages for each compression failure code. */
const COMPRESSION_MESSAGES: Record<CompressErrorCode, string> = {
  'heic-unsupported':
    'Twój telefon zapisuje zdjęcia w formacie HEIC. Wybierz JPEG lub zmień ustawienia aparatu.',
  'decode-failed': 'Nie udało się wczytać zdjęcia. Wybierz inne zdjęcie.',
  'encode-failed': 'Nie udało się przetworzyć zdjęcia. Spróbuj ponownie.',
  unknown: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
};

/** Maps a compression error code to a guest-facing Polish message. */
export function compressionErrorMessage(code: CompressErrorCode): string {
  return COMPRESSION_MESSAGES[code];
}
