/**
 * IndexedDB persistence for the upload queue (via Dexie).
 * Photos survive reloads, tab kills, and offline periods; a record is only
 * removed after the backend confirms the upload. Every record read back is
 * validated with Zod to guard against data written by an older app version.
 */
import Dexie, { type Table } from 'dexie';

import { queuedPhotoSchema } from '@/schemas';
import type { QueuedPhoto } from '@/types';

export class WeddingPhotosDatabase extends Dexie {
  photos!: Table<QueuedPhoto, string>;

  constructor(name = 'wedding-photos') {
    super(name);
    // Primary key uploadId; secondary indexes for querying and ordering.
    this.version(1).stores({
      photos: 'uploadId, status, createdAt',
    });
  }
}

export const db = new WeddingPhotosDatabase();

/** Inserts or replaces a photo record. */
export async function putPhoto(photo: QueuedPhoto): Promise<void> {
  await db.photos.put(photo);
}

/** Applies a partial update to a photo record. */
export async function updatePhoto(uploadId: string, changes: Partial<QueuedPhoto>): Promise<void> {
  await db.photos.update(uploadId, changes);
}

/** Removes a photo record (called only after a confirmed upload). */
export async function deletePhoto(uploadId: string): Promise<void> {
  await db.photos.delete(uploadId);
}

/** Total number of persisted photos. */
export async function countPhotos(): Promise<number> {
  return db.photos.count();
}

/** Returns a single validated photo, or undefined when missing/invalid. */
export async function getPhoto(uploadId: string): Promise<QueuedPhoto | undefined> {
  const record = await db.photos.get(uploadId);
  if (!record) return undefined;
  const parsed = queuedPhotoSchema.safeParse(record);
  return parsed.success ? parsed.data : undefined;
}

/** Loads all photos oldest-first, pruning any records that fail validation. */
export async function loadValidPhotos(): Promise<QueuedPhoto[]> {
  // Iterate every record (not an index) so rows missing an indexed field are
  // still seen and pruned, then order in memory.
  const records = await db.photos.toArray();
  const valid: QueuedPhoto[] = [];
  const invalidIds: string[] = [];

  for (const record of records) {
    const parsed = queuedPhotoSchema.safeParse(record);
    if (parsed.success) {
      valid.push(parsed.data);
    } else if (typeof (record as { uploadId?: unknown }).uploadId === 'string') {
      invalidIds.push((record as { uploadId: string }).uploadId);
    }
  }

  if (invalidIds.length > 0) {
    await db.photos.bulkDelete(invalidIds);
  }

  valid.sort((a, b) => a.createdAt - b.createdAt);
  return valid;
}
