import { describe, expect, it } from 'vitest';

import { compressionErrorMessage } from '@/utils/errorMessages';

describe('compressionErrorMessage', () => {
  it('returns the specific HEIC message', () => {
    expect(compressionErrorMessage('heic-unsupported')).toContain('HEIC');
  });

  it('maps decode-failed', () => {
    expect(compressionErrorMessage('decode-failed')).toContain('wczytać');
  });

  it('maps encode-failed', () => {
    expect(compressionErrorMessage('encode-failed')).toContain('przetworzyć');
  });

  it('maps unknown', () => {
    expect(compressionErrorMessage('unknown')).toContain('nieoczekiwany');
  });
});
