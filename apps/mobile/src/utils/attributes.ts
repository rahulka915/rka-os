// Pure types + helpers for the Potential Attribute system (Strength, Stamina,
// ...). See apps/mobile/CLAUDE.md's "Potential Attributes" note for the full
// architecture. Deliberately split from the scoring formula (utils/
// attributeScoring.ts): this module only knows how to parse/serialize
// evidence *configuration* (which Attributes a Habit/Action taps, at what
// strength) and evidence *rows* (what actually happened) — never how to turn
// that history into a live 0-100 value. Minor/Moderate/Major here are just
// labels; their numerical meaning (how many "stimulus units" each is worth)
// is scoring-model configuration, see attributeScoring.ts's
// DEFAULT_ATTRIBUTE_SCORING_CONFIG.weightMagnitude.

export type AttributeWeight = 'minor' | 'moderate' | 'major';

export function isAttributeWeight(value: unknown): value is AttributeWeight {
  return value === 'minor' || value === 'moderate' || value === 'major';
}

// One configured tap from a Habit template or a logged Action onto an
// Attribute — "this thing is evidence for that Attribute, at this strength."
// A single source can configure zero, one, or several of these (2026-08-14:
// "A single source must support multiple Attributes").
export interface AttributeContributionConfig {
  attributeId: string;
  weight: AttributeWeight;
}

// Parses a Habit's metadata.attributeContributions / an Action's
// details.attributeContributions — same shape in both places. Tolerant of
// malformed/partial data (a bad entry is dropped, not thrown); duplicate
// attributeIds are collapsed to the last one, since a source affecting the
// same Attribute twice at different strengths isn't a meaningful config.
export function parseAttributeContributions(value: unknown): AttributeContributionConfig[] {
  if (!Array.isArray(value)) return [];
  const byAttribute = new Map<string, AttributeContributionConfig>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const attributeId = (entry as Record<string, unknown>).attributeId;
    const weight = (entry as Record<string, unknown>).weight;
    if (typeof attributeId !== 'string' || !attributeId) continue;
    if (!isAttributeWeight(weight)) continue;
    byAttribute.set(attributeId, { attributeId, weight });
  }
  return Array.from(byAttribute.values());
}

// A single row of recorded evidence — mirrors db/types.ts's
// AttributeContributionRow, kept here too so pure call sites (tests, future
// scoring code) don't need to import the DB layer just for the shape.
export interface AttributeEvidence {
  attributeId: string;
  sourceType: 'habit' | 'action';
  sourceId: string;
  weight: AttributeWeight;
  // Proportional credit, 0..1 — undefined/omitted means full credit (1).
  // Set for measurable (count/duration) Habit evidence only; see
  // db/types.ts's AttributeContributionRow for the full explanation.
  fraction?: number;
  occurredAt: number;
  excludedAt?: number;
}

