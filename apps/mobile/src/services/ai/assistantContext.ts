import { getDb } from '../../db/database';
import type { Item } from '../../db/types';

// Compact, LLM-friendly snapshot of the user's current (non-deleted) data —
// rebuilt fresh on every assistant turn so answers always reflect the latest
// state, rather than something cached that could drift stale mid-conversation.
export function buildAssistantContext(): string {
  const db = getDb();
  const items = db.getAllSync<Item>(
    `SELECT * FROM items WHERE deletedAt IS NULL ORDER BY updatedAt DESC`
  );

  const slim = items.map((item) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = item.metadata ? JSON.parse(item.metadata) : {};
    } catch {
      // malformed metadata shouldn't break the whole context
    }

    const entry: Record<string, unknown> = {
      type: item.type,
      title: item.title,
      status: item.status,
    };
    if (item.notes) entry.notes = item.notes.slice(0, 200);
    if (item.scheduledDate) entry.scheduledDate = item.scheduledDate;
    if (item.dueDate) entry.dueDate = item.dueDate;
    if (item.rrule) entry.repeats = item.rrule;
    if (item.type === 'medication') {
      if (meta.dose) entry.dose = meta.dose;
      if (meta.minHoursBetweenDoses) entry.minHoursBetweenDoses = meta.minHoursBetweenDoses;
    }
    if (item.type === 'object' && meta.objectStatus) entry.objectStatus = meta.objectStatus;
    if (item.type === 'task' && item.rrule) entry.recurring = true;

    return entry;
  });

  return JSON.stringify(slim);
}
