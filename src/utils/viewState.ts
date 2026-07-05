import type { AppView, PhotoStatus } from '@/types';

/** Statuses that mean a photo still needs a confirmed upload. */
const PENDING: readonly PhotoStatus[] = ['ready', 'uploading', 'offline'];

/**
 * Derives the view during the sending phase from the batch's photo statuses.
 * - all succeeded → success,
 * - anything still pending → uploading (online) or offline (no network),
 * - otherwise (only errors remain) → error.
 */
export function deriveSendingView(statuses: PhotoStatus[], online: boolean): AppView {
  if (statuses.length === 0) return 'uploading';
  if (statuses.every((status) => status === 'success')) return 'success';
  if (statuses.some((status) => PENDING.includes(status))) {
    return online ? 'uploading' : 'offline';
  }
  return 'error';
}
