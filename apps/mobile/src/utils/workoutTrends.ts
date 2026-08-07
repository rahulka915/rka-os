// apps/mobile/src/utils/workoutTrends.ts
import type { ActivityLog } from '../db/types';
import { parseSetLogDetails } from './workoutSet.ts';
import type { MuscleGroup } from './exerciseLibrary';

export interface ExerciseProgressionPoint {
  sessionDate: number;
  topWeight: number;
}

// Groups by sessionId (from each log's details, not entityId) and takes the
// max weight logged for that exercise in that session — the spec's chosen
// progression metric (top set weight), not an estimated 1RM formula.
export function computeExerciseProgression(logs: ActivityLog[]): ExerciseProgressionPoint[] {
  const bySession = new Map<string, { date: number; topWeight: number }>();

  for (const log of logs) {
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const existing = bySession.get(set.sessionId);
    if (!existing) {
      bySession.set(set.sessionId, { date: log.timestamp, topWeight: set.weight });
    } else {
      existing.date = Math.min(existing.date, log.timestamp);
      existing.topWeight = Math.max(existing.topWeight, set.weight);
    }
  }

  return [...bySession.values()]
    .sort((a, b) => a.date - b.date)
    .map((s) => ({ sessionDate: s.date, topWeight: s.topWeight }));
}

export interface VolumePeriod {
  periodLabel: string;
  periodStart: number;
  totalVolume: number;
}

function isoWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Monday = 1 ... Sunday = 7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

function isoWeekLabel(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Sums reps * weight per set, bucketed by ISO week (Monday start) or
// calendar month, sorted chronologically.
export function computeVolumeByPeriod(logs: ActivityLog[], period: 'week' | 'month'): VolumePeriod[] {
  const buckets = new Map<string, { start: number; total: number }>();

  for (const log of logs) {
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const date = new Date(log.timestamp);
    let key: string;
    let start: number;

    if (period === 'week') {
      const weekStart = isoWeekStart(date);
      key = isoWeekLabel(weekStart);
      start = weekStart.getTime();
    } else {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      start = monthStart.getTime();
    }

    const existing = buckets.get(key);
    const volume = set.reps * set.weight;
    if (existing) existing.total += volume;
    else buckets.set(key, { start, total: volume });
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].start - b[1].start)
    .map(([label, { start, total }]) => ({ periodLabel: label, periodStart: start, totalVolume: total }));
}

export interface MuscleGroupVolume {
  muscleGroup: MuscleGroup;
  volume: number;
  percent: number;
}

// Sums volume per muscle group across sets, using the caller-supplied
// exerciseId -> muscleGroup lookup (sets for an exercise not in the map are
// skipped — e.g. the exercise was deleted after logging). Sorted descending
// by volume so the highest-volume group renders first.
export function computeMuscleGroupBalance(
  logs: ActivityLog[],
  exerciseMuscleGroupById: Record<string, MuscleGroup>
): MuscleGroupVolume[] {
  const volumeByGroup = new Map<MuscleGroup, number>();
  let total = 0;

  for (const log of logs) {
    const muscleGroup = exerciseMuscleGroupById[log.entityId];
    if (!muscleGroup) continue;
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const volume = set.reps * set.weight;
    volumeByGroup.set(muscleGroup, (volumeByGroup.get(muscleGroup) ?? 0) + volume);
    total += volume;
  }

  return [...volumeByGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([muscleGroup, volume]) => ({ muscleGroup, volume, percent: total > 0 ? (volume / total) * 100 : 0 }));
}

export interface FrequencyDay {
  date: string;
  count: number;
}

function toDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// One entry per calendar day from sinceMs to untilMs inclusive, with the
// count of sessionDates falling on that day (0 for rest days) — the
// GitHub-contributions-style heatmap's data source.
export function computeFrequencyHeatmap(sessionDates: number[], sinceMs: number, untilMs: number): FrequencyDay[] {
  const countByDate = new Map<string, number>();
  for (const ts of sessionDates) {
    const key = toDateKey(ts);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }

  const days: FrequencyDay[] = [];
  const cursor = new Date(sinceMs);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(untilMs);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateKey(cursor.getTime());
    days.push({ date: key, count: countByDate.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
