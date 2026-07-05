import { describe, expect, it } from 'vitest';

import { deriveSendingView } from '@/utils/viewState';

describe('deriveSendingView', () => {
  it('falls back to uploading when empty', () => {
    expect(deriveSendingView([], true)).toBe('uploading');
  });

  it('is success when all succeeded', () => {
    expect(deriveSendingView(['success', 'success'], true)).toBe('success');
  });

  it('is uploading when pending and online', () => {
    expect(deriveSendingView(['success', 'uploading'], true)).toBe('uploading');
    expect(deriveSendingView(['ready'], true)).toBe('uploading');
  });

  it('is offline when pending and offline', () => {
    expect(deriveSendingView(['offline', 'success'], false)).toBe('offline');
  });

  it('is error when only errors remain', () => {
    expect(deriveSendingView(['error', 'success'], true)).toBe('error');
  });
});
