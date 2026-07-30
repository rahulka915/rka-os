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
import { nextOccurrenceDate } from '../utils/repeat';
import type { Item, ItemInstance, ActivityLog } from './types';
import {
  getItemsSnapshot,
  getActivityLogsSnapshot,
  putItem,
  patchItem,
  putActivityLogDoc,
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

// TODO(web-companion): not yet ported — calendar/timeline, Plan 2
export function getItemsForDate(_date: string): Item[] {
  return notImplementedOnWeb('getItemsForDate');
}
export function getInstancesForDate(_date: string): ItemInstance[] {
  return notImplementedOnWeb('getInstancesForDate');
}
export function getTimelineEntriesForDate(_date: string): TimelineEntry[] {
  return notImplementedOnWeb('getTimelineEntriesForDate');
}
export function createTimedItem(
  _type: Item['type'],
  _title: string,
  _scheduledDate: string,
  _time: string,
  _notes?: string,
): { itemId: string; instanceId: string } {
  return notImplementedOnWeb('createTimedItem');
}
export function updateTimelineItemTime(_id: string, _time: string): void {
  notImplementedOnWeb('updateTimelineItemTime');
}
export function updateTimelineItemSchedule(_id: string, _scheduledDate?: string, _time?: string): void {
  notImplementedOnWeb('updateTimelineItemSchedule');
}
export function updateInstanceMetadata(_instanceId: string, _metadata: Record<string, any>): void {
  notImplementedOnWeb('updateInstanceMetadata');
}
export function getTodayInstances(): ItemInstance[] {
  return notImplementedOnWeb('getTodayInstances');
}
export function completeInstance(_instanceId: string): void {
  notImplementedOnWeb('completeInstance');
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
