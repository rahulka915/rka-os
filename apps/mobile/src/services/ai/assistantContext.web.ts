import { getItemsSnapshot } from '../../db/firestoreWebStore';
import type { Item } from '../../db/types';

// Web equivalent of assistantContext.ts. Native reads items from SQLite via
// getDb().getAllSync(...); the web target has no SQLite (getDb() throws
// "not implemented on web yet"), so it reads the in-memory Firestore snapshot
// instead. The slim-item mapping below is kept identical to the native builder
// so both platforms feed the model the same shape.
export function buildAssistantContext(): string {
  const items = getItemsSnapshot()
    .filter((item) => item.deletedAt == null)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const slim = items.map((item) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = item.metadata ? JSON.parse(item.metadata) : {};
    } catch {
      // malformed metadata shouldn't break the whole context
    }

    const entry: Record<string, unknown> = {
      id: item.id,
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
