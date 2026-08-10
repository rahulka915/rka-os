import type { Item } from '../db/types';
import { getRelation, applyManualOrder, updateItemStatus, setRelation, setTaskPriority } from '../db/database';
import { deadlineStatus } from './deadline';

// Tasks screen "view" — like a Notion database view, this is purely a
// display transform over the same underlying tasks: it never changes what a
// task IS, only how it's grouped/ordered/hidden. Active/Someday (the
// original hardcoded split) is now just the 'status' grouping, kept as the
// default so nobody who never opens the View sheet notices a difference.
export type TasksGroupBy = 'status' | 'priority' | 'mission' | 'dueDate' | 'none';
export type TasksSortBy = 'manual' | 'dueDate' | 'priority' | 'alphabetical' | 'created';
export type TaskPriority = 'low' | 'medium' | 'high';

export type TasksFilter =
  | { type: 'none' }
  | { type: 'mission'; missionId: string | null } // null = "No mission"
  | { type: 'priority'; priority: TaskPriority | null } // null = "No priority"
  | { type: 'dueDate'; mode: 'overdue' | 'hasDueDate' };

export interface TasksViewConfig {
  groupBy: TasksGroupBy;
  sortBy: TasksSortBy;
  filter: TasksFilter;
}

export const DEFAULT_TASKS_VIEW_CONFIG: TasksViewConfig = {
  groupBy: 'status',
  sortBy: 'manual',
  filter: { type: 'none' },
};

export function isValidTasksViewConfig(value: unknown): value is TasksViewConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    ['status', 'priority', 'mission', 'dueDate', 'none'].includes(v.groupBy as string) &&
    ['manual', 'dueDate', 'priority', 'alphabetical', 'created'].includes(v.sortBy as string) &&
    !!v.filter && typeof v.filter === 'object'
  );
}

// A flat row list is the single source of truth passed to the drag list —
// header rows are non-draggable and carry the groupKey they own, task rows
// carry the groupKey they currently belong to. `id` is the drag list's key.
export type TaskRowEntry =
  | { id: string; kind: 'header'; groupKey: string; label: string }
  | { id: string; kind: 'task'; groupKey: string; item: Item };

function getPriority(item: Item): TaskPriority | null {
  if (!item.metadata) return null;
  try {
    return (JSON.parse(item.metadata) as { priority?: TaskPriority }).priority ?? null;
  } catch {
    return null;
  }
}

function getMissionId(item: Item): string | null {
  return getRelation(item.id, 'project');
}

type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
const DUE_BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];
const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: 'OVERDUE',
  today: 'DUE TODAY',
  week: 'DUE THIS WEEK',
  later: 'LATER',
  none: 'NO DUE DATE',
};

function getDueBucket(item: Item, today: string): DueBucket {
  const status = deadlineStatus(item.dueDate, today);
  if (!status) return 'none';
  if (status.tone === 'overdue') return 'overdue';
  if (status.tone === 'today') return 'today';
  if (status.tone === 'soon') return 'week';
  return 'later';
}

const PRIORITY_ORDER: Array<TaskPriority | 'none'> = ['high', 'medium', 'low', 'none'];
const PRIORITY_LABELS: Record<TaskPriority | 'none', string> = {
  high: 'HIGH PRIORITY',
  medium: 'MEDIUM PRIORITY',
  low: 'LOW PRIORITY',
  none: 'NO PRIORITY',
};

export function groupKeyForItem(item: Item, groupBy: TasksGroupBy, today: string): string {
  switch (groupBy) {
    case 'status': return item.status === 'someday' ? 'someday' : 'active';
    case 'priority': return getPriority(item) ?? 'none';
    case 'mission': return getMissionId(item) ?? 'none';
    case 'dueDate': return getDueBucket(item, today);
    case 'none': return 'all';
  }
}

export function groupLabel(groupKey: string, groupBy: TasksGroupBy, projects: Item[]): string {
  switch (groupBy) {
    case 'status': return groupKey === 'someday' ? 'SOMEDAY' : 'ACTIVE';
    case 'priority': return PRIORITY_LABELS[groupKey as TaskPriority | 'none'] ?? PRIORITY_LABELS.none;
    case 'mission': {
      if (groupKey === 'none') return 'NO MISSION';
      const project = projects.find((p) => p.id === groupKey);
      return (project?.title ?? 'NO MISSION').toUpperCase();
    }
    case 'dueDate': return DUE_BUCKET_LABELS[groupKey as DueBucket] ?? DUE_BUCKET_LABELS.none;
    case 'none': return '';
  }
}

// Order groups appear in. Status/priority/dueDate have a fixed order; mission
// and the single 'none' group order by first appearance in `tasks` (already
// creation-ordered) with "No Mission" pinned last.
function orderGroupKeys(groupBy: TasksGroupBy, keysInFirstAppearanceOrder: string[]): string[] {
  if (groupBy === 'status') {
    const order = ['active', 'someday'];
    return [...keysInFirstAppearanceOrder].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  if (groupBy === 'priority') {
    return [...keysInFirstAppearanceOrder].sort((a, b) => PRIORITY_ORDER.indexOf(a as TaskPriority | 'none') - PRIORITY_ORDER.indexOf(b as TaskPriority | 'none'));
  }
  if (groupBy === 'dueDate') {
    return [...keysInFirstAppearanceOrder].sort((a, b) => DUE_BUCKET_ORDER.indexOf(a as DueBucket) - DUE_BUCKET_ORDER.indexOf(b as DueBucket));
  }
  if (groupBy === 'mission') {
    return [...keysInFirstAppearanceOrder].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : 0));
  }
  return keysInFirstAppearanceOrder; // 'none' grouping: always exactly one key
}

function comparePriority(a: Item, b: Item): number {
  return PRIORITY_ORDER.indexOf(getPriority(a) ?? 'none') - PRIORITY_ORDER.indexOf(getPriority(b) ?? 'none');
}

export function sortItems(items: Item[], sortBy: TasksSortBy): Item[] {
  const copy = [...items];
  switch (sortBy) {
    case 'dueDate':
      return copy.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case 'priority':
      return copy.sort(comparePriority);
    case 'alphabetical':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'created':
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case 'manual':
    default:
      return copy;
  }
}

export function filterItems(items: Item[], filter: TasksFilter, today: string): Item[] {
  switch (filter.type) {
    case 'none': return items;
    case 'mission': return items.filter((i) => (getMissionId(i) ?? null) === filter.missionId);
    case 'priority': return items.filter((i) => (getPriority(i) ?? null) === filter.priority);
    case 'dueDate':
      return filter.mode === 'overdue'
        ? items.filter((i) => getDueBucket(i, today) === 'overdue')
        : items.filter((i) => !!i.dueDate);
  }
}

// `tasks:active` / `tasks:someday` are unchanged from before this feature —
// no migration needed, existing saved order keeps working. Every other
// grouping gets its own scoped key so switching views never clobbers
// another view's saved order.
export function manualOrderKey(groupBy: TasksGroupBy, groupKey: string): string {
  if (groupBy === 'status') return `tasks:${groupKey}`;
  if (groupBy === 'none') return 'tasks:flat';
  return `tasks:${groupBy}:${groupKey}`;
}

// Whether dropping a task into a different group under this grouping should
// change a real property (with confirmation) vs. always snap back. Due-date
// buckets don't map to a single settable date, so that grouping — and the
// single-group 'none' view, which has nowhere else to drop into — stay
// reorder-only regardless of gesture.
export function isGroupingMutable(groupBy: TasksGroupBy): boolean {
  return groupBy === 'status' || groupBy === 'priority' || groupBy === 'mission';
}

export function groupChangeLabel(groupBy: TasksGroupBy, targetGroupKey: string, projects: Item[]): string {
  return groupLabel(targetGroupKey, groupBy, projects)
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function applyGroupMutation(groupBy: TasksGroupBy, item: Item, targetGroupKey: string): void {
  switch (groupBy) {
    case 'status':
      updateItemStatus(item.id, targetGroupKey === 'someday' ? 'someday' : 'active');
      return;
    case 'priority':
      setTaskPriority(item.id, targetGroupKey === 'none' ? null : (targetGroupKey as TaskPriority));
      return;
    case 'mission':
      setRelation(item.id, 'project', targetGroupKey === 'none' ? null : targetGroupKey);
      return;
    default:
      return;
  }
}

// The single pipeline: filter -> group -> per-group sort (manual order or a
// derived comparator) -> flatten with non-draggable header rows. Pure aside
// from the `applyManualOrder` DB read, same as the screen's previous
// buildRows/active/someday split — this just generalizes it to N groups.
export function buildGroupedRows(
  tasks: Item[],
  viewConfig: TasksViewConfig,
  projects: Item[],
  today: string,
): TaskRowEntry[] {
  const visible = filterItems(tasks, viewConfig.filter, today);

  const buckets = new Map<string, Item[]>();
  for (const item of visible) {
    const key = groupKeyForItem(item, viewConfig.groupBy, today);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const orderedKeys = orderGroupKeys(viewConfig.groupBy, [...buckets.keys()]);

  const rows: TaskRowEntry[] = [];
  for (const key of orderedKeys) {
    const items = buckets.get(key);
    if (!items || items.length === 0) continue;
    const ordered = viewConfig.sortBy === 'manual'
      ? applyManualOrder(manualOrderKey(viewConfig.groupBy, key), items)
      : sortItems(items, viewConfig.sortBy);
    if (viewConfig.groupBy !== 'none') {
      rows.push({ id: `header:${viewConfig.groupBy}:${key}`, kind: 'header', groupKey: key, label: groupLabel(key, viewConfig.groupBy, projects) });
    }
    for (const item of ordered) {
      rows.push({ id: item.id, kind: 'task', groupKey: key, item });
    }
  }
  return rows;
}

export function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Which group (and task-row bounds within `rows`) owns a given index. If
// `index` lands exactly on a header row, that header's own group is the
// answer (dropping right at/above a header means "top of that group") —
// otherwise it's the nearest header at or before `index`.
export function rowGroupAt(rows: TaskRowEntry[], index: number): { groupKey: string; start: number; end: number } | null {
  const clamped = Math.max(0, Math.min(index, rows.length - 1));
  let headerIdx = -1;
  for (let i = clamped; i >= 0; i--) {
    if (rows[i].kind === 'header') { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    // No header at all — only happens for the 'none' grouping, where every
    // row is a task and the "group" is the entire list.
    return { groupKey: rows[clamped]?.groupKey ?? 'all', start: 0, end: rows.length - 1 };
  }
  const header = rows[headerIdx] as Extract<TaskRowEntry, { kind: 'header' }>;
  let end = rows.length - 1;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (rows[i].kind === 'header') { end = i - 1; break; }
  }
  return { groupKey: header.groupKey, start: headerIdx + 1, end };
}
