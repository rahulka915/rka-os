import type {
  TimerWidgetPresentation,
  VisibleTimerWidgetPresentation,
  MedicationContainer,
  MedicationMeta,
  StockBreakdownSheet,
  StockBreakdownContainer,
  StockBreakdown,
  MedicationTimerDetails,
  TimerWidgetPreferences,
  TimelineEntry,
  GtdDestination,
} from './database';

export type {
  TimerWidgetPresentation,
  VisibleTimerWidgetPresentation,
  MedicationContainer,
  MedicationMeta,
  StockBreakdownSheet,
  StockBreakdownContainer,
  StockBreakdown,
  MedicationTimerDetails,
  TimerWidgetPreferences,
  TimelineEntry,
  GtdDestination,
};

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { deleteField } from 'firebase/firestore';
import { nextOccurrenceDate, parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';
import { buildTimelineEntries } from './timelineEntry';
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';
import { countDosesByDay } from '../utils/medicationDoseHistory';
import { resolveAutoStopAfterMs } from '../domain/medicationTimer/timerMath';
import type { Item, ItemInstance, ActivityLog } from './types';
import {
  getItemsSnapshot,
  getActivityLogsSnapshot,
  getItemRelationsSnapshot,
  getItemOrderSnapshot,
  getItemInstancesSnapshot,
  putItem,
  patchItem,
  putActivityLogDoc,
  patchActivityLogDoc,
  deleteActivityLogDoc,
  putItemRelation,
  deleteItemRelationDoc,
  replaceItemOrder,
  putItemInstance,
  deletePendingInstancesForItem,
} from './firestoreWebStore';

function notImplementedOnWeb(name: string): never {
  throw new Error(`${name} is not implemented on web yet`);
}

// ── Items ──────────────────────────────────────────────────────────────
// Each query below is a direct port of the SQL predicate in database.ts,
// evaluated over the in-memory Firestore mirror instead of SQLite.

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function uuid(): string {
  return uuidv4();
}

export function getInboxItems(): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === 'inbox' && i.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot().filter(
    (i) =>
      (i.scheduledDate === today || i.status === 'due-today' || i.status === 'overdue') &&
      i.deletedAt == null
  );
}

export function getUpcomingItems(fromDate: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => (i.scheduledDate ?? '') > fromDate && i.status !== 'completed' && i.deletedAt == null)
    .sort((a, b) => {
      const byDate = (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
      return byDate !== 0 ? byDate : a.createdAt - b.createdAt;
    });
}

export function getItemsByStatus(status: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === status && i.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getCompletedItems(): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === 'completed' && i.deletedAt == null)
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
}

export function getItemsByType(type: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.type === type && i.deletedAt == null && i.status !== 'archived')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getItemWithMetadata(id: string): Item | null {
  return getItemsSnapshot().find((i) => i.id === id) ?? null;
}

export const getItemById = getItemWithMetadata;

// Writes are fire-and-forget to keep these signatures synchronous, matching
// database.ts so no call site has to change. The onSnapshot listener echoes the
// write back into the store, which re-renders through subscribeToWebStoreChanges.
function write(promise: Promise<void>, label: string): void {
  promise.catch((error) => console.warn(`[database.web] ${label} failed:`, error));
}

export function createItem(
  type: Item['type'],
  title: string,
  status: Item['status'] = 'inbox',
  scheduledDate?: string,
  notes?: string,
  voice_transcript?: string
): string {
  const id = uuidv4();
  const now = Date.now();
  write(
    putItem({ id, type, title, status, scheduledDate, notes, voice_transcript, createdAt: now, updatedAt: now }),
    'createItem'
  );
  logActivity(id, 'created');
  return id;
}

export function updateItem(
  id: string,
  // `undefined` means "leave alone", `null` means "clear" — same contract as
  // database.ts, where null writes a real SQL NULL.
  updates: Partial<{
    type: Item['type'];
    title: string;
    status: Item['status'];
    notes: string | null;
    scheduledDate: string | null;
    dueDate: string | null;
    rrule: string | null;
  }>
): void {
  // null clears the field outright (Firestore's equivalent of SQL NULL) so it
  // reads back as absent, matching Item's optional-property types.
  const set = (value: string | null) => (value === null ? deleteField() : value);

  const fields: Record<string, unknown> = {};
  if (updates.type !== undefined) fields.type = updates.type;
  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.status !== undefined) fields.status = updates.status;
  if (updates.notes !== undefined) fields.notes = set(updates.notes);
  if (updates.scheduledDate !== undefined) fields.scheduledDate = set(updates.scheduledDate);
  if (updates.dueDate !== undefined) fields.dueDate = set(updates.dueDate);
  if (updates.rrule !== undefined) fields.rrule = set(updates.rrule);

  if (Object.keys(fields).length === 0) return;

  fields.updatedAt = Date.now();
  write(patchItem(id, fields), 'updateItem');
}

export function updateItemMetadata(id: string, metadata: Record<string, any>): void {
  write(patchItem(id, { metadata: JSON.stringify(metadata), updatedAt: Date.now() }), 'updateItemMetadata');
}

export function updateItemTitle(id: string, title: string): void {
  write(patchItem(id, { title, updatedAt: Date.now() }), 'updateItemTitle');
}

export function updateItemStatus(id: string, status: Item['status']): void {
  const now = Date.now();

  // A repeating task is never "done" — completing one occurrence rolls it
  // forward to its next matching date instead (Things 3 style).
  if (status === 'completed') {
    const item = getItemWithMetadata(id);
    const next = item ? nextOccurrenceDate(item.rrule, item.scheduledDate ?? formatDate(new Date())) : null;
    if (item && next) {
      write(
        patchItem(id, { scheduledDate: next, status: 'active', completedAt: deleteField(), updatedAt: now }),
        'updateItemStatus'
      );
      logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence: item.scheduledDate, next }));
      return;
    }
  }

  write(
    patchItem(id, {
      status,
      completedAt: status === 'completed' ? now : deleteField(),
      updatedAt: now,
    }),
    'updateItemStatus'
  );
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}

export function deleteItem(id: string): void {
  const now = Date.now();
  write(patchItem(id, { deletedAt: now, updatedAt: now }), 'deleteItem');
}

// ── Today planning ─────────────────────────────────────────────────────

// "Plan for Today" — puts an un-dated task on the Home Today blocks without
// giving it a calendar date. The stamp is date-specific, so it falls off by
// itself the next day.
export function planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  updateItemMetadata(itemId, meta);
}

export function unplanToday(itemId: string): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  delete meta.plannedDate;
  // Reset a real block preference back to Anytime, otherwise the editor's save
  // path would immediately re-plan the task and fight this removal.
  if (meta.preferredTimeBucket && meta.preferredTimeBucket !== 'anytime') {
    meta.preferredTimeBucket = 'anytime';
  }
  updateItemMetadata(itemId, meta);
}

export function getPlannedTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot().filter(
    (i) =>
      i.type === 'task' &&
      i.status !== 'completed' &&
      i.status !== 'inbox' &&
      i.deletedAt == null &&
      (i.metadata ?? '').includes(`"plannedDate":"${today}"`)
  );
}

// Repeating tasks usually carry no scheduledDate of their own, so getTodayItems
// can never see them — the rule itself decides membership.
export function getRepeatingItemsForToday(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot()
    .filter(
      (i) =>
        i.rrule != null &&
        i.rrule !== '' &&
        i.type === 'task' &&
        i.status !== 'completed' &&
        i.status !== 'inbox' &&
        i.deletedAt == null
    )
    .filter((item) => {
      const rule = parseRepeatRule(item.rrule);
      return rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false;
    });
}

// Reads back every occurrence a recurring item (task or habit) has ever
// completed, from the 'completed-occurrence' activity log entries
// updateItemStatus already writes on each roll-forward. Source of truth for
// streak calculation (see utils/streak.ts) — never a separately stored count.
// Ported verbatim from database.ts, substituting the Firestore mirror for SQL.
export function getCompletedOccurrenceDates(itemId: string): Set<string> {
  const dates = new Set<string>();
  for (const log of getActivityLogsSnapshot()) {
    if (log.entityId !== itemId || log.actionType !== 'completed-occurrence' || !log.details) continue;
    try {
      const parsed = JSON.parse(log.details) as { occurrence?: string };
      if (parsed.occurrence) dates.add(parsed.occurrence);
    } catch {
      // Malformed/legacy details row — skip rather than throw.
    }
  }
  return dates;
}

// Web mirror of database.ts's toggleHabitOccurrence — same log-only
// semantics, Firestore instead of SQL.
export function toggleHabitOccurrence(itemId: string, date: string): void {
  const existing = getActivityLogsSnapshot().find((log) => {
    if (log.entityId !== itemId || log.actionType !== 'completed-occurrence' || !log.details) return false;
    try {
      return (JSON.parse(log.details) as { occurrence?: string }).occurrence === date;
    } catch {
      return false;
    }
  });
  if (existing) {
    write(deleteActivityLogDoc(existing.id), 'toggleHabitOccurrence');
  } else {
    logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }));
  }
}

export function isPlannedForToday(item: Item): boolean {
  if (!item.metadata) return false;
  try {
    return (JSON.parse(item.metadata) as { plannedDate?: string }).plannedDate === formatDate(new Date());
  } catch {
    return false;
  }
}

// ── Relations & manual order ───────────────────────────────────────────

export function setRelation(sourceId: string, relationType: string, targetId: string | null): void {
  if (targetId === null) {
    write(deleteItemRelationDoc(sourceId, relationType), 'setRelation');
    return;
  }
  // Upsert on (sourceId, relationType), mirroring the ON CONFLICT clause in
  // database.ts — an existing edge keeps its id and createdAt.
  const existing = getItemRelationsSnapshot().find(
    (r) => r.sourceId === sourceId && r.relationType === relationType
  );
  write(
    putItemRelation({
      id: existing?.id ?? uuidv4(),
      sourceId,
      targetId,
      relationType,
      createdAt: existing?.createdAt ?? Date.now(),
    }),
    'setRelation'
  );
}

export function getRelation(sourceId: string, relationType: string): string | null {
  return (
    getItemRelationsSnapshot().find((r) => r.sourceId === sourceId && r.relationType === relationType)
      ?.targetId ?? null
  );
}

export function getBlockingTask(itemId: string): Item | null {
  const dependsOnId = getRelation(itemId, 'dependsOn');
  if (!dependsOnId) return null;
  const blocker = getItemWithMetadata(dependsOnId);
  if (!blocker || blocker.status === 'completed' || blocker.deletedAt) return null;
  return blocker;
}

export function setManualOrder(listKey: string, orderedIds: string[]): void {
  write(replaceItemOrder(listKey, orderedIds), 'setManualOrder');
}

export function applyManualOrder<T extends { id: string }>(listKey: string, items: T[]): T[] {
  const rows = getItemOrderSnapshot().filter((r) => r.listKey === listKey);
  if (rows.length === 0) return items;
  const positions = new Map(rows.map((r) => [r.itemId, r.position]));
  return [...items].sort((a, b) => {
    const posA = positions.get(a.id);
    const posB = positions.get(b.id);
    if (posA === undefined && posB === undefined) return 0;
    if (posA === undefined) return 1;
    if (posB === undefined) return -1;
    return posA - posB;
  });
}

// Rollup equivalents of the JOINs in database.ts: resolve the edges first,
// then filter the items they point at.
export function getRelatedItems(targetId: string, relationType: string): Item[] {
  const sourceIds = new Set(
    getItemRelationsSnapshot()
      .filter((r) => r.targetId === targetId && r.relationType === relationType)
      .map((r) => r.sourceId)
  );
  return getItemsSnapshot()
    .filter(
      (i) =>
        sourceIds.has(i.id) && i.deletedAt == null && i.status !== 'completed' && i.status !== 'archived'
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function countRelated(targetId: string, relationType: string): number {
  return getRelatedItems(targetId, relationType).length;
}

export function getProjectItemCount(projectId: string): number {
  return countRelated(projectId, 'project');
}

export function getAreaProjectCount(areaId: string): number {
  return countRelated(areaId, 'area');
}

export function getProjectsForArea(areaId: string): Item[] {
  return getRelatedItems(areaId, 'area');
}

// ── Calendar ───────────────────────────────────────────────────────────

export function getItemsForDate(date: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.scheduledDate === date && i.deletedAt == null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getTimelineEntriesForDate(date: string): TimelineEntry[] {
  return buildTimelineEntries(getItemsForDate(date), getInstancesForDate(date));
}

export function createTimedItem(
  type: Item['type'],
  title: string,
  scheduledDate: string,
  time: string,
  notes?: string,
): { itemId: string; instanceId: string } {
  const normalizedTime = normalizeTimeInput(time) ?? '09:00';
  const itemId = createItem(type, title, 'scheduled', scheduledDate, notes);
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const nextMeta = { time: normalizedTime, timeOfDay, preferredTimeBucket: 'anytime', durationMinutes: 45 };
  updateItemMetadata(itemId, nextMeta);

  const now = Date.now();
  const instanceId = uuid();
  write(
    putItemInstance({
      id: instanceId,
      itemId,
      scheduledDate,
      status: 'pending',
      instanceMetadata: JSON.stringify(nextMeta),
      createdAt: now,
      updatedAt: now,
    }),
    'createTimedItem'
  );

  return { itemId, instanceId };
}

export function updateTimelineItemTime(id: string, time: string, timeOfDay?: TimeOfDay): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;

  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const nextTimeOfDay = timeOfDay ?? getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const preferredTimeBucket = meta.preferredTimeBucket ?? meta.timeOfDay ?? 'anytime';
  updateItemMetadata(id, {
    ...meta,
    time: normalizedTime,
    timeOfDay: nextTimeOfDay,
    preferredTimeBucket,
  });

  // Newest instance on the item's own scheduled date, matching the ORDER BY
  // createdAt DESC LIMIT 1 in database.ts.
  const instance = getInstancesForDate(item.scheduledDate ?? '')
    .filter((i) => i.itemId === id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (instance) {
    const parsed = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = parsed.preferredTimeBucket ?? preferredTimeBucket;
    updateInstanceMetadata(instance.id, {
      ...parsed,
      time: normalizedTime,
      timeOfDay: nextTimeOfDay,
      preferredTimeBucket: instancePreferredTimeBucket,
    });
  }
}

export function updateTimelineItemSchedule(id: string, scheduledDate?: string, time?: string): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const metadata: Record<string, unknown> = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();

  if (!scheduledDate) {
    delete metadata.time;
    delete metadata.timeOfDay;
    write(
      patchItem(id, {
        scheduledDate: deleteField(),
        status: item.status === 'scheduled' ? 'active' : item.status,
        metadata: JSON.stringify(metadata),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
    write(deletePendingInstancesForItem(id), 'updateTimelineItemSchedule');
    return;
  }

  if (!time) {
    // Date-only: keep the date, drop the time-of-day and any pending timed
    // instance that went with it, but don't clear the date itself.
    delete metadata.time;
    delete metadata.timeOfDay;
    write(
      patchItem(id, {
        scheduledDate,
        status: 'scheduled',
        metadata: JSON.stringify(metadata),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
    write(deletePendingInstancesForItem(id), 'updateTimelineItemSchedule');
    return;
  }

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const preferredTimeBucket = metadata.preferredTimeBucket ?? metadata.timeOfDay ?? 'anytime';
  const nextMetadata = { ...metadata, time: normalizedTime, timeOfDay, preferredTimeBucket };

  write(
    patchItem(id, {
      scheduledDate,
      status: 'scheduled',
      metadata: JSON.stringify(nextMetadata),
      updatedAt: now,
    }),
    'updateTimelineItemSchedule'
  );

  const instance = getItemInstancesSnapshot()
    .filter((i) => i.itemId === id && i.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (instance) {
    const instanceMetadata = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = instanceMetadata.preferredTimeBucket ?? preferredTimeBucket;
    write(
      putItemInstance({
        ...instance,
        scheduledDate,
        instanceMetadata: JSON.stringify({
          ...instanceMetadata,
          time: normalizedTime,
          timeOfDay,
          preferredTimeBucket: instancePreferredTimeBucket,
        }),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
  } else {
    write(
      putItemInstance({
        id: uuid(),
        itemId: id,
        scheduledDate,
        status: 'pending',
        instanceMetadata: JSON.stringify({ time: normalizedTime, timeOfDay }),
        createdAt: now,
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
  }
}

// ── Instances ──────────────────────────────────────────────────────────

export function getInstancesForDate(date: string): ItemInstance[] {
  return getItemInstancesSnapshot()
    .filter((i) => i.scheduledDate === date)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getTodayInstances(): ItemInstance[] {
  const today = formatDate(new Date());
  return getItemInstancesSnapshot().filter((i) => i.scheduledDate === today);
}

// A missing instance is a no-op, matching an UPDATE that matches no rows.
export function updateInstanceMetadata(instanceId: string, metadata: Record<string, any>): void {
  const instance = getItemInstancesSnapshot().find((i) => i.id === instanceId);
  if (!instance) return;
  write(
    putItemInstance({ ...instance, instanceMetadata: JSON.stringify(metadata), updatedAt: Date.now() }),
    'updateInstanceMetadata'
  );
}

export function completeInstance(instanceId: string): void {
  const instance = getItemInstancesSnapshot().find((i) => i.id === instanceId);
  if (!instance) return;
  const now = Date.now();
  write(
    putItemInstance({ ...instance, status: 'completed', completedAt: now, updatedAt: now }),
    'completeInstance'
  );
}

// ── GTD triage ─────────────────────────────────────────────────────────

export function processInboxItem(id: string, destination: GtdDestination): void {
  const now = Date.now();
  const today = formatDate(new Date());

  if (destination === 'delete') {
    write(patchItem(id, { deletedAt: now, updatedAt: now }), 'processInboxItem');
    return;
  }

  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};

  // Exhaustive by construction: adding a GtdDestination without a patch here
  // is a compile error rather than a silent no-op.
  const patches: Record<GtdDestination, Record<string, unknown> | null> = {
    delete: null, // handled above
    today: { status: 'active', scheduledDate: today, metadata: JSON.stringify({ ...meta, gtdContext: 'today' }) },
    morning: {
      status: 'active',
      scheduledDate: today,
      metadata: JSON.stringify({ ...meta, timeOfDay: 'morning', gtdContext: 'scheduled' }),
    },
    evening: {
      status: 'active',
      scheduledDate: today,
      metadata: JSON.stringify({ ...meta, timeOfDay: 'evening', gtdContext: 'scheduled' }),
    },
    project: { type: 'project', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'project' }) },
    area: { type: 'area', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'area' }) },
    habit: { type: 'habit', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'habit' }) },
    medication: {
      type: 'medication',
      status: 'active',
      metadata: JSON.stringify({ ...meta, gtdContext: 'medication' }),
    },
    object: {
      type: 'object',
      status: 'active',
      metadata: JSON.stringify({ ...meta, gtdContext: 'object', objectStatus: 'want' }),
    },
    reference: { status: 'archived', metadata: JSON.stringify({ ...meta, gtdContext: 'reference' }) },
    someday: { status: 'someday', metadata: JSON.stringify({ ...meta, gtdContext: 'someday' }) },
  };

  const patch = patches[destination];
  if (patch) {
    write(patchItem(id, { ...patch, updatedAt: now }), 'processInboxItem');
  }
  logActivity(id, 'status-changed', JSON.stringify({ destination }));
}

// Three separate writes rather than processInboxItem's single patch, matching
// database.ts — triage carries richer combined state than one GTD destination.
export function applyTaskTriage(
  id: string,
  decision: {
    priority: 'low' | 'medium' | 'high';
    when: 'today' | 'tomorrow' | 'week' | 'someday';
    projectId: string | null;
  },
): void {
  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  meta.priority = decision.priority;

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  switch (decision.when) {
    case 'today':
      updateItem(id, { status: 'active', scheduledDate: today });
      break;
    case 'tomorrow':
      updateItem(id, { status: 'active', scheduledDate: tomorrow });
      break;
    case 'week':
      meta.gtdContext = 'week';
      updateItem(id, { status: 'active', scheduledDate: null });
      break;
    case 'someday':
      updateItem(id, { status: 'someday', scheduledDate: null });
      break;
  }

  updateItemMetadata(id, meta);
  setRelation(id, 'project', decision.projectId);
  logActivity(id, 'status-changed', JSON.stringify({ destination: 'triage-task', ...decision }));
}

// ── Activity Logs ──────────────────────────────────────────────────────

export function logActivity(entityId: string, actionType: string, details?: string): string {
  const id = uuidv4();
  const now = Date.now();
  write(
    putActivityLogDoc({ id, entityId, actionType, timestamp: now, details, createdAt: now }),
    'logActivity'
  );
  return id;
}

export function getTodayLogs(): ActivityLog[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getActivityLogsSnapshot()
    .filter((l) => l.timestamp >= start.getTime() && l.timestamp <= end.getTime())
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getMedicationLogs(itemId: string, limit = 10): ActivityLog[] {
  return getActivityLogsSnapshot()
    .filter((l) => l.entityId === itemId && l.actionType === 'medication-taken')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// TODO(web-companion): not yet ported — raw SQLite handle, meaningless on web
export function getDb(): never {
  return notImplementedOnWeb('getDb');
}

// TODO(web-companion): not yet ported — mobile-only dual-write helper, meaningless on web (Firestore is already the source of truth here)
export function syncItemToRemote(_id: string): void {
  notImplementedOnWeb('syncItemToRemote');
}

// Stock/container helpers ported verbatim from database.ts (pure functions over
// MedicationMeta, no SQLite/Firestore access — safe to duplicate rather than share,
// since database.ts's copies are private (unexported) implementation details).
export function getTotalStock(meta: MedicationMeta): number {
  if (meta.containers) return meta.containers.reduce((sum, c) => sum + c.remaining, 0);
  return meta.stockRemaining ?? 0;
}
// Ported verbatim from database.ts's getStockBreakdown — projects held stock against
// the *configured* full-restock shape (empty/never-restocked containers still show as
// an empty slot), deriving sheets front-to-back from consumption. Pure function, no DB.
export function getStockBreakdown(meta: MedicationMeta): StockBreakdown | null {
  if (!meta.containerSize && (!meta.containers || meta.containers.length === 0)) return null;

  const containerSize = meta.containerSize ?? meta.containers![0].total;
  const perRestock = meta.containersPerRestock ?? 1;
  const real = meta.containers ?? [];
  const slots = Math.max(perRestock, real.length);

  const containers: StockBreakdownContainer[] = Array.from({ length: slots }, (_, i) => {
    const c = real[i] ?? { total: containerSize, remaining: 0 };
    if (!meta.sheetsPerContainer || !meta.pillsPerSheet) return c;

    let consumed = c.total - c.remaining;
    const sheets: StockBreakdownSheet[] = Array.from({ length: meta.sheetsPerContainer! }, () => {
      const taken = Math.max(0, Math.min(meta.pillsPerSheet!, consumed));
      consumed -= taken;
      return { total: meta.pillsPerSheet!, remaining: meta.pillsPerSheet! - taken };
    });
    return { ...c, sheets };
  });

  return {
    current: containers.reduce((sum, c) => sum + c.remaining, 0),
    capacity: containers.reduce((sum, c) => sum + c.total, 0),
    containers,
  };
}

// Ported verbatim from database.ts's getContainerSummary.
export function getContainerSummary(meta: MedicationMeta): string | null {
  const breakdown = getStockBreakdown(meta);
  if (!breakdown) return null;
  const { current, capacity, containers } = breakdown;
  const top = `${current}/${capacity}`;
  const showDetail = containers.length > 1 || containers.some((c) => c.sheets);
  if (!showDetail) return top;

  const containerParts = containers.map((c) => {
    if (c.sheets) {
      const sheetParts = c.sheets.map((s) => `${s.remaining}/${s.total}`).join('+');
      return `${c.remaining}/${c.total} (${sheetParts})`;
    }
    return `${c.remaining}/${c.total}`;
  });
  return `${top} · ${containerParts.join(' + ')}`;
}
export function restockMedication(itemId: string, containerCount = 1): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  if (!meta.containerSize) {
    write(patchItem(itemId, { metadata: JSON.stringify({ ...meta, stockRemaining: (meta.stockRemaining ?? 0) + (meta.initialStock ?? 0) }), updatedAt: Date.now() }), 'restockMedication');
    return;
  }
  const containers = [...(meta.containers ?? [])];
  for (let i = 0; i < containerCount; i++) {
    containers.push({ total: meta.containerSize, remaining: meta.containerSize });
  }
  const nextMeta = { ...meta, containers, stockRemaining: containers.reduce((sum, c) => sum + c.remaining, 0) };
  write(patchItem(itemId, { metadata: JSON.stringify(nextMeta), updatedAt: Date.now() }), 'restockMedication');
}
export function parseMedicationTimerDetails(details?: string | null): MedicationTimerDetails {
  if (!details) return {};
  try {
    return JSON.parse(details) as MedicationTimerDetails;
  } catch {
    return {};
  }
}
export function getMedications(): Item[] {
  return getItemsByType('medication');
}
export function createMedication(title: string, meta: MedicationMeta): string {
  const id = uuidv4();
  const now = Date.now();
  const initial = meta.initialStock ?? meta.stockRemaining ?? 0;
  const metadata: MedicationMeta = meta.containerSize
    ? { ...meta, containers: initial > 0 ? [{ total: meta.containerSize, remaining: initial }] : [], stockRemaining: initial }
    : { ...meta, stockRemaining: initial };
  write(
    putItem({ id, type: 'medication', title, status: 'active', metadata: JSON.stringify(metadata), createdAt: now, updatedAt: now }),
    'createMedication'
  );
  return id;
}
export function updateMedication(id: string, title: string, meta: MedicationMeta): void {
  write(patchItem(id, { title, metadata: JSON.stringify(meta), updatedAt: Date.now() }), 'updateMedication');
}
function decrementStock(meta: MedicationMeta, amount = 1): MedicationMeta {
  if (meta.containers) {
    const containers = meta.containers.map((c) => ({ ...c }));
    const target = containers.find((c) => c.remaining > 0);
    if (target) target.remaining = Math.max(0, target.remaining - amount);
    return { ...meta, containers, stockRemaining: containers.reduce((sum, c) => sum + c.remaining, 0) };
  }
  if (meta.stockRemaining !== undefined && meta.stockRemaining > 0) {
    return { ...meta, stockRemaining: Math.max(0, meta.stockRemaining - amount) };
  }
  return meta;
}
export function logMedicationTaken(itemId: string, takenAt: number = Date.now(), startTimer = false, amount = 1): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  let meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  if (!meta.lastTakenAt || takenAt > meta.lastTakenAt) meta.lastTakenAt = takenAt;
  meta = decrementStock(meta, amount);
  write(patchItem(itemId, { metadata: JSON.stringify(meta), updatedAt: Date.now() }), 'logMedicationTaken');
  const logId = uuidv4();
  const now = Date.now();
  const details: MedicationTimerDetails = {
    dose: meta.dose,
    loggedAt: now,
    timerActive: startTimer,
    startedAt: startTimer ? takenAt : undefined,
    accumulatedMs: 0,
    autoStopAfterMs: startTimer ? resolveAutoStopAfterMs(meta.autoStopAfterHours) : undefined,
    notified: false,
  };
  write(
    putActivityLogDoc({
      id: logId,
      entityId: itemId,
      actionType: 'medication-taken',
      timestamp: takenAt,
      details: JSON.stringify(details),
      createdAt: now,
    }),
    'logMedicationTaken:log'
  );
}
export function logHalfDoseTaken(itemId: string, takenAt: number = Date.now(), startTimer = false): boolean {
  const item = getItemWithMetadata(itemId);
  if (!item) return false;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const completingSplit = !!meta.pendingHalfDoseAt;
  logMedicationTaken(itemId, takenAt, startTimer, 0.5);
  const updated = getItemWithMetadata(itemId);
  const updatedMeta: MedicationMeta = updated?.metadata ? JSON.parse(updated.metadata) : {};
  updatedMeta.pendingHalfDoseAt = completingSplit ? undefined : takenAt;
  write(patchItem(itemId, { metadata: JSON.stringify(updatedMeta), updatedAt: Date.now() }), 'logHalfDoseTaken');
  return completingSplit;
}
export function getMedicationDoseHistory(itemId: string, days = 7): Array<{ date: string; count: number }> {
  const logs = getMedicationLogs(itemId, days * 3);
  return countDosesByDay(logs.map((log) => log.timestamp), days);
}
export function deleteMedicationLog(logId: string, itemId: string): void {
  write(deleteActivityLogDoc(logId), 'deleteMedicationLog');
  syncLastTakenAt(itemId);
}
export function editMedicationLog(logId: string, itemId: string, newTimestamp: number): void {
  write(patchActivityLogDoc(logId, { timestamp: newTimestamp }), 'editMedicationLog');
  syncLastTakenAt(itemId);
}
// Timer state lives entirely in an activityLogs row's `details` JSON — same shape as
// native, so every function below is a direct port substituting patchActivityLogDoc for
// the native UPDATE. syncLastTakenAt mirrors database.ts's private _syncLastTakenAt.
function findLog(logId: string): ActivityLog | undefined {
  return getActivityLogsSnapshot().find((l) => l.id === logId);
}

function syncLastTakenAt(itemId: string): void {
  const latest = getMedicationLogs(itemId, 1)[0];
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const next = { ...meta };
  if (latest) next.lastTakenAt = latest.timestamp;
  else delete next.lastTakenAt;
  write(patchItem(itemId, { metadata: JSON.stringify(next), updatedAt: Date.now() }), 'syncLastTakenAt');
}

export function stopMedicationTimer(logId: string, itemId: string): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  details.timerActive = false;
  delete details.pausedAt;
  delete details.accumulatedMs;
  details.stoppedAt = Date.now();
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'stopMedicationTimer');
  syncLastTakenAt(itemId);
}
export function completeMedicationTimer(
  logId: string,
  itemId: string,
  completedElapsedMs: number,
  reason: 'manual' | 'automatic'
): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  if (details.stoppedAt && details.timerStoppedReason) return;
  details.timerActive = false;
  delete details.pausedAt;
  details.accumulatedMs = completedElapsedMs;
  details.completedElapsedMs = completedElapsedMs;
  details.timerStoppedReason = reason;
  details.stoppedAt = Date.now();
  delete details.autoStopNotificationId;
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'completeMedicationTimer');
  syncLastTakenAt(itemId);
}
export function setMedicationTimerNotificationId(_logId: string, _notificationId?: string): void {
  // Local-notification bookkeeping only — no desktop UI ever calls this.
  notImplementedOnWeb('setMedicationTimerNotificationId');
}
export function pauseMedicationTimer(logId: string, itemId: string): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  if (!details.timerActive || !details.startedAt) return;
  const now = Date.now();
  const accumulatedMs = (details.accumulatedMs ?? 0) + Math.max(0, now - details.startedAt);
  details.timerActive = false;
  details.pausedAt = now;
  details.accumulatedMs = accumulatedMs;
  delete details.stoppedAt;
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'pauseMedicationTimer');
  syncLastTakenAt(itemId);
}
export function markMedicationTimerNotified(_logId: string): void {
  // Local-notification bookkeeping only — no desktop UI ever calls this.
  notImplementedOnWeb('markMedicationTimerNotified');
}
export function resumeMedicationTimer(logId: string, itemId: string): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  details.timerActive = true;
  details.startedAt = Date.now();
  delete details.pausedAt;
  details.notified = false;
  delete details.stoppedAt;
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'resumeMedicationTimer');
  syncLastTakenAt(itemId);
}
export function resetMedicationTimer(logId: string, itemId: string): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  const now = Date.now();
  details.timerActive = true;
  details.startedAt = now;
  details.accumulatedMs = 0;
  delete details.pausedAt;
  delete details.stoppedAt;
  details.notified = false;
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'resetMedicationTimer');
  syncLastTakenAt(itemId);
}
export function startTimerFromLoggedDose(logId: string, itemId: string): void {
  const log = findLog(logId);
  if (!log) return;
  const details = parseMedicationTimerDetails(log.details);
  const item = getItemWithMetadata(itemId);
  const meta: MedicationMeta = item?.metadata ? JSON.parse(item.metadata) : {};
  details.timerActive = true;
  details.startedAt = log.timestamp;
  details.accumulatedMs = 0;
  details.autoStopAfterMs = resolveAutoStopAfterMs(meta.autoStopAfterHours);
  delete details.pausedAt;
  delete details.stoppedAt;
  details.notified = false;
  write(patchActivityLogDoc(logId, { details: JSON.stringify(details) }), 'startTimerFromLoggedDose');
  syncLastTakenAt(itemId);
}
export function getActiveMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return getActivityLogsSnapshot()
    .filter((l) => l.actionType === 'medication-taken')
    .sort((a, b) => b.timestamp - a.timestamp)
    .flatMap((log) => {
      const details = parseMedicationTimerDetails(log.details);
      if (!details.timerActive || !details.startedAt) return [];
      const med = getItemWithMetadata(log.entityId);
      if (!med) return [];
      return [{ log, med, details }];
    });
}
export function getPersistentMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return getActivityLogsSnapshot()
    .filter((l) => l.actionType === 'medication-taken')
    .sort((a, b) => b.timestamp - a.timestamp)
    .flatMap((log) => {
      const details = parseMedicationTimerDetails(log.details);
      if (!details.timerActive && !details.pausedAt) return [];
      const med = getItemWithMetadata(log.entityId);
      if (!med) return [];
      return [{ log, med, details }];
    });
}
export function getTimerWidgetPreferences(): TimerWidgetPreferences {
  return notImplementedOnWeb('getTimerWidgetPreferences');
}
export function setTimerWidgetPreferences(_preferences: Partial<TimerWidgetPreferences>): TimerWidgetPreferences {
  return notImplementedOnWeb('setTimerWidgetPreferences');
}
export function getLastTakenLog(itemId: string): ActivityLog | null {
  return getMedicationLogs(itemId, 1)[0] ?? null;
}


