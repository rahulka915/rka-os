// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExerciseProgression,
  computeVolumeByPeriod,
  computeMuscleGroupBalance,
  computeFrequencyHeatmap,
} from './workoutTrends.ts';

function log(id: string, entityId: string, timestamp: number, details: object) {
  return { id, entityId, actionType: 'workout-set-logged', timestamp, details: JSON.stringify(details), createdAt: timestamp };
}

test('computeExerciseProgression takes the max weight per session, sorted by date', () => {
  const day1 = new Date('2026-01-01').getTime();
  const day2 = new Date('2026-01-08').getTime();
  const logs = [
    log('1', 'ex1', day2, { sessionId: 's2', setNumber: 1, reps: 8, weight: 60 }),
    log('2', 'ex1', day1, { sessionId: 's1', setNumber: 1, reps: 8, weight: 50 }),
    log('3', 'ex1', day1, { sessionId: 's1', setNumber: 2, reps: 6, weight: 55 }),
  ];
  const result = computeExerciseProgression(logs);
  assert.deepEqual(result, [
    { sessionDate: day1, topWeight: 55 },
    { sessionDate: day2, topWeight: 60 },
  ]);
});

test('computeVolumeByPeriod sums reps * weight bucketed by week', () => {
  const jan1 = new Date('2026-01-01').getTime(); // Thursday
  const jan2 = new Date('2026-01-02').getTime(); // same ISO week
  const jan9 = new Date('2026-01-09').getTime(); // next ISO week
  const logs = [
    log('1', 'ex1', jan1, { sessionId: 's1', setNumber: 1, reps: 10, weight: 20 }), // 200
    log('2', 'ex1', jan2, { sessionId: 's1', setNumber: 2, reps: 5, weight: 30 }),  // 150
    log('3', 'ex1', jan9, { sessionId: 's2', setNumber: 1, reps: 10, weight: 10 }), // 100
  ];
  const result = computeVolumeByPeriod(logs, 'week');
  assert.equal(result.length, 2);
  assert.equal(result[0].totalVolume, 350);
  assert.equal(result[1].totalVolume, 100);
});

test('computeVolumeByPeriod buckets by calendar month', () => {
  const jan15 = new Date('2026-01-15').getTime();
  const feb1 = new Date('2026-02-01').getTime();
  const logs = [
    log('1', 'ex1', jan15, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 }), // 100
    log('2', 'ex1', feb1, { sessionId: 's2', setNumber: 1, reps: 10, weight: 10 }),  // 100
  ];
  const result = computeVolumeByPeriod(logs, 'month');
  assert.equal(result.length, 2);
  assert.equal(result[0].periodLabel, '2026-01');
  assert.equal(result[1].periodLabel, '2026-02');
});

test('computeMuscleGroupBalance sums volume per muscle group and sorts descending by volume', () => {
  const t = Date.now();
  const logs = [
    log('1', 'ex-chest', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 }), // 100 chest
    log('2', 'ex-legs', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 30 }),  // 300 legs
    log('3', 'ex-chest', t, { sessionId: 's1', setNumber: 2, reps: 10, weight: 10 }), // +100 chest = 200
  ];
  const result = computeMuscleGroupBalance(logs, {
    'ex-chest': [{ group: 'chest', weight: 1 }],
    'ex-legs': [{ group: 'legs', weight: 1 }],
  });
  assert.deepEqual(result.map((r) => r.muscleGroup), ['legs', 'chest']);
  assert.equal(result[0].volume, 300);
  assert.equal(result[1].volume, 200);
  assert.equal(Math.round(result[0].percent), 60);
  assert.equal(Math.round(result[1].percent), 40);
});

test('computeMuscleGroupBalance skips sets whose exercise has no known muscle-group weights', () => {
  const t = Date.now();
  const logs = [log('1', 'unknown-ex', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 })];
  const result = computeMuscleGroupBalance(logs, {});
  assert.deepEqual(result, []);
});

test('computeMuscleGroupBalance splits a set\'s volume across primary and secondary groups per their weights', () => {
  const t = Date.now();
  // Bench Press: primary chest, secondary arms — 70/30 split. Squat: legs only.
  const logs = [
    log('1', 'bench', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 100 }), // 1000 total volume
    log('2', 'squat', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 100 }),  // 1000 total volume
  ];
  const result = computeMuscleGroupBalance(logs, {
    bench: [{ group: 'chest', weight: 0.7 }, { group: 'arms', weight: 0.3 }],
    squat: [{ group: 'legs', weight: 1 }],
  });
  const byGroup = Object.fromEntries(result.map((r) => [r.muscleGroup, r.volume]));
  assert.equal(byGroup.chest, 700);
  assert.equal(byGroup.arms, 300);
  assert.equal(byGroup.legs, 1000);
  // Total volume across groups still equals the real total (1000 + 1000 = 2000),
  // not double-counted, so percentages still sum to 100%.
  const totalPercent = result.reduce((sum, r) => sum + r.percent, 0);
  assert.ok(Math.abs(totalPercent - 100) < 1e-9);
});

test('computeFrequencyHeatmap returns one entry per day in range with session counts, 0 for rest days', () => {
  const day0 = new Date('2026-01-01T09:00:00').getTime();
  const day0b = new Date('2026-01-01T18:00:00').getTime();
  const day2 = new Date('2026-01-03T09:00:00').getTime();
  const since = new Date('2026-01-01').getTime();
  const until = new Date('2026-01-03').getTime();
  const result = computeFrequencyHeatmap([day0, day0b, day2], since, until);
  assert.equal(result.length, 3);
  assert.equal(result[0].date, '2026-01-01');
  assert.equal(result[0].count, 2);
  assert.equal(result[1].date, '2026-01-02');
  assert.equal(result[1].count, 0);
  assert.equal(result[2].date, '2026-01-03');
  assert.equal(result[2].count, 1);
});
