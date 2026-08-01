// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from './streak.ts';

test('counts consecutive completed days including today', () => {
  const completed = new Set(['2026-07-23', '2026-07-24', '2026-07-25']);
  assert.equal(computeStreak('FREQ=DAILY', completed, '2026-07-25'), 3);
});

test('an as-yet-uncompleted today does not zero out an active streak', () => {
  const completed = new Set(['2026-07-24']);
  assert.equal(computeStreak('FREQ=DAILY', completed, '2026-07-25'), 1);
});

test('a missed day stops the streak', () => {
  const completed = new Set(['2026-07-23', '2026-07-25']);
  assert.equal(computeStreak('FREQ=DAILY', completed, '2026-07-25'), 1);
});

test('a weekdays streak survives across a weekend', () => {
  // 2026-07-24 is Friday, 2026-07-27 is Monday.
  const completed = new Set(['2026-07-24', '2026-07-27']);
  assert.equal(computeStreak('FREQ=WEEKDAYS', completed, '2026-07-27'), 2);
});

test('returns 0 with no usable rule', () => {
  const completed = new Set(['2026-07-25']);
  assert.equal(computeStreak(null, completed, '2026-07-25'), 0);
  assert.equal(computeStreak('nonsense', completed, '2026-07-25'), 0);
});

test('returns 0 with no completions', () => {
  assert.equal(computeStreak('FREQ=DAILY', new Set(), '2026-07-25'), 0);
});
