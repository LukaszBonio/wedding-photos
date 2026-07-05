import { afterEach, describe, expect, it } from 'vitest';
import { effectScope } from 'vue';

import { hashForView, useHashRouter, viewFromHash } from '@/composables/useHashRouter';

afterEach(() => {
  window.location.hash = '';
});

describe('viewFromHash', () => {
  it('maps known hashes to views', () => {
    expect(viewFromHash('#/preview')).toBe('preview');
    expect(viewFromHash('#/success')).toBe('success');
  });

  it('defaults to home for root or unknown', () => {
    expect(viewFromHash('#/')).toBe('home');
    expect(viewFromHash('')).toBe('home');
    expect(viewFromHash('#/nope')).toBe('home');
  });
});

describe('hashForView', () => {
  it('builds hashes', () => {
    expect(hashForView('home')).toBe('#/');
    expect(hashForView('error')).toBe('#/error');
  });
});

describe('useHashRouter', () => {
  it('initialises from the current hash', () => {
    window.location.hash = '#/preview';
    const scope = effectScope();
    scope.run(() => {
      const { view } = useHashRouter();
      expect(view.value).toBe('preview');
    });
    scope.stop();
  });

  it('navigate updates the view and the hash', () => {
    window.location.hash = '';
    const scope = effectScope();
    scope.run(() => {
      const { view, navigate } = useHashRouter();
      navigate('success');
      expect(view.value).toBe('success');
      expect(window.location.hash).toBe('#/success');
    });
    scope.stop();
  });

  it('reacts to hashchange (Back button / refresh)', () => {
    window.location.hash = '#/uploading';
    const scope = effectScope();
    scope.run(() => {
      const { view } = useHashRouter();
      expect(view.value).toBe('uploading');
      window.location.hash = '#/preview';
      window.dispatchEvent(new Event('hashchange'));
      expect(view.value).toBe('preview');
    });
    scope.stop();
  });
});
