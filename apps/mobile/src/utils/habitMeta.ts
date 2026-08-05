import type { Item, ActivityLog } from '../db/types';

export type HabitIntent = 'build' | 'quit';
export type HabitMeasurement = 'binary' | 'count' | 'duration';
export type HabitTargetPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
export type HabitContextualAction = 'mark-done' | 'add-one' | 'enter-value';

export interface HabitMeta {
  intent: HabitIntent;
  measurement: HabitMeasurement;
  targetValue: number; // ignored when measurement === 'binary'
  targetUnit?: string; // e.g. 'reps', 'min', 'glasses' — ignored when measurement === 'binary'
  targetPeriod: HabitTargetPeriod;
  customPeriodDays?: number; // only meaningful when targetPeriod === 'custom'
  contextualAction: HabitContextualAction;
  potentialStat?: string;
  potentialTargetDays?: number;
}

const DEFAULT_HABIT_META: HabitMeta = {
  intent: 'build',
  measurement: 'binary',
  targetValue: 1,
  targetPeriod: 'daily',
  contextualAction: 'mark-done',
};

// Every existing habit item (no metadata, or metadata missing these fields)
// resolves to DEFAULT_HABIT_META, which is exactly today's implicit binary
// behavior — this keeps pre-existing habits unaffected by this feature.
export function parseHabitMeta(item: Item): HabitMeta {
  if (!item.metadata) return DEFAULT_HABIT_META;
  try {
    const parsed = JSON.parse(item.metadata);
    return { ...DEFAULT_HABIT_META, ...parsed };
  } catch {
    return DEFAULT_HABIT_META;
  }
}

export interface HabitPeriodProgress {
  current: number;
  target: number;
  unit?: string;
  periodLabel: HabitTargetPeriod;
}

function periodWindow(period: HabitTargetPeriod, customDays: number | undefined, today: Date): { start: number; end: number } {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - start.getDay());
  else if (period === 'monthly') start.setDate(1);
  else if (period === 'custom') start.setDate(start.getDate() - ((customDays ?? 1) - 1));
  return { start: start.getTime(), end: end.getTime() };
}

// Habit samples are 'habit-sample' activityLogs rows keyed by entityId ===
// habit id, with details JSON of shape { value: number, note?: string }.
export function computeHabitPeriodProgress(item: Item, samples: ActivityLog[], today: Date): HabitPeriodProgress {
  const meta = parseHabitMeta(item);
  if (meta.measurement === 'binary') {
    return { current: 0, target: 1, unit: undefined, periodLabel: 'daily' };
  }
  const { start, end } = periodWindow(meta.targetPeriod, meta.customPeriodDays, today);
  const current = samples
    .filter((s) => s.entityId === item.id && s.actionType === 'habit-sample' && s.timestamp >= start && s.timestamp <= end)
    .reduce((sum, s) => {
      try {
        const details = JSON.parse(s.details ?? '{}');
        return sum + (typeof details.value === 'number' ? details.value : 0);
      } catch {
        return sum;
      }
    }, 0);
  return { current, target: meta.targetValue, unit: meta.targetUnit, periodLabel: meta.targetPeriod };
}
