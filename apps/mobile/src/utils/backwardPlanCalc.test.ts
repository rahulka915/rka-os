// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTimeRemaining,
  calculateRoutineRemainingDuration,
  calculateBlockRequiredDuration,
  calculatePlanRequiredDuration,
  calculateUnallocatedTime,
  calculateLeaveBy,
  buildBackwardsSchedule,
  formatDurationMinutes,
  dateTimeFromParts,
  planBlockRowToCalc,
  type PlanBlockCalc,
} from './backwardPlanCalc.ts';

// --- calculateTimeRemaining ------------------------------------------------

test('calculateTimeRemaining: Goal Time in the future returns positive minutes', () => {
  const now = new Date(2026, 0, 1, 13, 37);
  const goal = new Date(2026, 0, 1, 20, 0);
  assert.equal(calculateTimeRemaining(now, goal), 383); // 6h23m
});

test('calculateTimeRemaining: Goal Time in the past returns negative minutes', () => {
  const now = new Date(2026, 0, 1, 20, 30);
  const goal = new Date(2026, 0, 1, 20, 0);
  assert.equal(calculateTimeRemaining(now, goal), -30);
});

// --- calculateRoutineRemainingDuration / completed exclusion --------------

test('calculateRoutineRemainingDuration: a completed step contributes nothing', () => {
  const steps = [
    { id: 'shower', estimatedMinutes: 15, completedAt: null },
    { id: 'shave', estimatedMinutes: 5, completedAt: Date.now() },
    { id: 'hair', estimatedMinutes: 10, completedAt: null },
    { id: 'dressed', estimatedMinutes: 15, completedAt: null },
  ];
  assert.equal(calculateRoutineRemainingDuration(steps), 40);
});

test('calculateRoutineRemainingDuration: partially completed routine sums only incomplete steps', () => {
  const steps = [
    { id: 'a', estimatedMinutes: 20, completedAt: Date.now() },
    { id: 'b', estimatedMinutes: 20, completedAt: Date.now() },
    { id: 'c', estimatedMinutes: 20, completedAt: null },
  ];
  assert.equal(calculateRoutineRemainingDuration(steps), 20);
});

test('calculateRoutineRemainingDuration: all steps complete returns 0', () => {
  const steps = [
    { id: 'a', estimatedMinutes: 10, completedAt: Date.now() },
    { id: 'b', estimatedMinutes: 10, completedAt: Date.now() },
  ];
  assert.equal(calculateRoutineRemainingDuration(steps), 0);
});

// --- calculateBlockRequiredDuration: buffers ------------------------------

test('calculateBlockRequiredDuration: routine buffer included while work remains', () => {
  const block: PlanBlockCalc = {
    id: 'get-ready', type: 'routine', title: 'Get Ready', placement: 'auto', bufferMinutes: 5,
    durationMinutes: null, completedAt: null, orderIndex: 0,
    steps: [{ id: 'a', estimatedMinutes: 40, completedAt: null }],
  };
  assert.equal(calculateBlockRequiredDuration(block), 45);
});

test('calculateBlockRequiredDuration: routine buffer drops to 0 once all steps complete', () => {
  const block: PlanBlockCalc = {
    id: 'get-ready', type: 'routine', title: 'Get Ready', placement: 'auto', bufferMinutes: 5,
    durationMinutes: null, completedAt: null, orderIndex: 0,
    steps: [{ id: 'a', estimatedMinutes: 40, completedAt: Date.now() }],
  };
  assert.equal(calculateBlockRequiredDuration(block), 0);
});

test('calculateBlockRequiredDuration: completed standalone task contributes nothing', () => {
  const block: PlanBlockCalc = {
    id: 'wrap', type: 'task', title: 'Wrap present', placement: 'anytime-before', bufferMinutes: 0,
    durationMinutes: 10, completedAt: Date.now(), orderIndex: 0,
  };
  assert.equal(calculateBlockRequiredDuration(block), 0);
});

test('calculateBlockRequiredDuration: travel buffer included when incomplete', () => {
  const block: PlanBlockCalc = {
    id: 'travel', type: 'travel', title: 'Travel', placement: 'keep-near-event', bufferMinutes: 10,
    durationMinutes: 26, completedAt: null, orderIndex: 0,
  };
  assert.equal(calculateBlockRequiredDuration(block), 36);
});

// --- calculatePlanRequiredDuration / calculateUnallocatedTime -------------

test('calculatePlanRequiredDuration: sums required duration across all blocks', () => {
  const blocks: PlanBlockCalc[] = [
    { id: 'travel', type: 'travel', title: 'Travel', placement: 'keep-near-event', bufferMinutes: 10, durationMinutes: 26, completedAt: null, orderIndex: 0 },
    { id: 'get-ready', type: 'routine', title: 'Get Ready', placement: 'auto', bufferMinutes: 0, durationMinutes: null, completedAt: null, orderIndex: 1, steps: [{ id: 'a', estimatedMinutes: 40, completedAt: null }] },
    { id: 'wrap', type: 'task', title: 'Wrap present', placement: 'anytime-before', bufferMinutes: 0, durationMinutes: 10, completedAt: null, orderIndex: 2 },
  ];
  assert.equal(calculatePlanRequiredDuration(blocks), 36 + 40 + 10);
});

test('calculateUnallocatedTime: positive surplus', () => {
  assert.equal(calculateUnallocatedTime(383, 97), 286);
});

test('calculateUnallocatedTime: negative deficit', () => {
  assert.equal(calculateUnallocatedTime(60, 78), -18);
});

// --- calculateLeaveBy ------------------------------------------------------

test('calculateLeaveBy: goal 8:00pm, 26min journey, 10min buffer -> leave 7:24pm', () => {
  const goal = new Date(2026, 0, 1, 20, 0);
  const leaveBy = calculateLeaveBy(goal, 26, 10);
  assert.equal(leaveBy.getHours(), 19);
  assert.equal(leaveBy.getMinutes(), 24);
});

// --- buildBackwardsSchedule: ordering --------------------------------------

test('buildBackwardsSchedule: keep-near-event before auto before anytime-before, nearest-goal-first', () => {
  const goal = new Date(2026, 0, 1, 20, 0);
  const blocks: PlanBlockCalc[] = [
    { id: 'wrap', type: 'task', title: 'Wrap present', placement: 'anytime-before', bufferMinutes: 0, durationMinutes: 10, completedAt: null, orderIndex: 0 },
    { id: 'get-ready', type: 'routine', title: 'Get Ready', placement: 'auto', bufferMinutes: 0, durationMinutes: null, completedAt: null, orderIndex: 0, steps: [{ id: 'a', estimatedMinutes: 40, completedAt: null }] },
    { id: 'travel', type: 'travel', title: 'Travel', placement: 'keep-near-event', bufferMinutes: 10, durationMinutes: 26, completedAt: null, orderIndex: 0 },
  ];
  const schedule = buildBackwardsSchedule(blocks, goal);
  assert.deepEqual(schedule.map((s) => s.block.id), ['travel', 'get-ready', 'wrap']);
  // Travel sits immediately before the goal.
  assert.equal(schedule[0].end.getTime(), goal.getTime());
  // Each block's start feeds the next block's end (contiguous, no gaps).
  assert.equal(schedule[1].end.getTime(), schedule[0].start.getTime());
  assert.equal(schedule[2].end.getTime(), schedule[1].start.getTime());
});

test('buildBackwardsSchedule: a fully-completed block still occupies a zero-width slot in place', () => {
  const goal = new Date(2026, 0, 1, 20, 0);
  const blocks: PlanBlockCalc[] = [
    { id: 'shave', type: 'task', title: 'Shave', placement: 'anytime-before', bufferMinutes: 0, durationMinutes: 5, completedAt: Date.now(), orderIndex: 0 },
  ];
  const schedule = buildBackwardsSchedule(blocks, goal);
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].start.getTime(), schedule[0].end.getTime());
});

// --- formatDurationMinutes --------------------------------------------------

test('formatDurationMinutes: formats hours and minutes', () => {
  assert.equal(formatDurationMinutes(383), '6h 23m');
  assert.equal(formatDurationMinutes(45), '45m');
  assert.equal(formatDurationMinutes(120), '2h');
});

test('formatDurationMinutes: negative deficit gets a leading minus', () => {
  assert.equal(formatDurationMinutes(-18), '-18m');
});

// --- dateTimeFromParts -------------------------------------------------------

test('dateTimeFromParts: combines a YYYY-MM-DD date with an HH:MM time', () => {
  const date = dateTimeFromParts('2026-08-08', '20:00');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 7);
  assert.equal(date.getDate(), 8);
  assert.equal(date.getHours(), 20);
  assert.equal(date.getMinutes(), 0);
});

// --- planBlockRowToCalc -------------------------------------------------------

test('planBlockRowToCalc: maps a DB-row-shaped block into PlanBlockCalc, defaulting null buffer to 0', () => {
  const row = {
    id: 'b1', type: 'task' as const, title: 'Wrap present', placement: 'anytime-before' as const,
    bufferMinutes: null, durationMinutes: 10, completedAt: null, orderIndex: 2, steps: [],
  };
  assert.deepEqual(planBlockRowToCalc(row), {
    id: 'b1', type: 'task', title: 'Wrap present', placement: 'anytime-before',
    bufferMinutes: 0, durationMinutes: 10, completedAt: null, orderIndex: 2, steps: [],
  });
});

test('planBlockRowToCalc: carries routine steps through', () => {
  const row = {
    id: 'b2', type: 'routine' as const, title: 'Get Ready', placement: 'auto' as const,
    bufferMinutes: 5, durationMinutes: null, completedAt: null, orderIndex: 0,
    steps: [{ id: 's1', estimatedMinutes: 15, completedAt: null }],
  };
  assert.deepEqual(planBlockRowToCalc(row).steps, [{ id: 's1', estimatedMinutes: 15, completedAt: null }]);
});
