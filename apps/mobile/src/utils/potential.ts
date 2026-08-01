import { computeStreak } from './streak.ts';
import type { Item } from '../db/types';

export type PotentialStat = 'physique' | 'skin' | 'oralHygiene' | 'vitality';

export const POTENTIAL_STATS: PotentialStat[] = ['physique', 'skin', 'oralHygiene', 'vitality'];

export const POTENTIAL_STAT_LABELS: Record<PotentialStat, string> = {
  physique: 'Physique',
  skin: 'Skin',
  oralHygiene: 'Oral Hygiene',
  vitality: 'Vitality',
};

const DEFAULT_TARGET_DAYS = 100;

export interface HabitPotentialMeta {
  potentialStat?: PotentialStat;
  potentialTargetDays?: number;
}

export function parseHabitPotentialMeta(metadata?: string): HabitPotentialMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    if (!POTENTIAL_STATS.includes(parsed.potentialStat)) return {};
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
  stat: PotentialStat;
  percent: number;
  contributions: StatContribution[];
}

export function computePotentialStats(
  habits: Item[],
  completedDatesByHabitId: Record<string, Set<string>>,
  today: string,
): Record<PotentialStat, PotentialStatResult> {
  const contributionsByStat: Record<PotentialStat, StatContribution[]> = {
    physique: [],
    skin: [],
    oralHygiene: [],
    vitality: [],
  };

  for (const habit of habits) {
    const meta = parseHabitPotentialMeta(habit.metadata);
    if (!meta.potentialStat) continue;
    const completedDates = completedDatesByHabitId[habit.id] ?? new Set<string>();
    const streak = computeStreak(habit.rrule, completedDates, today);
    const targetDays = meta.potentialTargetDays ?? DEFAULT_TARGET_DAYS;
    const percent = Math.min(streak / targetDays, 1) * 100;
    contributionsByStat[meta.potentialStat].push({ habitId: habit.id, habitTitle: habit.title, percent });
  }

  const result = {} as Record<PotentialStat, PotentialStatResult>;
  for (const stat of POTENTIAL_STATS) {
    const contributions = contributionsByStat[stat];
    const percent = contributions.length === 0
      ? 0
      : contributions.reduce((sum, c) => sum + c.percent, 0) / contributions.length;
    result[stat] = { stat, percent, contributions };
  }
  return result;
}
