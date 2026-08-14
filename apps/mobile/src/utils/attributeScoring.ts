// The v1 developmental Potential Attribute scoring model — "H1: simple
// hybrid" from the 2026-08-14 candidate comparison (see the published
// Attribute Scoring artifact for the full reasoning/simulation this was
// chosen from). Deliberately separate from utils/attributes.ts's evidence
// types: this module is pure "evidence history + config -> current value"
// math, recomputed fresh every call, nothing stored. Changing any config
// value, or swapping this whole model out for something else later (e.g.
// the history-aware H2 variant that was deliberately NOT built this pass),
// only requires re-running this function against the same
// attributeContributions history — no evidence rewrite, ever.
//
// Per-Attribute config lives on the Attribute item itself (metadata.
// scoringConfig, see database.ts's getAttributeScoringConfig) — Strength and
// Stamina share DEFAULT_ATTRIBUTE_SCORING_CONFIG today but are NOT assumed
// to share it forever; every value here is meant to be tunable per Attribute.

import type { AttributeEvidence, AttributeWeight } from './attributes';

export interface AttributeScoringConfig {
  // "Stimulus units" that count as one full week of appropriate evidence for
  // this Attribute. Not a universal constant — a future Attribute may need a
  // very different weekly target.
  weeklyTargetUnits: number;
  // How many stimulus units each evidence weight is worth, for this
  // Attribute specifically.
  weightMagnitude: Record<AttributeWeight, number>;
  // Below-target credit curve shape: credit = 100 * min(raw/target, 1) ^ curveExponent.
  // < 1 bows the curve up (partial effort reads as more than proportional
  // credit); 1 would be a plain linear ramp. Purely a tuning knob.
  curveExponent: number;
  // Weekly chase rate toward a week's credit signal when climbing (met-or-
  // exceeded-target weeks) — deliberately larger than alphaDown so
  // development is slow but a short lapse doesn't cost much.
  alphaUp: number;
  // Weekly chase rate when a week's credit is below the current value.
  alphaDown: number;
}

// Initial v1 defaults — see the Attribute Scoring artifact's simulations for
// why these particular numbers were chosen (they land the growth/decay
// curves roughly where the product direction described: months to reach the
// 40s-60s, roughly a year for the 80s, prolonged inactivity meaningfully
// erodes but a single missed week barely registers). Not permanent constants —
// every field is overridable per-Attribute via metadata.scoringConfig.
export const DEFAULT_ATTRIBUTE_SCORING_CONFIG: AttributeScoringConfig = {
  weeklyTargetUnits: 6,
  weightMagnitude: { minor: 1, moderate: 2, major: 4 },
  curveExponent: 0.6,
  alphaUp: 0.04,
  alphaDown: 0.015,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Monday 00:00 UTC of the week containing `timestampMs` — a fixed, stable
// bucket boundary so recomputing later (with more evidence, or changed
// config) always groups the same evidence into the same week.
export function weekStartMs(timestampMs: number): number {
  const dayIndex = Math.floor(timestampMs / DAY_MS);
  const dayOfWeek = new Date(dayIndex * DAY_MS).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return (dayIndex - daysSinceMonday) * DAY_MS;
}

// A single week's raw evidence converted to a 0-100 "how good was this
// week" credit — generous below the target (partial effort counts for
// real), hard-capped at the target so no amount of extra volume buys more
// than a perfect week.
export function weeklyCredit(rawUnits: number, config: AttributeScoringConfig): number {
  if (config.weeklyTargetUnits <= 0) return rawUnits > 0 ? 100 : 0;
  const fraction = Math.min(rawUnits / config.weeklyTargetUnits, 1);
  return 100 * Math.pow(fraction, config.curveExponent);
}

// Sums evidence into weekly stimulus-unit buckets, keyed by weekStartMs.
// Excluded evidence (excludedAt set) never counts — an edited/deleted
// Action's stale tags must not keep contributing. `fraction` (measurable
// Habit progress, 0..1, see AttributeEvidence) scales a row's units
// proportionally — deliberately applied here, once, at the raw-unit level,
// NOT by feeding a partial value through weeklyCredit's ^curveExponent a
// second time, which would double up the "partial effort still counts for
// a lot" generosity the curve already provides at the weekly level.
export function bucketEvidenceByWeek(evidence: AttributeEvidence[], config: AttributeScoringConfig): Map<number, number> {
  const buckets = new Map<number, number>();
  for (const row of evidence) {
    if (row.excludedAt) continue;
    const week = weekStartMs(row.occurredAt);
    const fraction = row.fraction ?? 1;
    const units = (config.weightMagnitude[row.weight] ?? 0) * Math.max(0, Math.min(fraction, 1));
    buckets.set(week, (buckets.get(week) ?? 0) + units);
  }
  return buckets;
}

// The full H1 computation: bucket evidence into weeks, then walk forward
// from the first evidence week to "now," applying the asymmetric chase rule
// every week (including weeks with zero evidence — those decay). An
// Attribute with no evidence at all is 0 — "how much of my potential am I
// currently realizing" has a real, unambiguous answer of "none yet" before
// anything's ever been logged, not an arbitrary starting number.
export function computeAttributeValue(evidence: AttributeEvidence[], config: AttributeScoringConfig, now: number): number {
  const active = evidence.filter((row) => !row.excludedAt);
  if (active.length === 0) return 0;

  const buckets = bucketEvidenceByWeek(active, config);
  const firstWeek = Math.min(...buckets.keys());
  const lastWeek = weekStartMs(now);

  let value = 0;
  for (let week = firstWeek; week <= lastWeek; week += WEEK_MS) {
    const raw = buckets.get(week) ?? 0;
    const target = weeklyCredit(raw, config);
    const alpha = target >= value ? config.alphaUp : config.alphaDown;
    value = value + alpha * (target - value);
  }
  return Math.max(0, Math.min(100, value));
}
