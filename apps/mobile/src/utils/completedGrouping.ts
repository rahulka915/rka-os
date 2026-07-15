const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayLabel(timestamp: number, todayStart: number): string {
  const itemStart = startOfDay(new Date(timestamp));
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((todayStart - itemStart) / dayMs);

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';

  const date = new Date(timestamp);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export interface CompletedGroup<T> {
  label: string;
  items: T[];
}

export function groupCompletedByDay<T extends { completedAt?: number; updatedAt: number }>(
  items: T[],
  now: Date = new Date(),
): CompletedGroup<T>[] {
  if (items.length === 0) return [];

  const todayStart = startOfDay(now);
  const groups: CompletedGroup<T>[] = [];

  for (const item of items) {
    const timestamp = item.completedAt ?? item.updatedAt;
    const label = dayLabel(timestamp, todayStart);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}
