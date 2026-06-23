import { db } from '../db/db';
import type { ActivityLog } from '../db/db';

// ─── Read Helpers ────────────────────────────────────────────────────────────
// These functions read exclusively from local Dexie (IndexedDB).
// The sync bridge in sync.ts keeps Dexie in sync with Supabase automatically.
// Do NOT add direct Supabase reads/writes here — use db/actions.ts for mutations.

export async function listActivityLogs(entityId?: string): Promise<ActivityLog[]> {
  if (entityId) {
    return db.activityLogs
      .where('entityId')
      .equals(entityId)
      .filter(log => !log.deletedAt)
      .toArray();
  }
  return db.activityLogs.filter(log => !log.deletedAt).toArray();
}
