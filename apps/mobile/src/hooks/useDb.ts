import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  getInboxItems,
  getTodayItems,
  getTodayInstances,
  getTodayLogs,
  getItemsByStatus,
  getItemsByType,
  createItem,
  updateItemStatus,
  deleteItem,
  completeInstance,
  getMedications,
  logMedicationTaken,
  logHalfDoseTaken,
  getMedicationLogs,
  getLastTakenLog,
  getItemsForDate,
  getInstancesForDate,
  getTimelineEntriesForDate,
  getDb,
  type MedicationMeta,
  getPersistentMedicationTimers,
  getCompletedItems,
  getPlannedTodayItems,
  getRepeatingItemsForToday,
  getUpcomingItems,
  formatDate,
} from '../db/database';
import type { Item, ItemInstance } from '../db/types';
import type { TimelineEntry } from '../db/database';
import { resolveTimeBucket, type TimeOfDay } from '../utils/time';
import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
import { startMedicationLiveActivity } from '../services/medicationLiveActivity';
import { ensureMedicationTimerAutoStop } from '../services/medicationTimerController';
import { presentMedicationTimer } from '../utils/timerPresentation';
import { subscribeToWebStoreChanges } from '../db/firestoreWebStore';

// Reads once on mount, as every hook here has always done. On web the data
// lives in a Firestore mirror that updates on its own, so the hooks also
// re-read whenever it changes — on native the store is never started and this
// is a no-op (firestoreSync writes straight into SQLite instead).
export function useDbRefresh(refresh: () => void): void {
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return subscribeToWebStoreChanges(refresh);
  }, [refresh]);
}

export function useInbox() {
  const [items, setItems] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setItems(getInboxItems());
  }, []);

  useDbRefresh(refresh);

  const addItem = useCallback((title: string) => {
    createItem('task', title, 'inbox');
    refresh();
  }, [refresh]);

  const activateItem = useCallback((id: string) => {
    updateItemStatus(id, 'active');
    refresh();
  }, [refresh]);

  const archiveItem = useCallback((id: string) => {
    updateItemStatus(id, 'archived');
    refresh();
  }, [refresh]);

  return { items, count: items.length, refresh, addItem, activateItem, archiveItem };
}

function bucketOf(item: Item): TimeOfDay {
  return resolveTimeBucket(item.metadata ? JSON.parse(item.metadata) : {});
}

export function useHomeData() {
  const [todayItems, setTodayItems] = useState<Item[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const refresh = useCallback(() => {
    // Home "Today" = the union of calendar-dated-today tasks and tasks the
    // user explicitly planned for today (planForToday). Dedupe by id since a
    // task can satisfy both.
    const seen = new Set<string>();
    const merged: Item[] = [];
    for (const item of [...getTodayItems(), ...getPlannedTodayItems(), ...getRepeatingItemsForToday()]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    setTodayItems(merged);
    setInboxCount(getInboxItems().length);
    setUpcomingCount(getItemsByStatus('active').length);
  }, []);

  useDbRefresh(refresh);

  // Each task lands in exactly one block via its resolved bucket (chosen
  // preferred bucket → scheduled clock time → Anytime), so the four blocks
  // partition Today with no overlaps or gaps.
  const anytime = todayItems.filter(i => bucketOf(i) === 'anytime');
  const morningItems = todayItems.filter(i => bucketOf(i) === 'morning');
  const afternoonItems = todayItems.filter(i => bucketOf(i) === 'afternoon');
  const eveningItems = todayItems.filter(i => bucketOf(i) === 'evening');

  return { todayItems, inboxCount, upcomingCount, anytime, morningItems, afternoonItems, eveningItems, refresh };
}

export function useItems(status: string) {
  const [items, setItems] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setItems(getItemsByStatus(status));
  }, [status]);

  useDbRefresh(refresh);

  return { items, refresh };
}

export function useMedications() {
  const [medications, setMedications] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setMedications(getMedications());
  }, []);

  useDbRefresh(refresh);

  // Shared by full and half doses — a live-activity timer just tracks elapsed time since
  // whatever log entry started it, so it works identically regardless of dose size.
  const startTimerForLatestLog = useCallback((id: string) => {
    const item = medications.find(m => m.id === id);
    const log = getLastTakenLog(id);
    if (item && log) {
      const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
      startMedicationLiveActivity(log.id, {
        medicationName: item.title,
        dose: meta.dose,
        displayStartedAt: log.timestamp,
      });
      const timer = getPersistentMedicationTimers().find(candidate => candidate.log.id === log.id);
      if (timer) ensureMedicationTimerAutoStop(presentMedicationTimer(timer, Date.now())).catch(() => {});
    }
  }, [medications]);

  const takeMedication = useCallback((id: string, takenAt?: number, startTimer = false) => {
    logMedicationTaken(id, takenAt, startTimer);
    if (startTimer) startTimerForLatestLog(id);
    refresh();
  }, [refresh, startTimerForLatestLog]);

  const takeHalfDose = useCallback((id: string, takenAt?: number, startTimer = false) => {
    const completedSplit = logHalfDoseTaken(id, takenAt, startTimer);
    if (startTimer) startTimerForLatestLog(id);
    refresh();
    return completedSplit;
  }, [refresh, startTimerForLatestLog]);

  return { medications, refresh, takeMedication, takeHalfDose };
}

export function useCalendar(date: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [instances, setInstances] = useState<ItemInstance[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);

  const refresh = useCallback(() => {
    setItems(getItemsForDate(date));
    setInstances(getInstancesForDate(date));
    setTimelineEntries(getTimelineEntriesForDate(date));
  }, [date]);

  useDbRefresh(refresh);

  return { items, instances, timelineEntries, refresh };
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setWorkouts(getItemsByType('workout-template'));
  }, []);
  useDbRefresh(refresh);
  return { workouts, refresh };
}

export function useProjects() {
  const [projects, setProjects] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setProjects(getItemsByType('project'));
  }, []);
  useDbRefresh(refresh);
  return { projects, refresh };
}

export function useAreas() {
  const [areas, setAreas] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setAreas(getItemsByType('area'));
  }, []);
  useDbRefresh(refresh);
  return { areas, refresh };
}

// Global Tasks list — excludes 'inbox' (still awaiting triage in the Inbox screen) and
// 'completed' tasks, which shouldn't clutter an ongoing GTD working list.
export function useTasks() {
  const [tasks, setTasks] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setTasks(getItemsByType('task').filter(t => t.status !== 'inbox' && t.status !== 'completed'));
  }, []);
  useDbRefresh(refresh);
  return { tasks, refresh };
}

export function useCompletedItems() {
  const [items, setItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setItems(getCompletedItems());
  }, []);
  useDbRefresh(refresh);
  return { items, refresh };
}

export function useArchivedItems() {
  const [items, setItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setItems(getItemsByStatus('archived'));
  }, []);
  useDbRefresh(refresh);
  return { items, refresh };
}

const UPCOMING_PREVIEW_LIMIT = 5;

// Caps a date-grouped list at `limit` items total, cutting off mid-group
// (not dropping whole trailing groups) — the "View all" row in the
// consuming UI covers whatever's cut off after this point.
function capUpcomingGroups(groups: UpcomingGroup[], limit: number): UpcomingGroup[] {
  const capped: UpcomingGroup[] = [];
  let remaining = limit;
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    capped.push({ ...group, items });
    remaining -= items.length;
  }
  return capped;
}

export function useUpcomingPreview() {
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setGroups(capUpcomingGroups(groupByScheduledDate(getUpcomingItems(today), today), UPCOMING_PREVIEW_LIMIT));
  }, []);
  useDbRefresh(refresh);
  return { groups, refresh };
}

export function useTodayHabits() {
  const [habits, setHabits] = useState<HabitRowData[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    // Checking a habit in rolls its scheduledDate forward to the next
    // occurrence (same recurring-task rollover updateItemStatus already
    // does), which flips isScheduledToday to false immediately — keep
    // showing it anyway via isCompletedToday so it reads as "done for
    // today" instead of vanishing the instant it's checked off.
    setHabits(
      getItemsByType('habit')
        .map((item) => buildHabitRowData(item, today))
        .filter((row) => row.isScheduledToday || row.isCompletedToday),
    );
  }, []);
  useDbRefresh(refresh);
  return { habits, refresh };
}

export function completeAllInTimeBlock(bucket: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  // Same Today union + bucket resolution as useHomeData, so "complete all in
  // this block" acts on exactly the rows the block displays.
  const seen = new Set<string>();
  for (const item of [...getTodayItems(), ...getPlannedTodayItems(), ...getRepeatingItemsForToday()]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const itemBucket = resolveTimeBucket(item.metadata ? JSON.parse(item.metadata) : {});
    if (itemBucket === bucket && item.status !== 'completed') {
      updateItemStatus(item.id, 'completed');
    }
  }
}
