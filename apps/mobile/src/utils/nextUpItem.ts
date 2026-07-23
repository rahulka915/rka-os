import type { Item } from '../db/types';

export type NextUpActionLabel = 'Start' | 'Resume' | 'Take' | 'View' | 'Continue';

export interface NextUpResult {
  id: string;
  title: string;
  type: Item['type'];
  timeOfDayLabel: string;
  actionLabel: NextUpActionLabel;
}

type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'anytime';

const BUCKET_LABELS: Record<TimeBucket, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

function metadataOf(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function bucketOf(item: Item): TimeBucket {
  const meta = metadataOf(item);
  if (meta.timeOfDay === 'morning' || meta.timeOfDay === 'afternoon' || meta.timeOfDay === 'evening') {
    return meta.timeOfDay;
  }
  return 'anytime';
}

function bucketOrderFromHour(hour: number): TimeBucket[] {
  if (hour < 12) return ['morning', 'afternoon', 'evening', 'anytime'];
  if (hour < 17) return ['afternoon', 'evening', 'morning', 'anytime'];
  return ['evening', 'morning', 'afternoon', 'anytime'];
}

function actionLabelFor(item: Item, activeTimerItemIds: string[]): NextUpActionLabel {
  if (item.type === 'medication') {
    return activeTimerItemIds.includes(item.id) ? 'Resume' : 'Take';
  }
  if (item.type === 'workout-template') {
    return 'Start';
  }
  if (item.type === 'task' || item.type === 'habit') {
    return 'Start';
  }
  return 'View';
}

function displayTimeFor(item: Item, bucket: TimeBucket): string {
  const metadata = metadataOf(item);
  if (typeof metadata.time === 'string' && /^\d{1,2}:\d{2}$/.test(metadata.time)) {
    return metadata.time;
  }
  return BUCKET_LABELS[bucket];
}

const PENDING_STATUSES: Item['status'][] = ['active', 'scheduled', 'due-today', 'overdue', 'inbox'];

export function findNextUpItem(
  todayItems: Item[],
  activeTimerItemIds: string[],
  hour: number = new Date().getHours()
): NextUpResult | null {
  const pending = todayItems.filter((item) => PENDING_STATUSES.includes(item.status));
  if (pending.length === 0) return null;

  const byBucket = new Map<TimeBucket, Item[]>();
  for (const item of pending) {
    const bucket = bucketOf(item);
    const list = byBucket.get(bucket) ?? [];
    list.push(item);
    byBucket.set(bucket, list);
  }

  for (const bucket of bucketOrderFromHour(hour)) {
    const list = byBucket.get(bucket);
    if (list && list.length > 0) {
      const item = list[0];
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        timeOfDayLabel: displayTimeFor(item, bucket),
        actionLabel: actionLabelFor(item, activeTimerItemIds),
      };
    }
  }

  return null;
}
