import { db } from '../db/db';
import type { EntityLink } from '../db/db';

// ─── Read Helpers ────────────────────────────────────────────────────────────
// These functions read exclusively from local Dexie (IndexedDB).
// The sync bridge in sync.ts keeps Dexie in sync with Supabase automatically.
// Do NOT add direct Supabase reads/writes here — use db/actions.ts for mutations.

export async function listEntityLinks(sourceId?: string, linkType?: string): Promise<EntityLink[]> {
  if (sourceId && linkType) {
    return db.entityLinks
      .where('[sourceId+linkType]')
      .equals([sourceId, linkType])
      .filter(l => !l.deletedAt)
      .toArray();
  }
  if (sourceId) {
    return db.entityLinks
      .where('sourceId')
      .equals(sourceId)
      .filter(l => !l.deletedAt)
      .toArray();
  }
  return db.entityLinks.filter(l => !l.deletedAt).toArray();
}

export async function listEntityLinksByTarget(targetId: string, linkType?: string): Promise<EntityLink[]> {
  if (linkType) {
    return db.entityLinks
      .where('[targetId+linkType]')
      .equals([targetId, linkType])
      .filter(l => !l.deletedAt)
      .toArray();
  }
  return db.entityLinks
    .where('targetId')
    .equals(targetId)
    .filter(l => !l.deletedAt)
    .toArray();
}
