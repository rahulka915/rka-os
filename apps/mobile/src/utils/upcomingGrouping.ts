import type { Item } from '../db/types';
import { daysBetween } from './deadline.ts';

export interface UpcomingGroup {
  date: string;
  label: string;
  items: Item[];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function labelFor(date: string, today: string): string {
  if (daysBetween(today, date) === 1) return 'TOMORROW';
  const parsed = new Date(`${date}T00:00:00`);
  const [, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS[parsed.getDay()]} ${day} ${MONTHS[month - 1]}`;
}

// Buckets scheduled items into ascending day sections for the Upcoming list.
export function groupByScheduledDate(items: Item[], today: string): UpcomingGroup[] {
  const byDate = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const bucket = byDate.get(item.scheduledDate);
    if (bucket) bucket.push(item);
    else byDate.set(item.scheduledDate, [item]);
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => ({ date, label: labelFor(date, today), items: byDate.get(date)! }));
}
