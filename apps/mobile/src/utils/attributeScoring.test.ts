// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ATTRIBUTE_SCORING_CONFIG,
  weeklyCredit,
  weekStartMs,
  bucketEvidenceByWeek,
  computeAttributeValue,
} from './attributeScoring.ts';

const CFG = DEFAULT_ATTRIBUTE_SCORING_CONFIG;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function evidenceRow(attributeId, weight, occurredAt, sourceType = 'habit', sourceId = 's1', fraction) {
  return { attributeId, sourceType, sourceId, weight, occurredAt, ...(fraction !== undefined ? { fraction } : {}) };
}

// A fixed, known Monday 00:00 UTC to build deterministic weekly timelines from.
const WEEK0 = weekStartMs(Date.UTC(2026, 0, 5)); // 2026-01-05 is a Monday

function weeksOfIdealEvidence(n, weekStart = WEEK0) {
  const rows = [];
  for (let w = 0; w < n; w++) {
    const day = weekStart + w * WEEK_MS + 3 * 24 * 60 * 60 * 1000; // mid-week timestamp
    rows.push(evidenceRow('strength', 'moderate', day));
    rows.push(evidenceRow('strength', 'moderate', day));
    rows.push(evidenceRow('strength', 'moderate', day)); // 3 moderate = ideal (6 units)
  }
  return rows;
}

test('weeklyCredit: 0 units is 0, target units is exactly 100, capped above target', () => {
  assert.equal(weeklyCredit(0, CFG), 0);
  assert.equal(weeklyCredit(CFG.weeklyTargetUnits, CFG), 100);
  assert.equal(weeklyCredit(CFG.weeklyTargetUnits * 2, CFG), 100);
  assert.equal(weeklyCredit(CFG.weeklyTargetUnits * 10, CFG), 100);
});

test('weeklyCredit: below-target credit is partial and monotonically increasing', () => {
  const c1 = weeklyCredit(1, CFG);
  const c2 = weeklyCredit(2, CFG);
  const c5 = weeklyCredit(5, CFG);
  assert.ok(c1 > 0 && c1 < 100, 'partial evidence gets nonzero, non-full credit');
  assert.ok(c1 < c2 && c2 < c5, 'more evidence strictly increases credit below target');
  assert.ok(c5 > 80, 'near-target effort reads as most of a full week');
});

test('weekStartMs: two timestamps in the same calendar week map to the same bucket', () => {
  const monday = Date.UTC(2026, 0, 5, 1, 0, 0);
  const sunday = Date.UTC(2026, 0, 11, 23, 0, 0);
  assert.equal(weekStartMs(monday), weekStartMs(sunday));
});

test('weekStartMs: consecutive weeks are exactly 7 days apart', () => {
  const w1 = weekStartMs(Date.UTC(2026, 0, 5));
  const w2 = weekStartMs(Date.UTC(2026, 0, 12));
  assert.equal(w2 - w1, WEEK_MS);
});

test('bucketEvidenceByWeek: sums weight magnitudes within a week, ignores excluded rows', () => {
  const day = WEEK0 + 24 * 60 * 60 * 1000;
  const rows = [
    evidenceRow('strength', 'moderate', day),
    evidenceRow('strength', 'minor', day + 1000),
    evidenceRow('strength', 'major', day + 2000, 'action', 'a1'),
    { ...evidenceRow('strength', 'major', day + 3000), excludedAt: Date.now() },
  ];
  const buckets = bucketEvidenceByWeek(rows, CFG);
  assert.equal(buckets.size, 1);
  // moderate(2) + minor(1) + major(4) = 7; the excluded major(4) must not count.
  assert.equal(buckets.get(WEEK0), 7);
});

// ── Validation item 1: repeated ideal evidence -> slow, monotonic progression ──
test('validation: sustained ideal weekly evidence produces slow, monotonically increasing progression', () => {
  const checkpoints = [1, 4, 13, 26, 52];
  let prevValue = 0;
  for (const wn of checkpoints) {
    const evidence = weeksOfIdealEvidence(wn);
    const now = WEEK0 + (wn - 1) * WEEK_MS + 4 * 24 * 60 * 60 * 1000;
    const value = computeAttributeValue(evidence, CFG, now);
    assert.ok(value > prevValue, `week ${wn} (${value}) should exceed the previous checkpoint (${prevValue})`);
    assert.ok(value < 100, 'never instantly maxes out');
    prevValue = value;
  }
  // Slow: even a full year of perfect weeks should not be near the ceiling.
  assert.ok(prevValue < 90, `1 year of ideal training (${prevValue}) should still be short of the high 90s`);
  assert.ok(prevValue > 70, `1 year of ideal training (${prevValue}) should be well past the 40s/50s`);
});

// ── Validation item 2: partial weeks receive partial (not zero, not full) credit ──
test('validation: a partial week (2 of 3 ideal sessions) earns real but incomplete credit vs a full week', () => {
  const idealWeek = [evidenceRow('strength', 'moderate', WEEK0 + 1000), evidenceRow('strength', 'moderate', WEEK0 + 2000), evidenceRow('strength', 'moderate', WEEK0 + 3000)];
  const partialWeek = [evidenceRow('strength', 'moderate', WEEK0 + 1000), evidenceRow('strength', 'moderate', WEEK0 + 2000)];
  const now = WEEK0 + 4 * 24 * 60 * 60 * 1000;
  const fullValue = computeAttributeValue(idealWeek, CFG, now);
  const partialValue = computeAttributeValue(partialWeek, CFG, now);
  const noneValue = computeAttributeValue([], CFG, now);
  assert.equal(noneValue, 0);
  assert.ok(partialValue > noneValue, 'partial effort beats doing nothing');
  assert.ok(partialValue < fullValue, 'partial effort earns less than a fully-met week');
  assert.ok(partialValue > fullValue * 0.5, '2-of-3 ideal sessions should read as substantially more than half credit, not a token amount');
});

// ── Validation item 3: zero-evidence weeks cause gradual decay ──
test('validation: zero evidence after an established value causes decay — small after a short gap, meaningful after a long one', () => {
  // Establish a solid value via ~1 year of ideal training.
  const established = weeksOfIdealEvidence(52);
  const establishedNow = WEEK0 + 51 * WEEK_MS + 4 * 24 * 60 * 60 * 1000;
  const startValue = computeAttributeValue(established, CFG, establishedNow);
  assert.ok(startValue > 60, 'sanity check: a year of ideal training should be a substantial value');

  const oneWeekLaterNow = establishedNow + WEEK_MS;
  const oneMonthLaterNow = establishedNow + 4 * WEEK_MS;
  const sixMonthsLaterNow = establishedNow + 26 * WEEK_MS;

  const afterOneWeek = computeAttributeValue(established, CFG, oneWeekLaterNow);
  const afterOneMonth = computeAttributeValue(established, CFG, oneMonthLaterNow);
  const afterSixMonths = computeAttributeValue(established, CFG, sixMonthsLaterNow);

  assert.ok(afterOneWeek < startValue, 'a missed week must decay the value');
  assert.ok(startValue - afterOneWeek < 3, 'a single missed week should cost very little');
  assert.ok(afterOneMonth < afterOneWeek, 'decay continues week over week');
  assert.ok(afterSixMonths < afterOneMonth, 'prolonged inactivity keeps eroding the value');
  assert.ok(startValue - afterSixMonths > 20, 'six months of total inactivity should be a meaningful, visible decline');
});

// ── Validation item 4: excessive evidence cannot exceed the weekly 100% credit cap ──
test('validation: doubling (or 10x-ing) weekly volume produces no more credit than exactly meeting the target', () => {
  const now = WEEK0 + 4 * 24 * 60 * 60 * 1000;
  const idealOnce = [evidenceRow('strength', 'major', WEEK0 + 1000, 'action', 'a'), evidenceRow('strength', 'moderate', WEEK0 + 2000)]; // 4+2=6 = target
  const idealDoubled = [...idealOnce, evidenceRow('strength', 'major', WEEK0 + 3000, 'action', 'b'), evidenceRow('strength', 'moderate', WEEK0 + 4000)]; // 12 units
  const idealTenX = Array.from({ length: 15 }, (_, i) => evidenceRow('strength', 'major', WEEK0 + 1000 + i * 100, 'action', `x${i}`)); // 60 units

  const v1 = computeAttributeValue(idealOnce, CFG, now);
  const v2 = computeAttributeValue(idealDoubled, CFG, now);
  const v10 = computeAttributeValue(idealTenX, CFG, now);
  assert.equal(v1, v2, 'exactly meeting the target vs. doubling it must produce identical credit for that week');
  assert.equal(v1, v10, 'exactly meeting the target vs. 10x overtraining must produce identical credit for that week');
});

// ── Validation item 5 (config independence) is exercised at the database.ts
// level (getAttributeScoringConfig per-Attribute) — here we confirm the pure
// function itself has no hidden shared state between calls with different configs.
test('validation: two different configs applied to the same evidence produce independent results', () => {
  const evidence = weeksOfIdealEvidence(13);
  const now = WEEK0 + 12 * WEEK_MS + 4 * 24 * 60 * 60 * 1000;
  const staminaConfig = { ...CFG, weeklyTargetUnits: 10, alphaUp: 0.06 }; // a stricter target, faster growth
  const a = computeAttributeValue(evidence, CFG, now);
  const b = computeAttributeValue(evidence, staminaConfig, now);
  assert.notEqual(a, b, 'different per-Attribute config must yield different scores from the same evidence');
});

test('recompute-from-history: calling computeAttributeValue twice with the same inputs is deterministic', () => {
  const evidence = weeksOfIdealEvidence(20);
  const now = WEEK0 + 19 * WEEK_MS + 4 * 24 * 60 * 60 * 1000;
  const a = computeAttributeValue(evidence, CFG, now);
  const b = computeAttributeValue(evidence, CFG, now);
  assert.equal(a, b);
});

// ── Measurable-Habit fractional evidence (12k-steps style) ──────────────────
// A count/duration Habit's evidence carries a `fraction` (0..1, actual/target
// progress) that scales its configured weight's units — applied once, at the
// raw-unit level, deliberately BEFORE weeklyCredit's curve, never through it
// twice (see bucketEvidenceByWeek's comment).

test('fraction: bucketEvidenceByWeek scales a row\'s units by its fraction', () => {
  const day = WEEK0 + 24 * 60 * 60 * 1000;
  const full = bucketEvidenceByWeek([evidenceRow('stamina', 'minor', day, 'habit', 'steps', 1)], CFG);
  const half = bucketEvidenceByWeek([evidenceRow('stamina', 'minor', day, 'habit', 'steps', 0.5)], CFG);
  const zero = bucketEvidenceByWeek([evidenceRow('stamina', 'minor', day, 'habit', 'steps', 0)], CFG);
  const implicit = bucketEvidenceByWeek([evidenceRow('stamina', 'minor', day, 'habit', 'steps')], CFG); // no fraction field at all
  assert.equal(full.get(WEEK0), CFG.weightMagnitude.minor * 1);
  assert.equal(half.get(WEEK0), CFG.weightMagnitude.minor * 0.5);
  assert.equal(zero.get(WEEK0), 0);
  assert.equal(implicit.get(WEEK0), CFG.weightMagnitude.minor, 'an evidence row with no fraction field means full credit, same as fraction: 1');
});

test('fraction: 0%/25%/50%/75%/100%/150%+ of a measurable Habit target scale proportionally, capped at 100%', () => {
  const day = WEEK0 + 24 * 60 * 60 * 1000;
  const now = day + 60 * 60 * 1000;
  const unitsAt = (fraction) => {
    const evidence = fraction > 0 ? [evidenceRow('stamina', 'moderate', day, 'habit', 'steps', fraction)] : [];
    // Read back the bucketed units directly rather than the full decayed
    // Attribute value, so this test isolates the fraction math from the
    // separate (already-tested) weekly-chase mechanism.
    return bucketEvidenceByWeek(evidence, CFG).get(WEEK0) ?? 0;
  };
  const fullUnits = CFG.weightMagnitude.moderate;
  assert.equal(unitsAt(0), 0);
  assert.ok(Math.abs(unitsAt(0.25) - fullUnits * 0.25) < 1e-9);
  assert.ok(Math.abs(unitsAt(0.5) - fullUnits * 0.5) < 1e-9);
  assert.ok(Math.abs(unitsAt(0.75) - fullUnits * 0.75) < 1e-9);
  assert.equal(unitsAt(1), fullUnits);
  // 150%+ progress must clamp to the same units as exactly 100% — the Habit
  // target itself is the cap, per the 2026-08-15 direction.
  assert.equal(bucketEvidenceByWeek([evidenceRow('stamina', 'moderate', day, 'habit', 'steps', 1.5)], CFG).get(WEEK0), fullUnits);
  assert.equal(bucketEvidenceByWeek([evidenceRow('stamina', 'moderate', day, 'habit', 'steps', 3)], CFG).get(WEEK0), fullUnits);
});

test('fraction: the H1 weekly-credit curve is not applied a second time at the fraction level (no double generosity)', () => {
  // If the curve were wrongly re-applied to a partial Habit's fraction, a
  // 50%-progress Moderate evidence would read as MORE than half of a
  // full-progress Moderate evidence's raw units (since x^0.6 > x for x<1).
  // The fraction must scale units linearly, not through the curve.
  const day = WEEK0 + 24 * 60 * 60 * 1000;
  const halfUnits = bucketEvidenceByWeek([evidenceRow('stamina', 'moderate', day, 'habit', 'steps', 0.5)], CFG).get(WEEK0);
  const fullUnits = bucketEvidenceByWeek([evidenceRow('stamina', 'moderate', day, 'habit', 'steps', 1)], CFG).get(WEEK0);
  assert.equal(halfUnits, fullUnits * 0.5, 'fraction scaling must be exactly linear, not curved');
});
