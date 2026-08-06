// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHabitPotentialMeta, computePotentialStats } from './potential.ts';

function habit(id, rrule, metadata) {
  return { id, type: 'habit', title: id, status: 'active', rrule, metadata: metadata ? JSON.stringify(metadata) : undefined, createdAt: 0, updatedAt: 0 };
}

const PHYSIQUE = 'stat-physique';
const SKIN = 'stat-skin';
const STATS = [{ id: PHYSIQUE, title: 'Physique' }, { id: SKIN, title: 'Skin' }];

test('parseHabitPotentialMeta falls back to no assignment on missing/malformed metadata', () => {
  assert.deepEqual(parseHabitPotentialMeta(undefined), {});
  assert.deepEqual(parseHabitPotentialMeta('not json'), {});
  assert.deepEqual(parseHabitPotentialMeta('{}'), {});
});

test('parseHabitPotentialMeta reads a valid assignment (any stat item id) and defaults target days', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: PHYSIQUE })),
    { potentialStat: PHYSIQUE, potentialTargetDays: 100 },
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: SKIN, potentialTargetDays: 60 })),
    { potentialStat: SKIN, potentialTargetDays: 60 },
  );
});

test('parseHabitPotentialMeta drops a non-string/empty stat id and ignores unrelated fields', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: '', gtdContext: 'habit' })),
    {},
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: SKIN, potentialTargetDays: 'not-a-number' })),
    { potentialStat: SKIN, potentialTargetDays: 100 },
  );
});

test('computePotentialStats: single habit, linear scaling, capped at 100%', () => {
  const habits = [habit('h1', 'DAILY', { potentialStat: PHYSIQUE, potentialTargetDays: 100 })];
  const dates = { h1: new Set(['2026-08-01']) };
  const result = computePotentialStats(habits, STATS, dates, '2026-08-01');
  assert.equal(result[PHYSIQUE].percent, 1);
  assert.deepEqual(result[PHYSIQUE].contributions.map((c) => c.habitId), ['h1']);
  assert.equal(result[SKIN].percent, 0);
  assert.deepEqual(result[SKIN].contributions, []);
});

test('computePotentialStats: streak beyond target caps contribution at 100%', () => {
  const today = '2026-08-01';
  const dates = new Set();
  for (let i = 0; i < 150; i++) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const habits = [habit('h1', 'DAILY', { potentialStat: PHYSIQUE, potentialTargetDays: 100 })];
  const result = computePotentialStats(habits, STATS, { h1: dates }, today);
  assert.equal(result[PHYSIQUE].percent, 100);
});

test('computePotentialStats: two habits feeding one stat average their contributions', () => {
  const habits = [
    habit('h1', 'DAILY', { potentialStat: PHYSIQUE, potentialTargetDays: 100 }),
    habit('h2', 'DAILY', { potentialStat: PHYSIQUE, potentialTargetDays: 50 }),
  ];
  const today = '2026-08-01';
  function streakDates(days) {
    const s = new Set();
    for (let i = 0; i < days; i++) {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() - i);
      s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return s;
  }
  const dates = { h1: streakDates(50), h2: streakDates(50) };
  const result = computePotentialStats(habits, STATS, dates, today);
  assert.equal(result[PHYSIQUE].percent, 75);
  assert.equal(result[PHYSIQUE].contributions.length, 2);
});

test('computePotentialStats: habit with no potentialStat assigned contributes to nothing', () => {
  const habits = [habit('h1', 'DAILY', { gtdContext: 'habit' })];
  const result = computePotentialStats(habits, STATS, { h1: new Set(['2026-08-01']) }, '2026-08-01');
  for (const stat of STATS) {
    assert.equal(result[stat.id].percent, 0);
    assert.deepEqual(result[stat.id].contributions, []);
  }
});

test('computePotentialStats: habit assigned to a stat id not in the provided stats list contributes to nothing', () => {
  const habits = [habit('h1', 'DAILY', { potentialStat: 'some-other-stat-id' })];
  const result = computePotentialStats(habits, STATS, { h1: new Set(['2026-08-01']) }, '2026-08-01');
  assert.equal(result[PHYSIQUE].percent, 0);
  assert.equal(result[SKIN].percent, 0);
});

test('computePotentialStats: empty stats list returns an empty result', () => {
  const habits = [habit('h1', 'DAILY', { potentialStat: PHYSIQUE })];
  const result = computePotentialStats(habits, [], { h1: new Set(['2026-08-01']) }, '2026-08-01');
  assert.deepEqual(result, {});
});
