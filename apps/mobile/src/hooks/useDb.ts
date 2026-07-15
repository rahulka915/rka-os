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
  formatDate,
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
} from '../db/database';
import type { Item, ItemInstance } from '../db/types';
import type { TimelineEntry } from '../db/database';
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

export function useHomeData() {
  const [todayItems, setTodayItems] = useState<Item[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const refresh = useCallback(() => {
    setTodayItems(getTodayItems());
    setInboxCount(getInboxItems().length);
    setUpcomingCount(getItemsByStatus('active').length);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const today = formatDate(new Date());
  const anytime = todayItems.filter(i => !i.scheduledDate || i.scheduledDate !== today);
  const morningItems = todayItems.filter(i => {
    const meta = i.metadata ? JSON.parse(i.metadata) : {};
    return meta.timeOfDay === 'morning';
  });
  const afternoonItems = todayItems.filter(i => {
    const meta = i.metadata ? JSON.parse(i.metadata) : {};
    return meta.timeOfDay === 'afternoon';
  });
  const eveningItems = todayItems.filter(i => {
    const meta = i.metadata ? JSON.parse(i.metadata) : {};
    return meta.timeOfDay === 'evening';
  });

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

export function completeAllInTimeBlock(timeOfDay: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const todayItems = getTodayItems();

  todayItems.forEach((item) => {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    const itemTimeOfDay = meta.timeOfDay || 'anytime';

    if (itemTimeOfDay === timeOfDay && item.status !== 'completed') {
      updateItemStatus(item.id, 'completed');
    }
  });
}
