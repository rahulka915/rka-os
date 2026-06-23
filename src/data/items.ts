import { db } from '../db/db';
import type { Item } from '../db/db';

// ─── Read Helpers ────────────────────────────────────────────────────────────
// These functions read exclusively from local Dexie (IndexedDB).
// The sync bridge in sync.ts keeps Dexie in sync with Supabase automatically.
// Do NOT add direct Supabase reads/writes here — use db/actions.ts for mutations.

export async function listItems(): Promise<Item[]> {
  return db.items.filter(item => !item.deletedAt).toArray();
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id);
}
