// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSunTimes } from './solarTime.ts';

function assertCloseToTime(actual: Date, expectedIso: string, toleranceMinutes: number) {
  const diffMs = Math.abs(actual.getTime() - new Date(expectedIso).getTime());
  assert.ok(
    diffMs <= toleranceMinutes * 60 * 1000,
    `expected ${actual.toISOString()} to be within ${toleranceMinutes}min of ${expectedIso}`,
  );
}

test('computeSunTimes: London summer solstice matches published sunrise/sunset', () => {
  const { sunrise, sunset } = computeSunTimes(51.5074, -0.1278, new Date('2026-06-21T12:00:00Z'));
  assertCloseToTime(sunrise, '2026-06-21T03:44:00Z', 10);
  assertCloseToTime(sunset, '2026-06-21T20:23:00Z', 10);
});

test('computeSunTimes: London winter solstice matches published sunrise/sunset', () => {
  const { sunrise, sunset } = computeSunTimes(51.5074, -0.1278, new Date('2026-12-21T12:00:00Z'));
  assertCloseToTime(sunrise, '2026-12-21T08:05:00Z', 10);
  assertCloseToTime(sunset, '2026-12-21T15:55:00Z', 10);
});

test('computeSunTimes: sunrise is always before sunset for a given date', () => {
  const { sunrise, sunset } = computeSunTimes(40.7128, -74.0060, new Date('2026-03-20T12:00:00Z'));
  assert.ok(sunrise.getTime() < sunset.getTime());
});
