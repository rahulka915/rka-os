function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export interface DoseCountDay {
  date: string;
  count: number;
}

export function countDosesByDay(timestamps: number[], days: number, now: number = Date.now()): DoseCountDay[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = dateKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const history: DoseCountDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = dateKey(d);
    history.push({ date, count: counts.get(date) ?? 0 });
  }
  return history;
}

export interface DoseLogEntry {
  id: string;
  timestamp: number;
}

export interface DoseDayGroup {
  date: string;
  label: string;
  count: number;
  logs: DoseLogEntry[];
}

function dayLabel(date: string, now: number): string {
  const today = dateKey(new Date(now));
  const yesterday = dateKey(new Date(now - 24 * 60 * 60 * 1000));
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function groupLogsByDay(logs: DoseLogEntry[], now: number = Date.now()): DoseDayGroup[] {
  const order: string[] = [];
  const byDate = new Map<string, DoseLogEntry[]>();
  for (const log of logs) {
    const date = dateKey(new Date(log.timestamp));
    if (!byDate.has(date)) {
      byDate.set(date, []);
      order.push(date);
    }
    byDate.get(date)!.push(log);
  }
  return order.map((date) => {
    const dayLogs = byDate.get(date)!;
    return { date, label: dayLabel(date, now), count: dayLogs.length, logs: dayLogs };
  });
}
