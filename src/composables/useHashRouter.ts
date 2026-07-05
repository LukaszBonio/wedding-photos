/**
 * Minimal hash router. The upload state machine remains the source of truth;
 * this keeps the current view mirrored in `#/...` so the browser Back button
 * works and a page refresh restores the current view — all without pulling in
 * a full router.
 */
import { onScopeDispose, ref, type Ref } from 'vue';

import type { AppView } from '@/types';

const VIEW_PATHS: Record<AppView, string> = {
  home: '/',
  preview: '/preview',
  uploading: '/uploading',
  success: '/success',
  error: '/error',
  offline: '/offline',
};

const PATH_VIEWS: Record<string, AppView> = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]),
) as Record<string, AppView>;

/** Resolves a location hash to a view (defaults to home). */
export function viewFromHash(hash: string): AppView {
  const path = hash.replace(/^#/, '') || '/';
  return PATH_VIEWS[path] ?? 'home';
}

/** Builds the location hash for a view. */
export function hashForView(view: AppView): string {
  return `#${VIEW_PATHS[view]}`;
}

export interface HashRouter {
  /** The current view, kept in sync with the URL hash. */
  view: Ref<AppView>;
  /** Navigates to a view, adding a history entry so Back works. */
  navigate: (view: AppView) => void;
}

export function useHashRouter(): HashRouter {
  const view = ref<AppView>(viewFromHash(window.location.hash));

  const sync = (): void => {
    view.value = viewFromHash(window.location.hash);
  };

  window.addEventListener('hashchange', sync);
  onScopeDispose(() => window.removeEventListener('hashchange', sync));

  const navigate = (next: AppView): void => {
    view.value = next;
    const targetHash = hashForView(next);
    if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  return { view, navigate };
}
