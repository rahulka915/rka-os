// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AUTO_STOP_HOURS,
  getActiveElapsedMs,
  getAutoStopState,
  getRunningAutoStopAt,
  resolveAutoStopAfterMs,
} from './timerMath.ts';

test('defaults an unset auto-stop duration to 24 hours', () => {
  assert.equal(DEFAULT_AUTO_STOP_HOURS, 24);
  assert.equal(resolveAutoStopAfterMs(undefined), 24 * 60 * 60 * 1000);
});

test('uses the medication-specific auto-stop duration', () => {
  assert.equal(resolveAutoStopAfterMs(5), 5 * 60 * 60 * 1000);
});

test('falls back for invalid auto-stop durations', () => {
  assert.equal(resolveAutoStopAfterMs(0), 24 * 60 * 60 * 1000);
  assert.equal(resolveAutoStopAfterMs(Number.NaN), 24 * 60 * 60 * 1000);
});

test('running elapsed time includes prior accumulated active time', () => {
  assert.equal(
    getActiveElapsedMs({ timerActive: true, startedAt: 10_000, accumulatedMs: 2_000 }, 15_000),
    7_000
  );
});

test('paused elapsed time remains frozen', () => {
  assert.equal(
    getActiveElapsedMs({ timerActive: false, pausedAt: 15_000, accumulatedMs: 7_000 }, 50_000),
    7_000
  );
});

test('automatic expiration caps completion at the configured duration', () => {
  assert.deepEqual(
    getAutoStopState(
      { timerActive: true, startedAt: 1_000, accumulatedMs: 2_000, autoStopAfterMs: 5_000 },
      8_000
    ),
    { elapsedMs: 9_000, remainingMs: 0, expired: true, completedElapsedMs: 5_000 }
  );
});

test('remaining allowance excludes paused wall-clock time', () => {
  assert.deepEqual(
    getAutoStopState(
      { timerActive: false, pausedAt: 3_000, accumulatedMs: 2_000, autoStopAfterMs: 5_000 },
      100_000
    ),
    { elapsedMs: 2_000, remainingMs: 3_000, expired: false, completedElapsedMs: undefined }
  );
});

test('running cutoff is scheduled from the remaining active allowance', () => {
  assert.equal(
    getRunningAutoStopAt(
      { timerActive: true, startedAt: 10_000, accumulatedMs: 2_000, autoStopAfterMs: 10_000 },
      15_000
    ),
    18_000
  );
});

test('paused timers do not have a scheduled cutoff', () => {
  assert.equal(
    getRunningAutoStopAt(
      { timerActive: false, pausedAt: 15_000, accumulatedMs: 7_000, autoStopAfterMs: 10_000 },
      20_000
    ),
    null
  );
});
