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

// TODO(web-companion): not yet ported — raw SQLite handle, meaningless on web
export function getDb(): never {
  return notImplementedOnWeb('getDb');
}

// TODO(web-companion): not yet ported — mobile-only dual-write helper, meaningless on web (Firestore is already the source of truth here)
export function syncItemToRemote(_id: string): void {
  notImplementedOnWeb('syncItemToRemote');
}

// TODO(web-companion): not yet ported — medication tracking (future sub-project)
export function getTotalStock(_meta: MedicationMeta): number {
  return notImplementedOnWeb('getTotalStock');
}
export function getStockBreakdown(_meta: MedicationMeta): StockBreakdown | null {
  return notImplementedOnWeb('getStockBreakdown');
}
export function getContainerSummary(_meta: MedicationMeta): string | null {
  return notImplementedOnWeb('getContainerSummary');
}
export function restockMedication(_itemId: string, _containerCount?: number): void {
  notImplementedOnWeb('restockMedication');
}
export function parseMedicationTimerDetails(_details?: string | null): MedicationTimerDetails {
  return notImplementedOnWeb('parseMedicationTimerDetails');
}
export function getMedications(): Item[] {
  return notImplementedOnWeb('getMedications');
}
export function createMedication(_title: string, _meta: MedicationMeta): string {
  return notImplementedOnWeb('createMedication');
}
export function updateMedication(_id: string, _title: string, _meta: MedicationMeta): void {
  notImplementedOnWeb('updateMedication');
}
export function logMedicationTaken(_itemId: string, _takenAt?: number, _startTimer?: boolean, _amount?: number): void {
  notImplementedOnWeb('logMedicationTaken');
}
export function logHalfDoseTaken(_itemId: string, _takenAt?: number, _startTimer?: boolean): boolean {
  return notImplementedOnWeb('logHalfDoseTaken');
}
export function getMedicationLogs(_itemId: string, _limit?: number): ActivityLog[] {
  return notImplementedOnWeb('getMedicationLogs');
}
export function getMedicationDoseHistory(_itemId: string, _days?: number): Array<{ date: string; count: number }> {
  return notImplementedOnWeb('getMedicationDoseHistory');
}
export function deleteMedicationLog(_logId: string, _itemId: string): void {
  notImplementedOnWeb('deleteMedicationLog');
}
export function editMedicationLog(_logId: string, _itemId: string, _newTimestamp: number): void {
  notImplementedOnWeb('editMedicationLog');
}
export function stopMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('stopMedicationTimer');
}
export function completeMedicationTimer(_logId: string, _itemId: string, _completedElapsedMs: number, _reason: 'manual' | 'automatic'): void {
  notImplementedOnWeb('completeMedicationTimer');
}
export function setMedicationTimerNotificationId(_logId: string, _notificationId?: string): void {
  notImplementedOnWeb('setMedicationTimerNotificationId');
}
export function pauseMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('pauseMedicationTimer');
}
export function markMedicationTimerNotified(_logId: string): void {
  notImplementedOnWeb('markMedicationTimerNotified');
}
export function resumeMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('resumeMedicationTimer');
}
export function resetMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('resetMedicationTimer');
}
export function startTimerFromLoggedDose(_logId: string, _itemId: string): void {
  notImplementedOnWeb('startTimerFromLoggedDose');
}
export function getActiveMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return notImplementedOnWeb('getActiveMedicationTimers');
}
export function getPersistentMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return notImplementedOnWeb('getPersistentMedicationTimers');
}
export function getTimerWidgetPreferences(): TimerWidgetPreferences {
  return notImplementedOnWeb('getTimerWidgetPreferences');
}
export function setTimerWidgetPreferences(_preferences: Partial<TimerWidgetPreferences>): TimerWidgetPreferences {
  return notImplementedOnWeb('setTimerWidgetPreferences');
}
export function getLastTakenLog(_itemId: string): ActivityLog | null {
  return notImplementedOnWeb('getLastTakenLog');
}


// TODO(web-companion): not yet ported — GTD triage, Plan 2
export function processInboxItem(_id: string, _destination: GtdDestination): void {
  notImplementedOnWeb('processInboxItem');
}
export function applyTaskTriage(
  _id: string,
  _decision: { priority: 'low' | 'medium' | 'high'; when: 'today' | 'tomorrow' | 'week' | 'someday'; projectId: string | null },
): void {
  notImplementedOnWeb('applyTaskTriage');
}
