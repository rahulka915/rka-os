import { RRule } from 'rrule';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { formatDate } from './actions';

export async function materializeInstances(itemId: string) {
  const item = await db.items.get(itemId);
  if (!item || !item.rrule) return;

  const rule = RRule.fromString(item.rrule);
  
  const now = new Date();
  const until = new Date();
  until.setDate(now.getDate() + 30);
  
  const dates = rule.between(now, until, true);
  
  const existing = await db.itemInstances.where('itemId').equals(itemId).toArray();
  const existingDates = new Set(existing.map(i => i.scheduledDate));
  
  const newInstances = dates
    .filter(d => !existingDates.has(formatDate(d)))
    .map(d => ({
      id: uuidv4(),
      itemId: item.id,
      scheduledDate: formatDate(d),
      status: 'pending' as const
    }));
  
  if (newInstances.length > 0) {
    await db.itemInstances.bulkAdd(newInstances);
  }
}

export async function materializeAllRecurringItems() {
  const items = await db.items.filter(i => !!i.rrule).toArray();
  for (const item of items) {
    await materializeInstances(item.id);
  }
}
