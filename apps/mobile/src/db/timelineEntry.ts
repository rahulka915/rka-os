// Value import carries the .ts extension so Node's test runner can resolve it
// directly; the type-only imports below are erased before it ever runs.
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes } from '../utils/time.ts';
import type { TimeOfDay } from '../utils/time';
import type { Item, ItemInstance } from './types';

export interface TimelineEntry {
  item: Item;
  instance?: ItemInstance;
  time: string | null;
  minutes: number | null;
  timeOfDay: TimeOfDay;
  preferredTimeBucket: TimeOfDay;
  durationMinutes: number;
}

function parseJson<T extends Record<string, any>>(value?: string | null): T {
  if (!value) return {} as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

// Instance values win over item values, then a clock time, then 'anytime'.
function getEntryTiming(item: Item, instance?: ItemInstance) {
  const itemMeta = parseJson<Record<string, any>>(item.metadata);
  const instanceMeta = parseJson<Record<string, any>>(instance?.instanceMetadata);
  const time = normalizeTimeInput(instanceMeta.time ?? itemMeta.time);
  const minutes = timeToMinutes(time);
  const derivedHour = minutes != null ? Math.floor(minutes / 60) : null;
  const timeOfDay = (instanceMeta.timeOfDay ?? itemMeta.timeOfDay ?? (derivedHour != null ? getTimeOfDayFromHour(derivedHour) : 'anytime')) as TimeOfDay;
  const preferredTimeBucket = (instanceMeta.preferredTimeBucket ?? itemMeta.preferredTimeBucket ?? timeOfDay) as TimeOfDay;
  const rawDuration = instanceMeta.durationMinutes ?? itemMeta.durationMinutes;
  const durationMinutes = typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.max(5, Math.min(24 * 60, Math.round(rawDuration)))
    : 45;

  return { time, minutes, timeOfDay, preferredTimeBucket, durationMinutes };
}

// Pure: both the SQLite and Firestore data layers hand it the day's rows and
// get back the same ordered timeline, so the fallback rules above can't drift
// between platforms.
export function buildTimelineEntries(items: Item[], instances: ItemInstance[]): TimelineEntry[] {
  const instanceByItemId = new Map(instances.map((instance) => [instance.itemId, instance] as const));
  const usedInstanceIds = new Set<string>();

  const entries: TimelineEntry[] = items.map((item) => {
    const instance = instanceByItemId.get(item.id);
    if (instance) usedInstanceIds.add(instance.id);
    return { item, instance, ...getEntryTiming(item, instance) };
  });

  for (const instance of instances) {
    if (usedInstanceIds.has(instance.id)) continue;
    const item = items.find((candidate) => candidate.id === instance.itemId);
    if (!item) continue;
    entries.push({ item, instance, ...getEntryTiming(item, instance) });
  }

  return entries.sort((a, b) => {
    const timeA = a.minutes ?? Number.POSITIVE_INFINITY;
    const timeB = b.minutes ?? Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    return a.item.createdAt - b.item.createdAt;
  });
}
