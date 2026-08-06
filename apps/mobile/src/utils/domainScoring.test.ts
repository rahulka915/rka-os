// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decayedStrength,
  achievementLift,
  domainScore,
  overallPotential,
  MAX_ACHIEVEMENT_LIFT,
  MISSION_CONTRIBUTION_DEFAULTS,
  ACHIEVEMENT_CONTRIBUTION_DEFAULTS,
} from './domainScoring.ts';

const DAY = 1000 * 60 * 60 * 24;

test('decayedStrength: at occurredAt, returns full magnitude', () => {
  const now = 1_000_000;
  assert.equal(decayedStrength({ magnitude: 0.6, halfLifeDays: 60, occurredAt: now }, now), 0.6);
});

test('decayedStrength: after one half-life, magnitude halves', () => {
  const now = 60 * DAY;
  const strength = decayedStrength({ magnitude: 0.6, halfLifeDays: 60, occurredAt: 0 }, now);
  assert.ok(Math.abs(strength - 0.3) < 1e-9);
});

test('decayedStrength: future-dated contribution clamps to full magnitude, not extrapolated', () => {
  const now = 0;
  const strength = decayedStrength({ magnitude: 0.4, halfLifeDays: 14, occurredAt: 10 * DAY }, now);
  assert.equal(strength, 0.4);
});

test('achievementLift: no contributions is zero', () => {
  assert.equal(achievementLift([], 0), 0);
});

test('achievementLift: single fresh Mission-tier contribution', () => {
  const now = 0;
  const lift = achievementLift([{ ...MISSION_CONTRIBUTION_DEFAULTS, occurredAt: now }], now);
  assert.ok(Math.abs(lift - MAX_ACHIEVEMENT_LIFT * 0.25) < 1e-9);
});

test('achievementLift: single fresh Achievement-tier contribution matches the worked example (~21 of 30)', () => {
  const now = 0;
  const lift = achievementLift([{ ...ACHIEVEMENT_CONTRIBUTION_DEFAULTS, occurredAt: now }], now);
  assert.ok(Math.abs(lift - 18) < 1e-9); // 30 * 0.6
});

test('achievementLift: multiple overlapping contributions show diminishing returns, never exceed maxLift', () => {
  const now = 0;
  const single = achievementLift([{ magnitude: 0.7, halfLifeDays: 60, occurredAt: now }], now);
  const double = achievementLift(
    [
      { magnitude: 0.7, halfLifeDays: 60, occurredAt: now },
      { magnitude: 0.7, halfLifeDays: 60, occurredAt: now },
    ],
    now,
  );
  const marginal = double - single;
  assert.ok(marginal > 0, 'second contribution should still add something');
  assert.ok(marginal < single, 'second contribution should add less than the first (diminishing returns)');
  assert.ok(double < MAX_ACHIEVEMENT_LIFT, 'stacked contributions never reach the ceiling');

  // Even five strong overlapping contributions stay capped below MAX_ACHIEVEMENT_LIFT.
  const five = achievementLift(
    Array.from({ length: 5 }, () => ({ magnitude: 0.9, halfLifeDays: 60, occurredAt: now })),
    now,
  );
  assert.ok(five < MAX_ACHIEVEMENT_LIFT);
  assert.ok(five > double);
});

test('achievementLift: fully decayed contribution converges to zero lift', () => {
  const now = 1000 * DAY;
  const lift = achievementLift([{ magnitude: 0.7, halfLifeDays: 60, occurredAt: 0 }], now);
  assert.ok(lift < 0.001);
});

test('domainScore: maintenance plus lift, capped at 100', () => {
  const now = 0;
  const score = domainScore(55, [{ magnitude: 0.7, halfLifeDays: 60, occurredAt: now }], now);
  // lift = 30 * 0.7 = 21 -> 55 + 21 = 76
  assert.ok(Math.abs(score - 76) < 1e-9);
});

test('domainScore: never exceeds 100 even with high maintenance and fresh contributions', () => {
  const now = 0;
  const score = domainScore(95, [{ magnitude: 0.9, halfLifeDays: 60, occurredAt: now }], now);
  assert.equal(score, 100);
});

test('domainScore: with no contributions, equals maintenance', () => {
  assert.equal(domainScore(55, [], 0), 55);
});

test('domainScore: converges back toward maintenance as achievement influence fades', () => {
  const contributions = [{ magnitude: 0.7, halfLifeDays: 45, occurredAt: 0 }];
  const scoreAtZero = domainScore(55, contributions, 0);
  const scoreLater = domainScore(55, contributions, 45 * DAY);
  const scoreMuchLater = domainScore(55, contributions, 400 * DAY);
  assert.ok(scoreAtZero > scoreLater);
  assert.ok(scoreLater > scoreMuchLater);
  assert.ok(Math.abs(scoreMuchLater - 55) < 0.5);
});

test('overallPotential: equal weights average domain scores', () => {
  const result = overallPotential({ a: 80, b: 40 });
  assert.equal(result, 60);
});

test('overallPotential: focus weighting shifts the aggregate toward the heavier domain', () => {
  const equal = overallPotential({ a: 80, b: 40 }, { a: 1, b: 1 });
  const weighted = overallPotential({ a: 80, b: 40 }, { a: 3, b: 1 });
  assert.equal(equal, 60);
  assert.ok(weighted > equal, 'weighting toward the higher-scoring domain raises the aggregate');
});

test('overallPotential: no domains is zero', () => {
  assert.equal(overallPotential({}), 0);
});
