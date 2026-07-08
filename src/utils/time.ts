export type TimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

const TIME_OF_DAY_BY_HOUR: Record<Exclude<TimeOfDay, 'anytime'>, TimeOfDay> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

const APPROXIMATE_TIME_OF_DAY_MINUTES: Record<TimeOfDay, number> = {
  anytime: 12 * 60,
  morning: 9 * 60,
  afternoon: 14 * 60,
  evening: 19 * 60,
};

export function normalizeTimeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTimeToMinutes(value: unknown): number | null {
  const normalized = normalizeTimeString(value);
  if (!normalized) return null;

  const [hourStr, minuteStr] = normalized.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return hour * 60 + minute;
}

export function formatMinutesToTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatHourLabel(hour: number): string {
  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00`;
}

export function getTimeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return TIME_OF_DAY_BY_HOUR.morning;
  if (hour >= 12 && hour < 17) return TIME_OF_DAY_BY_HOUR.afternoon;
  return TIME_OF_DAY_BY_HOUR.evening;
}

export function getTimeOfDayFromTime(value: unknown): TimeOfDay {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return 'anytime';
  return getTimeOfDayFromHour(Math.floor(minutes / 60));
}

export function getTimeOfDayLabel(value: unknown): string | null {
  const time = normalizeTimeString(value);
  if (time) return time;

  if (value === 'anytime' || value === 'morning' || value === 'afternoon' || value === 'evening') {
    return String(value);
  }

  return null;
}

export function getApproximateMinutesForTimeOfDay(value: unknown): number | null {
  if (value === 'anytime' || value === 'morning' || value === 'afternoon' || value === 'evening') {
    return APPROXIMATE_TIME_OF_DAY_MINUTES[value];
  }

  return null;
}

type TimeLikeRecord = {
  metadata?: Record<string, unknown> | null;
  instanceMetadata?: Record<string, unknown> | null;
  completedAt?: number;
  status?: string;
};

export function extractTimelineMinutes(record: TimeLikeRecord | null | undefined): number | null {
  if (!record) return null;

  const candidates = [
    record.instanceMetadata?.time,
    record.metadata?.time,
  ];

  for (const candidate of candidates) {
    const minutes = parseTimeToMinutes(candidate);
    if (minutes != null) return minutes;
  }

  const fallbackTimeOfDay = getApproximateMinutesForTimeOfDay(record.instanceMetadata?.timeOfDay ?? record.metadata?.timeOfDay);
  if (fallbackTimeOfDay != null) return fallbackTimeOfDay;

  if (record.status === 'completed' && typeof record.completedAt === 'number') {
    const completed = new Date(record.completedAt);
    return completed.getHours() * 60 + completed.getMinutes();
  }

  return null;
}

export function formatTimelineMinuteLabel(record: TimeLikeRecord | null | undefined): string | null {
  const minutes = extractTimelineMinutes(record);
  if (minutes == null) return null;
  return formatMinutesToTime(minutes);
}
