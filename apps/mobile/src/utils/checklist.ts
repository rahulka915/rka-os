export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

// Tolerant reader — metadata is free-form JSON that older rows may not have,
// so anything malformed degrades to an empty checklist rather than throwing.
export function readChecklist(meta: Record<string, unknown>): ChecklistItem[] {
  const raw = meta?.checklist;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is ChecklistItem =>
      !!entry
      && typeof (entry as ChecklistItem).id === 'string'
      && typeof (entry as ChecklistItem).text === 'string')
    .map((entry) => ({ id: entry.id, text: entry.text, done: !!entry.done }));
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((entry) => entry.done).length, total: items.length };
}

// `id` is injected rather than generated so this stays pure and testable; the
// caller passes uuid().
export function addChecklistItem(items: ChecklistItem[], text: string, id: string): ChecklistItem[] {
  const trimmed = text.trim();
  if (!trimmed) return items;
  return [...items, { id, text: trimmed, done: false }];
}

export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((entry) => (entry.id === id ? { ...entry, done: !entry.done } : entry));
}

export function removeChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((entry) => entry.id !== id);
}
