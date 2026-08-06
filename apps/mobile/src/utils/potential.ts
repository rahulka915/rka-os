import { computeStreak } from './streak.ts';
import type { Item } from '../db/types';

// A Potential Stat is a DB-backed 'potential-stat' item (see src/db/database.ts
// getPotentialStats/getPotentialStatsForArea) — its id is what habits assign
// to via metadata.potentialStat. There is no fixed enum any more; the four
// original stats (Physique/Skin/Oral Hygiene/Vitality) are seeded as regular
// items on first launch (see migratePotentialStats in database.ts).
export interface PotentialStatItem {
  id: string;
  title: string;
}

const DEFAULT_TARGET_DAYS = 100;

export interface HabitPotentialMeta {
  potentialStat?: string; // potential-stat item id
  potentialTargetDays?: number;
}

export function parseHabitPotentialMeta(metadata?: string): HabitPotentialMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    if (typeof parsed.potentialStat !== 'string' || !parsed.potentialStat) return {};
    const meta: HabitPotentialMeta = { potentialStat: parsed.potentialStat };
    meta.potentialTargetDays =
      typeof parsed.potentialTargetDays === 'number' && parsed.potentialTargetDays > 0
        ? parsed.potentialTargetDays
        : DEFAULT_TARGET_DAYS;
    return meta;
  } catch {
    return {};
  }
}

export interface StatContribution {
  habitId: string;
  habitTitle: string;
  percent: number;
}

export interface PotentialStatResult {
  stat: string; // potential-stat item id
  percent: number;
  contributions: StatContribution[];
}

// Per stat (keyed by potential-stat item id): average, across every habit
// assigned to it, of min(currentStreak / targetDays, 1) * 100. This is the
// Domain's "maintenance" signal — see computeDomainMaintenance in database.ts,
// which averages these percents across a Domain's linked stats.
export function computePotentialStats(
  habits: Item[],
  stats: PotentialStatItem[],
  completedDatesByHabitId: Record<string, Set<string>>,
  today: string,
): Record<string, PotentialStatResult> {
  const contributionsByStat: Record<string, StatContribution[]> = {};
  for (const stat of stats) contributionsByStat[stat.id] = [];

  for (const habit of habits) {
    const meta = parseHabitPotentialMeta(habit.metadata);
    if (!meta.potentialStat || !(meta.potentialStat in contributionsByStat)) continue;
    const completedDates = completedDatesByHabitId[habit.id] ?? new Set<string>();
    const streak = computeStreak(habit.rrule, completedDates, today);
    const targetDays = meta.potentialTargetDays ?? DEFAULT_TARGET_DAYS;
    const percent = Math.min(streak / targetDays, 1) * 100;
    contributionsByStat[meta.potentialStat].push({ habitId: habit.id, habitTitle: habit.title, percent });
  }

  const result: Record<string, PotentialStatResult> = {};
  for (const stat of stats) {
    const contributions = contributionsByStat[stat.id];
    const percent = contributions.length === 0
      ? 0
      : contributions.reduce((sum, c) => sum + c.percent, 0) / contributions.length;
    result[stat.id] = { stat: stat.id, percent, contributions };
  }
  return result;
}
