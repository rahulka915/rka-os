import { getCompletedOccurrenceDates } from '../db/database';
import { parseRepeatRule, dayMatchesRepeat } from './repeat';
import { computeStreak } from './streak';
import type { Item } from '../db/types';

export interface HabitRowData {
  item: Item;
  streak: number;
  isScheduledToday: boolean;
  isCompletedToday: boolean;
}

export function buildHabitRowData(item: Item, today: string): HabitRowData {
  const rule = parseRepeatRule(item.rrule);
  const completedDates = getCompletedOccurrenceDates(item.id);
  return {
    item,
    streak: computeStreak(item.rrule, completedDates, today),
    isScheduledToday: rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false,
    isCompletedToday: completedDates.has(today),
  };
}
