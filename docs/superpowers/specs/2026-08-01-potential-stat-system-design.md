# Potential Stat System — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

RKA OS has a Ronin 3D companion (mood-driven, `src/domain/ronin/`) but no character-progression concept — a codebase-wide search confirms no existing stats/level/XP/gamification system. A prior spec (`2026-07-07-home-screen-visual-redesign-design.md`) once planned a hardcoded `roninProgress.ts` XP stub; it was never actually built (or was built and later removed), and `apps/mobile/CLAUDE.md` still stale-references a "status/XP card" that doesn't exist in the current `RoninGreetingCard.tsx`. This spec is unrelated to that dead XP concept and doesn't resurrect it.

This spec adds "Potential": four character stats — **Physique, Skin, Oral Hygiene, Vitality** — each driven by whichever habits the user assigns to it, computed from the habit's existing streak (`computeStreak()`, `src/utils/streak.ts`, already self-healing from `activityLogs`, no stored counter). A habit's contribution to its assigned stat scales linearly from its current streak toward a per-habit configurable "target days" (e.g. a 100-day non-stop streak on a habit targeting 100 days = 100% contribution); a stat with multiple assigned habits shows the average of their contributions.

**Explicitly deferred:** the Ronin character does not visually change based on stat levels in this version — this is a numeric/visual stat-sheet feature only. Character appearance evolution is a future, separate project once this mechanic is proven out.

## Data Model

No schema or new tables. Habits already carry a free-form `metadata` JSON blob (today only `{ gtdContext: 'habit' }`, per `SCHEMA.md`). Two new optional fields are added to that blob:

```typescript
interface HabitPotentialMeta {
  potentialStat?: PotentialStat;      // which stat this habit feeds, if any
  potentialTargetDays?: number;       // streak length for 100% contribution; defaults to 100 if potentialStat is set but this is omitted
}
```

New file `src/utils/potential.ts`:

```typescript
export type PotentialStat = 'physique' | 'skin' | 'oralHygiene' | 'vitality';

export const POTENTIAL_STATS: PotentialStat[] = ['physique', 'skin', 'oralHygiene', 'vitality'];

export const POTENTIAL_STAT_LABELS: Record<PotentialStat, string> = {
  physique: 'Physique',
  skin: 'Skin',
  oralHygiene: 'Oral Hygiene',
  vitality: 'Vitality',
};

const DEFAULT_TARGET_DAYS = 100;

export function parseHabitPotentialMeta(metadata?: string): HabitPotentialMeta {
  // parses metadata JSON, validates potentialStat is one of POTENTIAL_STATS,
  // validates potentialTargetDays is a positive number; same defensive
  // parse-and-fall-back-silently pattern as parseExerciseMeta.
}

export interface StatContribution {
  habitId: string;
  habitTitle: string;
  percent: number; // 0-100, min(streak / targetDays, 1) * 100
}

export interface PotentialStatResult {
  stat: PotentialStat;
  percent: number; // 0-100, average of contributions' percent, or 0 if none
  contributions: StatContribution[];
}

export function computePotentialStats(
  habits: Item[],
  today: string,
): Record<PotentialStat, PotentialStatResult> {
  // for each habit: parse potentialStat/potentialTargetDays from metadata;
  // skip habits with no potentialStat assigned.
  // for assigned habits: streak = computeStreak(habit.rrule, getCompletedOccurrenceDates(habit.id), today)
  // contribution percent = min(streak / targetDays, 1) * 100
  // group contributions by stat, average per stat (0 if no contributions)
}
```

This is a pure function over `Item[]` (habits) + already-existing `getCompletedOccurrenceDates`/`computeStreak` — fully unit-testable the same way `streak.test.ts` tests `computeStreak`, no DB mocking required (pass in fixture habits + fixture completed-date sets).

## Habit Config UI

`HabitDetailScreen.tsx` gets a new "Potential" section (below the existing streak/calendar/history sections):

- A 5-way chip row: **Physique / Skin / Oral Hygiene / Vitality / None** — single-select, same visual chip pattern as `ExerciseEditSheet.tsx`'s muscle-group chips (`borderRadius: 16`, selected = accent background). Selecting "None" clears `potentialStat` (and `potentialTargetDays`) from the habit's metadata.
- When a stat other than "None" is selected: a "Target days" numeric input appears (default `100`, placeholder shows the default so an empty field is a valid "use default" state), same field style as `BlockEditSheet`'s numeric inputs.
- Saving writes `updateItemMetadata(habitId, { ...existingMeta, potentialStat, potentialTargetDays })` — reuses the existing `updateItemMetadata` function, no new DB function needed.

## Potential Screen

New screen `PotentialScreen.tsx`, reached via a new entry in `MenuScreen.tsx`'s 3-column icon grid (alongside Habits, Workouts, etc.).

- `LensSurface`-styled, title "Potential".
- Loads all habits (`getItemsByType('habit')`) and runs `computePotentialStats(habits, today)` on focus (`useFocusEffect`, matching `HabitDetailScreen`'s load pattern).
- Renders the 4 stats in fixed order (Physique, Skin, Oral Hygiene, Vitality) as stacked rows, each: stat label, percentage, a horizontal progress bar (reusing the existing `KatanaProgress` component already used in `RoninGreetingCard.tsx` for Home's Today progress), and a subtext line listing the contributing habits by title (e.g. "Workout, Protein") or, if the stat has zero assigned habits, a muted prompt: "No habits linked yet — assign one from a habit's detail page."
- No editing happens on this screen — it's read-only, a pure reflection of what's configured per-habit in `HabitDetailScreen`.

## Out of Scope

- Ronin character visual changes based on stat levels (art/asset production, future project).
- Any decay/grace-period logic beyond what `computeStreak()` already does — a missed scheduled day resets that habit's streak (and therefore its contribution) exactly as it does everywhere else in the app today.
- Radar/spider chart visualization — horizontal bars only for this version.
- Assigning a stat from the generic item editor or from `HabitsScreen`'s list/creation flow — configuration lives solely in `HabitDetailScreen`.
- Non-habit items (tasks, projects) contributing to Potential — habits only.
