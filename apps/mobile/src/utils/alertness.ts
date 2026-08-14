// Pure helpers for Alertness — a "Current State" reading, architecturally
// separate from the Potential Attribute system (Strength/Stamina, see
// utils/attributes.ts). Attributes accumulate slow, decaying evidence over
// months; Alertness is the opposite shape — a fast-changing snapshot derived
// from *today's* conditions, recomputed fresh each read, nothing stored or
// decayed. See apps/mobile/CLAUDE.md's "Current State" note.
//
// v1 (2026-08-14) is deliberately basic: derived only from this morning's
// Daily Check-In sleep answers (utils/dailyCheckIn.ts's fixed SLEEP_AMOUNT/
// SLEEP_QUALITY chip vocabularies — see DailyCheckInFlowScreen.tsx). The
// `AlertnessInputs` shape has room for more signals (energy chip, time
// awake, ...) precisely so those can be added later without a redesign —
// they're deliberately NOT wired in yet, per product direction.

export interface AlertnessInputs {
  sleepAmount?: string; // one of dailyCheckIn's SLEEP_AMOUNT chips
  sleepQuality?: string; // one of dailyCheckIn's SLEEP_QUALITY chips
  // Reserved for later, deliberately unused in v1: energy chip, hours awake
  // since waking, time-of-day decay, etc.
}

const SLEEP_AMOUNT_BASE: Record<string, number> = {
  '<4': 10,
  '4-6': 40,
  '6-8': 75,
  '8+': 90,
  'not sure': 50,
};

const SLEEP_QUALITY_MODIFIER: Record<string, number> = {
  rough: -15,
  broken: -10,
  okay: 0,
  deep: 10,
  overslept: -5,
};

// Returns null when there's no sleep answer to derive from (no check-in
// logged yet today) — Alertness has no meaningful "default," unlike
// Attributes' evidence-based model. Never invents a value.
export function computeAlertness(inputs: AlertnessInputs): number | null {
  if (!inputs.sleepAmount || !(inputs.sleepAmount in SLEEP_AMOUNT_BASE)) return null;
  const base = SLEEP_AMOUNT_BASE[inputs.sleepAmount];
  const modifier = inputs.sleepQuality ? SLEEP_QUALITY_MODIFIER[inputs.sleepQuality] ?? 0 : 0;
  return Math.max(0, Math.min(100, base + modifier));
}
