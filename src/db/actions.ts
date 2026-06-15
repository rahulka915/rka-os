import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Item, ItemInstance } from './db';

// Format Date as YYYY-MM-DD
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function createAction(title: string, date: Date | null, projectId?: string) {
  const itemId = uuidv4();
  
  const newItem: Item = {
    id: itemId,
    type: 'task',
    title,
    projectId,
  };

  // Run in transaction to ensure both are created
  await db.transaction('rw', db.items, db.itemInstances, async () => {
    await db.items.add(newItem);

    // If a date is provided, create a specific occurrence
    if (date) {
      const instance: ItemInstance = {
        id: uuidv4(),
        itemId,
        scheduledDate: formatDate(date),
        status: 'pending'
      };
      await db.itemInstances.add(instance);
    }
  });
}

export async function completeActionInstance(instanceId: string) {
  await db.itemInstances.update(instanceId, {
    status: 'completed',
    completedAt: Date.now()
  });
}

export async function toggleActionInstance(instanceId: string, currentStatus: string) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  await db.itemInstances.update(instanceId, {
    status: newStatus as any,
    completedAt: newStatus === 'completed' ? Date.now() : undefined
  });
}

export async function takeMedication(instanceId: string) {
  await db.transaction('rw', db.items, db.itemInstances, async () => {
    const instance = await db.itemInstances.get(instanceId);
    if (!instance || instance.status === 'completed') return;

    const item = await db.items.get(instance.itemId);
    if (item && item.type === 'medication' && item.metadata) {
      const meta = item.metadata;
      meta.stock -= 1;
      await db.items.update(item.id, { metadata: meta });
    }

    await db.itemInstances.update(instanceId, {
      status: 'completed',
      completedAt: Date.now()
    });
  });
}

export async function completeHabit(instanceId: string) {
  await db.transaction('rw', db.items, db.itemInstances, async () => {
    const instance = await db.itemInstances.get(instanceId);
    if (!instance || instance.status === 'completed') return;

    const item = await db.items.get(instance.itemId);
    if (item && item.type === 'habit' && item.metadata) {
      const meta = item.metadata;
      meta.currentStreak = (meta.currentStreak || 0) + 1;
      if (meta.currentStreak > (meta.longestStreak || 0)) {
        meta.longestStreak = meta.currentStreak;
      }
      await db.items.update(item.id, { metadata: meta });
    }

    await db.itemInstances.update(instanceId, {
      status: 'completed',
      completedAt: Date.now()
    });
  });
}

export async function saveWorkoutInstance(instanceId: string, instanceMetadata: any) {
  await db.itemInstances.update(instanceId, {
    instanceMetadata
  });
}

export async function completeWorkout(instanceId: string) {
  await db.itemInstances.update(instanceId, {
    status: 'completed',
    completedAt: Date.now()
  });
}

// For Inbox (Items without a scheduled date and no project)
export async function getInboxItems() {
  const allItems = await db.items.toArray();
  const allInstances = await db.itemInstances.toArray();
  
  const itemIdsWithInstances = new Set(allInstances.map(i => i.itemId));
  
  return allItems.filter(item => !itemIdsWithInstances.has(item.id) && !item.projectId);
}

export async function completeInboxItem(item: Item) {
  const instanceId = uuidv4();
  await db.itemInstances.add({
    id: instanceId,
    itemId: item.id,
    scheduledDate: formatDate(new Date()),
    status: 'completed',
    completedAt: Date.now()
  });
}
