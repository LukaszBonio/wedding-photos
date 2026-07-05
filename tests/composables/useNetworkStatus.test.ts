import { effectScope, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useNetworkStatus } from '@/composables/useNetworkStatus';

describe('useNetworkStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tracks online/offline and resumes on reconnect', () => {
    const online = ref(true);
    const onReconnect = vi.fn();
    const scope = effectScope();
    scope.run(() => useNetworkStatus(online, onReconnect));

    window.dispatchEvent(new Event('offline'));
    expect(online.value).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(online.value).toBe(true);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    scope.stop();
  });

  it('resumes when the tab becomes visible while online', () => {
    const online = ref(false);
    const onReconnect = vi.fn();
    const scope = effectScope();
    scope.run(() => useNetworkStatus(online, onReconnect));

    document.dispatchEvent(new Event('visibilitychange'));
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(online.value).toBe(true);

    scope.stop();
  });

  it('stops listening after scope disposal', () => {
    const online = ref(true);
    const onReconnect = vi.fn();
    const scope = effectScope();
    scope.run(() => useNetworkStatus(online, onReconnect));
    scope.stop();

    window.dispatchEvent(new Event('online'));
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
