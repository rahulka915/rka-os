import { useState, useEffect, useCallback } from 'react';
import {
  getInboxItems,
  getTodayItems,
  getTodayInstances,
  getTodayLogs,
  getItemsByStatus,
  createItem,
  updateItemStatus,
  deleteItem,
  completeInstance,
  formatDate,
  getMedications,
  logMedicationTaken,
  getMedicationLogs,
  getItemsForDate,
  getInstancesForDate,
  getDb,
} from '../db/database';
import type { Item, ItemInstance } from '../db/types';

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
    refresh();
  }, [refresh]);

  return { medications, refresh, takeMedication };
}

export function useCalendar(date: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [instances, setInstances] = useState<ItemInstance[]>([]);

  const refresh = useCallback(() => {
    setItems(getItemsForDate(date));
    setInstances(getInstancesForDate(date));
  }, [date]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, instances, refresh };
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
