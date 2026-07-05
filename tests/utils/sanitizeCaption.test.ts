import { describe, expect, it } from 'vitest';

import { sanitizeCaption } from '@/utils/sanitizeCaption';

describe('sanitizeCaption', () => {
  it('removes control characters', () => {
    expect(sanitizeCaption('a\u0000b\u0007c\u001f\u007fd')).toBe('abcd');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeCaption('  witaj  ')).toBe('witaj');
  });

  it('caps at 200 characters', () => {
    const result = sanitizeCaption('x'.repeat(250));
    expect(result.length).toBe(200);
  });

  it('passes normal text through unchanged', () => {
    expect(sanitizeCaption('Piękny dzień! 🎉')).toBe('Piękny dzień! 🎉');
  });
});
