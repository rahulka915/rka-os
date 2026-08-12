// Pure scoring math for the Domain/Potential model. No DB access here —
// callers (src/db/database.ts) fetch rows and pass plain numbers in.

export const MAX_ACHIEVEMENT_LIFT = 30;

// A Domain with no linked Pillars isn't "failing" — Pillars are optional
// maintenance/capacity areas (mostly Health/Fitness). Such a Domain gets a
// neutral maintenance floor rather than 0%, so Mission/Achievement/Skill lift
// visibly floats above it and it doesn't drag Overall Potential to zero.
// The internal item type stays 'potential-stat'; "Pillar" is the product term.
export const NO_PILLAR_MAINTENANCE_BASELINE = 10;

// Maintenance for a Domain from its linked Pillars' maintenance percents.
// No Pillars → neutral baseline (see NO_PILLAR_MAINTENANCE_BASELINE), not 0.
export function domainMaintenance(pillarPercents: number[]): number {
  if (pillarPercents.length === 0) return NO_PILLAR_MAINTENANCE_BASELINE;
  return pillarPercents.reduce((sum, p) => sum + p, 0) / pillarPercents.length;
}

export const MISSION_CONTRIBUTION_DEFAULTS = { magnitude: 0.25, halfLifeDays: 14 };
export const ACHIEVEMENT_CONTRIBUTION_DEFAULTS = { magnitude: 0.6, halfLifeDays: 60 };
// Deliberately smaller than the Achievement tier: a Skill milestone is real
// evidence of practice, but shouldn't outweigh a genuine Mission/Achievement
// on the same Domain. Applied at full magnitude to the Skill's primary
// Domain and at half magnitude to each secondary Domain.
export const SKILL_CONTRIBUTION_DEFAULTS = { magnitude: 0.3, halfLifeDays: 45 };

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface Contribution {
  /** Base strength at occurredAt, as a fraction of MAX_ACHIEVEMENT_LIFT (0..1). */
  magnitude: number;
  halfLifeDays: number;
  /** Epoch ms the contribution's decay clock starts from. */
  occurredAt: number;
}

// Exponential half-life decay. Future-dated contributions (occurredAt > now)
// are clamped to full strength rather than extrapolated backward.
export function decayedStrength(contribution: Contribution, now: number): number {
  const elapsedDays = (now - contribution.occurredAt) / MS_PER_DAY;
  if (elapsedDays <= 0) return contribution.magnitude;
  return contribution.magnitude * Math.pow(0.5, elapsedDays / contribution.halfLifeDays);
}

// Product-of-complements combinator: multiple overlapping contributions push
// the lift closer to the ceiling with diminishing marginal effect, but never
// past it — the same shape used to stack independent probabilities/opacity.
export function achievementLift(
  contributions: Contribution[],
  now: number,
  maxLift: number = MAX_ACHIEVEMENT_LIFT,
): number {
  if (contributions.length === 0) return 0;
  let productOfComplements = 1;
  for (const contribution of contributions) {
    const strength = Math.min(Math.max(decayedStrength(contribution, now), 0), 1);
    productOfComplements *= 1 - strength;
  }
  return maxLift * (1 - productOfComplements);
}

// Domain score = live maintenance baseline + capped, decaying achievement
// lift above it. Maintenance already comes in 0..100 (average of the
// Domain's Potential Stats); the sum is capped at 100.
export function domainScore(
  maintenance: number,
  contributions: Contribution[],
  now: number,
  maxLift: number = MAX_ACHIEVEMENT_LIFT,
): number {
  const lift = achievementLift(contributions, now, maxLift);
  return Math.min(100, maintenance + lift);
}

// Overall Potential = weighted average of Domain scores. Weights default to
// equal (1) and are overridden per-Domain by the active Current Focus.
export function overallPotential(
  domainScores: Record<string, number>,
  weights: Record<string, number> = {},
): number {
  const entries = Object.entries(domainScores);
  if (entries.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [areaId, score] of entries) {
    const weight = weights[areaId] ?? 1;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}
