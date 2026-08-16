// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSkyBlend, TIME_OF_DAY_BUCKETS } from './skyTimeOfDay.ts';

// Fixed reference day: sunrise 06:00 UTC, sunset 18:00 UTC (solar noon 12:00,
// a clean 12-hour day makes the bucket boundaries easy to reason about).
const SUN_TIMES = {
  sunrise: new Date('2026-06-01T06:00:00Z'),
  sunset: new Date('2026-06-01T18:00:00Z'),
};

test('TIME_OF_DAY_BUCKETS lists all 5 buckets in cycle order', () => {
  assert.deepEqual(TIME_OF_DAY_BUCKETS, ['dawn', 'morning', 'midday', 'dusk', 'night']);
});

test('getSkyBlend: exact sunrise sits at the center of dawn', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, SUN_TIMES.sunrise);
  assert.ok([bucketA, bucketB].includes('dawn'));
});

test('getSkyBlend: exact solar noon sits at the center of midday', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date('2026-06-01T12:00:00Z'));
  assert.ok([bucketA, bucketB].includes('midday'));
});

test('getSkyBlend: exact sunset sits at the center of dusk', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, SUN_TIMES.sunset);
  assert.ok([bucketA, bucketB].includes('dusk'));
});

test('getSkyBlend: deep night (midnight) sits at the center of night', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date('2026-06-01T00:00:00Z'));
  assert.ok([bucketA, bucketB].includes('night'));
});

test('getSkyBlend: blend is always between 0 and 1 inclusive', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const { blend } = getSkyBlend(SUN_TIMES, new Date(`2026-06-01T${String(hour).padStart(2, '0')}:00:00Z`));
    assert.ok(blend >= 0 && blend <= 1, `hour ${hour}: blend was ${blend}`);
  }
});

test('getSkyBlend: bucketA and bucketB are always adjacent in the cycle', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date(`2026-06-01T${String(hour).padStart(2, '0')}:00:00Z`));
    const indexA = TIME_OF_DAY_BUCKETS.indexOf(bucketA);
    const indexB = TIME_OF_DAY_BUCKETS.indexOf(bucketB);
    const expectedB = (indexA + 1) % TIME_OF_DAY_BUCKETS.length;
    assert.equal(indexB, expectedB, `hour ${hour}: bucketA=${bucketA} bucketB=${bucketB}`);
  }
});
