import { useState, useEffect, useCallback } from 'react';
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
} from '../db/database';
import type { Item, ItemInstance } from '../db/types';
import type { TimelineEntry } from '../db/database';
import { resolveTimeBucket, type TimeOfDay } from '../utils/time';
import { startMedicationLiveActivity } from '../services/medicationLiveActivity';
import { ensureMedicationTimerAutoStop } from '../services/medicationTimerController';
import { presentMedicationTimer } from '../utils/timerPresentation';

export function useInbox() {
  const [items, setItems] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setItems(getInboxItems());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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

  useEffect(() => { refresh(); }, [refresh]);

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

  useEffect(() => { refresh(); }, [refresh]);

  return { items, refresh };
}

export function useMedications() {
  const [medications, setMedications] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setMedications(getMedications());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const takeMedication = useCallback((id: string, takenAt?: number, startTimer = false) => {
    logMedicationTaken(id, takenAt, startTimer);
    if (startTimer) {
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
    }
    refresh();
  }, [refresh, medications]);

  return { medications, refresh, takeMedication };
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

  useEffect(() => { refresh(); }, [refresh]);

  return { items, instances, timelineEntries, refresh };
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setWorkouts(getItemsByType('workout-template'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { workouts, refresh };
}

export function useProjects() {
  const [projects, setProjects] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setProjects(getItemsByType('project'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { projects, refresh };
}

export function useAreas() {
  const [areas, setAreas] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setAreas(getItemsByType('area'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { areas, refresh };
}

// Global Tasks list — excludes 'inbox' (still awaiting triage in the Inbox screen) and
// 'completed' tasks, which shouldn't clutter an ongoing GTD working list.
export function useTasks() {
  const [tasks, setTasks] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setTasks(getItemsByType('task').filter(t => t.status !== 'inbox' && t.status !== 'completed'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { tasks, refresh };
}

export function useCompletedItems() {
  const [items, setItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setItems(getCompletedItems());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, refresh };
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
