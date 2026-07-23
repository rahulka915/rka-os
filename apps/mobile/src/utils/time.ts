export type TimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

export function normalizeTimeInput(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatHourLabel(hour: number): string {
  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00`;
}

export function formatTimeLabel(minutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function snapMinutesToStep(minutes: number, step = 15): number {
  const safeStep = Math.max(1, Math.floor(step));
  const snapped = Math.round(minutes / safeStep) * safeStep;
  return Math.max(0, Math.min(23 * 60 + 59, snapped));
}

export function timeToMinutes(value: string | null | undefined): number | null {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return null;

  const [hourStr, minuteStr] = normalized.split(':');
  return Number(hourStr) * 60 + Number(minuteStr);
}

export function getTimeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'anytime';
}

export function timeOfDayLabel(timeOfDay: TimeOfDay | undefined): string {
  if (!timeOfDay || timeOfDay === 'anytime') return 'Anytime';
  if (timeOfDay === 'morning') return 'Morning';
  if (timeOfDay === 'afternoon') return 'Afternoon';
  return 'Evening';
}

// Which Home "Today" block a task belongs to. The user's explicitly-chosen
// bucket (metadata.preferredTimeBucket) wins; otherwise fall back to the
// block derived from its scheduled clock time (metadata.timeOfDay, only set
// for timed tasks); otherwise Anytime. Shared by the Home data hook and
// completeAllInTimeBlock so display and bulk-actions always agree.
export function resolveTimeBucket(meta: Record<string, unknown>): TimeOfDay {
  const pref = meta.preferredTimeBucket;
  if (pref === 'morning' || pref === 'afternoon' || pref === 'evening') return pref;
  const tod = meta.timeOfDay;
  if (tod === 'morning' || tod === 'afternoon' || tod === 'evening') return tod;
  return 'anytime';
}
