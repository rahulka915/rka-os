// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStepRemainingSeconds, parseRoutineSessionMeta, parseRoutineStepMeta } from './routineMeta.ts';

test('parseRoutineStepMeta: defaults to no duration, no auto-advance', () => {
  const meta = parseRoutineStepMeta(undefined);
  assert.equal(meta.durationSeconds, undefined);
  assert.equal(meta.autoAdvance, false);
});

test('computeStepRemainingSeconds: null when the step has no duration (manual step)', () => {
  const session = { currentStepIndex: 0, stepStartedAt: 0, elapsedBeforePauseMs: 0, status: 'running' as const };
  assert.equal(computeStepRemainingSeconds(undefined, session, 5000), null);
});

test('computeStepRemainingSeconds: counts down while running', () => {
  const session = { currentStepIndex: 0, stepStartedAt: 0, elapsedBeforePauseMs: 0, status: 'running' as const };
  // 60s step, 20s elapsed -> 40s remaining
  assert.equal(computeStepRemainingSeconds(60, session, 20_000), 40);
});

test('computeStepRemainingSeconds: does not advance further while paused, regardless of wall-clock time', () => {
  const session = { currentStepIndex: 0, stepStartedAt: 1_000_000, elapsedBeforePauseMs: 15_000, status: 'paused' as const };
  // Even far-future "now" shouldn't change the remaining time while paused.
  const remainingSoon = computeStepRemainingSeconds(60, session, 1_000_000);
  const remainingLater = computeStepRemainingSeconds(60, session, 50_000_000);
  assert.equal(remainingSoon, 45);
  assert.equal(remainingLater, 45);
});

test('computeStepRemainingSeconds: correct immediately after a simulated relaunch (no dependency on mount duration)', () => {
  // Simulates: step started at t=0 with a 60s duration, app backgrounded at t=10s,
  // relaunched at t=45s. The remaining time must reflect the full 45s elapsed,
  // not reset to 60s just because the screen just remounted.
  const session = { currentStepIndex: 0, stepStartedAt: 0, elapsedBeforePauseMs: 0, status: 'running' as const };
  assert.equal(computeStepRemainingSeconds(60, session, 45_000), 15);
});

test('computeStepRemainingSeconds: clamps at zero rather than going negative', () => {
  const session = { currentStepIndex: 0, stepStartedAt: 0, elapsedBeforePauseMs: 0, status: 'running' as const };
  assert.equal(computeStepRemainingSeconds(60, session, 90_000), 0);
});

test('computeStepRemainingSeconds: session-local "add time" override extends only this session', () => {
  const session = {
    currentStepIndex: 0,
    stepStartedAt: 0,
    elapsedBeforePauseMs: 0,
    status: 'running' as const,
    stepOverrides: { 0: { extraSeconds: 30 } },
  };
  // 60s base + 30s override = 90s effective, 20s elapsed -> 70s remaining
  assert.equal(computeStepRemainingSeconds(60, session, 20_000), 70);
});

test('parseRoutineSessionMeta: malformed metadata falls back to a fresh running session', () => {
  const meta = parseRoutineSessionMeta('{not json');
  assert.equal(meta.currentStepIndex, 0);
  assert.equal(meta.status, 'running');
});
