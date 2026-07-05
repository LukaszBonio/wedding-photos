/**
 * Tracks connectivity and drives recovery. Updates `online` on the browser's
 * online/offline events, and calls `onReconnect` both when the network returns
 * and when the tab becomes visible again while online (iOS often fires no
 * `online` event after waking a backgrounded tab).
 */
import { onScopeDispose, type Ref } from 'vue';

export function useNetworkStatus(online: Ref<boolean>, onReconnect: () => void): void {
  const goOnline = (): void => {
    online.value = true;
    onReconnect();
  };
  const goOffline = (): void => {
    online.value = false;
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      online.value = true;
      onReconnect();
    }
  };

  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  document.addEventListener('visibilitychange', onVisibility);

  onScopeDispose(() => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}
