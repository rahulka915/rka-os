// Plan Backwards — pure, testable domain math. Nothing here touches SQLite
// or React; database.ts / usePlanBackwards (useDb.ts) map DB rows into the
// PlanStepCalc/PlanBlockCalc shapes below and call these functions. Keeping
// the calculation logic here (rather than inline in screens) is what makes
// "does this fit before the anchor" independently testable.
import type { PlacementBehavior } from './backwardPlanMeta';

export interface PlanStepCalc {
  id: string;
  estimatedMinutes: number;
  completedAt: number | null;
}

export interface PlanBlockCalc {
  id: string;
  type: 'routine' | 'task' | 'travel';
  title: string;
  placement: PlacementBehavior;
  bufferMinutes: number;
  // Task/travel only — routine blocks derive their duration from `steps`.
  durationMinutes: number | null;
  completedAt: number | null;
  orderIndex: number;
  steps?: PlanStepCalc[];
}

// Minutes from `now` to `goal` — negative once the goal has passed.
export function calculateTimeRemaining(now: Date, goal: Date): number {
  return (goal.getTime() - now.getTime()) / 60000;
}

// Sum of incomplete steps' estimated duration — a completed step contributes
// nothing, so a routine's remaining duration shrinks the moment a step is
// checked off, independent of when in the day that happens.
export function calculateRoutineRemainingDuration(steps: PlanStepCalc[]): number {
  return steps.reduce((sum, step) => sum + (step.completedAt ? 0 : step.estimatedMinutes), 0);
}

// A block's own contribution to Time Required. A buffer only reserves time
// while the block still has outstanding work — once every step (or the
// task/travel itself) is complete, its buffer stops being required too.
export function calculateBlockRequiredDuration(block: PlanBlockCalc): number {
  if (block.type === 'routine') {
    const remaining = calculateRoutineRemainingDuration(block.steps ?? []);
    if (remaining <= 0) return 0;
    return remaining + block.bufferMinutes;
  }
  if (block.completedAt) return 0;
  return (block.durationMinutes ?? 0) + block.bufferMinutes;
}

export function calculatePlanRequiredDuration(blocks: PlanBlockCalc[]): number {
  return blocks.reduce((sum, block) => sum + calculateBlockRequiredDuration(block), 0);
}

export function calculateUnallocatedTime(remainingMinutes: number, requiredMinutes: number): number {
  return remainingMinutes - requiredMinutes;
}

// Leave-by works backwards from an arrival target (normally Goal Time):
// arrivalTarget minus journey minus travel buffer.
export function calculateLeaveBy(arrivalTarget: Date, travelMinutes: number, bufferMinutes: number): Date {
  return new Date(arrivalTarget.getTime() - (travelMinutes + bufferMinutes) * 60000);
}

export interface ScheduledBlock {
  block: PlanBlockCalc;
  start: Date;
  end: Date;
}

// Orders blocks working backwards from the goal: 'keep-near-event' blocks
// (e.g. travel, final get-dressed) sit closest to the anchor, 'auto' blocks
// next, 'anytime-before' blocks (fully flexible — can happen any time earlier
// in the day) pushed furthest back. Within a tier, the caller's own
// orderIndex is preserved. Returns nearest-to-goal-first, matching the UI's
// top-to-bottom "EVENT -> ... -> Now" reading order. Completed blocks still
// occupy a zero-width slot at their cursor position so they render in place
// rather than vanishing from the sequence (spec: completed steps stay
// visible, not deleted).
export function buildBackwardsSchedule(blocks: PlanBlockCalc[], goal: Date): ScheduledBlock[] {
  const tierRank: Record<PlacementBehavior, number> = {
    'keep-near-event': 0,
    auto: 1,
    'anytime-before': 2,
  };
  const sorted = [...blocks].sort((a, b) => {
    const tierDiff = tierRank[a.placement] - tierRank[b.placement];
    if (tierDiff !== 0) return tierDiff;
    return a.orderIndex - b.orderIndex;
  });

  let cursor = goal;
  const scheduled: ScheduledBlock[] = [];
  for (const block of sorted) {
    const duration = calculateBlockRequiredDuration(block);
    const start = new Date(cursor.getTime() - duration * 60000);
    scheduled.push({ block, start, end: cursor });
    cursor = start;
  }
  return scheduled;
}

// Combines a 'YYYY-MM-DD' scheduledDate with an 'HH:MM' time-of-day into a
// local Date — shared by PlanBackwardsDetailScreen and the Home countdown
// widget so "what does Goal Time actually mean as a Date" has one definition.
export function dateTimeFromParts(dateStr: string, time: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

// Structural (not imported) DB-row shape — deliberately duck-typed rather
// than importing PlanBlockWithSteps from db/database.ts, so this module
// stays fully decoupled from SQLite (per the file header above) even though
// the mapping itself is DB-row-shaped.
export interface PlanBlockRowLike {
  id: string;
  type: 'routine' | 'task' | 'travel';
  title: string;
  placement: PlacementBehavior;
  bufferMinutes: number | null;
  durationMinutes: number | null;
  completedAt: number | null;
  orderIndex: number;
  steps: Array<{ id: string; estimatedMinutes: number; completedAt: number | null }>;
}

export function planBlockRowToCalc(row: PlanBlockRowLike): PlanBlockCalc {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    placement: row.placement,
    bufferMinutes: row.bufferMinutes ?? 0,
    durationMinutes: row.durationMinutes,
    completedAt: row.completedAt,
    orderIndex: row.orderIndex,
    steps: row.steps.map((step) => ({ id: step.id, estimatedMinutes: step.estimatedMinutes, completedAt: step.completedAt })),
  };
}

// "6h 23m" / "45m" / "-18m" (deficit — callers format the "X short" copy
// themselves so this stays a pure number formatter).
export function formatDurationMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}
