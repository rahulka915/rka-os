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

import type { Item, ItemInstance, ActivityLog } from './types';

function notImplementedOnWeb(name: string): never {
  throw new Error(`${name} is not implemented on web yet`);
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
