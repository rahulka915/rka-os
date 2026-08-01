// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHabitPotentialMeta, computePotentialStats, POTENTIAL_STATS, POTENTIAL_STAT_LABELS } from './potential.ts';

function habit(id, rrule, metadata) {
  return { id, type: 'habit', title: id, status: 'active', rrule, metadata: metadata ? JSON.stringify(metadata) : undefined, createdAt: 0, updatedAt: 0 };
}

test('POTENTIAL_STATS lists the four fixed stats in order', () => {
  assert.deepEqual(POTENTIAL_STATS, ['physique', 'skin', 'oralHygiene', 'vitality']);
  assert.equal(POTENTIAL_STAT_LABELS.physique, 'Physique');
  assert.equal(POTENTIAL_STAT_LABELS.skin, 'Skin');
  assert.equal(POTENTIAL_STAT_LABELS.oralHygiene, 'Oral Hygiene');
  assert.equal(POTENTIAL_STAT_LABELS.vitality, 'Vitality');
});

test('parseHabitPotentialMeta falls back to no assignment on missing/malformed metadata', () => {
  assert.deepEqual(parseHabitPotentialMeta(undefined), {});
  assert.deepEqual(parseHabitPotentialMeta('not json'), {});
  assert.deepEqual(parseHabitPotentialMeta('{}'), {});
});

test('parseHabitPotentialMeta reads a valid assignment and defaults target days', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'physique' })),
    { potentialStat: 'physique', potentialTargetDays: 100 },
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'skin', potentialTargetDays: 60 })),
    { potentialStat: 'skin', potentialTargetDays: 60 },
  );
});

test('parseHabitPotentialMeta drops an invalid stat name and preserves gtdContext-style unrelated fields being ignored', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'not-a-stat', gtdContext: 'habit' })),
    {},
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'vitality', potentialTargetDays: 'not-a-number' })),
    { potentialStat: 'vitality', potentialTargetDays: 100 },
  );
});

test('computePotentialStats: single habit, linear scaling, capped at 100%', () => {
  const habits = [habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 })];
  const dates = { h1: new Set(['2026-08-01']) }; // 1-day streak ending today (rrule DAILY matches every day)
  const result = computePotentialStats(habits, dates, '2026-08-01');
  assert.equal(result.physique.percent, 1); // 1/100 * 100 = 1
  assert.deepEqual(result.physique.contributions.map((c) => c.habitId), ['h1']);
  assert.equal(result.skin.percent, 0);
  assert.deepEqual(result.skin.contributions, []);
});

test('computePotentialStats: streak beyond target caps contribution at 100%', () => {
  const today = '2026-08-01';
  const dates = new Set();
  for (let i = 0; i < 150; i++) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const habits = [habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 })];
  const result = computePotentialStats(habits, { h1: dates }, today);
  assert.equal(result.physique.percent, 100);
});

test('computePotentialStats: two habits feeding one stat average their contributions', () => {
  const habits = [
    habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 }),
    habit('h2', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 50 }),
  ];
  // h1: 50-day streak -> 50%. h2: 50-day streak -> 100% (capped). Average = 75%.
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
  const result = computePotentialStats(habits, dates, today);
  assert.equal(result.physique.percent, 75);
  assert.equal(result.physique.contributions.length, 2);
});

test('computePotentialStats: habit with no potentialStat assigned contributes to nothing', () => {
  const habits = [habit('h1', 'DAILY', { gtdContext: 'habit' })];
  const result = computePotentialStats(habits, { h1: new Set(['2026-08-01']) }, '2026-08-01');
  for (const stat of POTENTIAL_STATS) {
    assert.equal(result[stat].percent, 0);
    assert.deepEqual(result[stat].contributions, []);
  }
});
