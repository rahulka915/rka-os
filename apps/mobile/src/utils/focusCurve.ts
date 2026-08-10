import type { MedicationMeta } from '../db/database';
import type { ActivityLog, Item } from '../db/types';

export type FocusPhase = 'building' | 'peak' | 'fading';

export interface FocusState {
  itemId: string;
  medName: string;
  dose?: string;
  takenAt: number;
  onsetMinHours: number;
  onsetMaxHours: number;
  peakMinHours: number;
  peakMaxHours: number;
  fadeEndMinHours: number;
  fadeEndMaxHours: number;
  phase: FocusPhase;
  /** Elapsed hours since the dose was taken, clamped to [0, fadeEndMaxHours). */
  elapsedHours: number;
  peakMinAt: number;
  peakMaxAt: number;
  fadeEndMinAt: number;
  fadeEndMaxAt: number;
}

// The peak is a window, not an instant, but the phase transition still needs
// a single moment to switch on — the range's midpoint. A small extra window
// around that midpoint (capped at 30 minutes) keeps "Peak" from flickering
// past in a single tick before the curve moves on to "Fading".
const PEAK_WINDOW_FRACTION = 0.2;
const PEAK_WINDOW_MAX_HOURS = 0.5;

function midpoint(min: number, max: number): number {
  return (min + max) / 2;
}

// Pure — no hooks — so it can be called both from a render and from a
// polling interval (the phase/label changes purely with wall-clock time,
// independent of any DB write). Returns null whenever there's nothing to
// show: curve not enabled, timing not fully configured, no dose logged yet,
// or the most recent dose has already fully faded (past the *latest*
// estimate — a med isn't cleared as "worn off" just because the earliest
// estimate has passed).
export function computeFocusState(item: Pick<Item, 'id' | 'title'>, meta: MedicationMeta, lastLog: ActivityLog | null): FocusState | null {
  if (!meta.focusCurveEnabled) return null;
  const { onsetMinHours, onsetMaxHours, peakMinHours, peakMaxHours, fadeEndMinHours, fadeEndMaxHours } = meta;
  if (
    onsetMinHours === undefined || onsetMaxHours === undefined ||
    peakMinHours === undefined || peakMaxHours === undefined ||
    fadeEndMinHours === undefined || fadeEndMaxHours === undefined
  ) {
    return null;
  }
  if (onsetMinHours > onsetMaxHours || peakMinHours > peakMaxHours || fadeEndMinHours > fadeEndMaxHours) return null;
  const onsetMid = midpoint(onsetMinHours, onsetMaxHours);
  const peakMid = midpoint(peakMinHours, peakMaxHours);
  const fadeEndMid = midpoint(fadeEndMinHours, fadeEndMaxHours);
  if (!(onsetMid <= peakMid && peakMid <= fadeEndMid) || fadeEndMaxHours <= 0) return null;
  if (!lastLog) return null;

  const takenAt = lastLog.timestamp;
  const elapsedHours = (Date.now() - takenAt) / 3600000;
  if (elapsedHours < 0 || elapsedHours >= fadeEndMaxHours) return null;

  const peakWindow = Math.min(PEAK_WINDOW_MAX_HOURS, (fadeEndMid - peakMid) * PEAK_WINDOW_FRACTION);
  let phase: FocusPhase;
  if (elapsedHours < peakMid) phase = 'building';
  else if (elapsedHours < peakMid + peakWindow) phase = 'peak';
  else phase = 'fading';

  return {
    itemId: item.id,
    medName: item.title,
    dose: meta.dose,
    takenAt,
    onsetMinHours,
    onsetMaxHours,
    peakMinHours,
    peakMaxHours,
    fadeEndMinHours,
    fadeEndMaxHours,
    phase,
    elapsedHours,
    peakMinAt: takenAt + peakMinHours * 3600000,
    peakMaxAt: takenAt + peakMaxHours * 3600000,
    fadeEndMinAt: takenAt + fadeEndMinHours * 3600000,
    fadeEndMaxAt: takenAt + fadeEndMaxHours * 3600000,
  };
}

// The curve's own rise/fall shape is drawn against these midpoints — the
// ranges themselves are shown separately as shaded uncertainty bands (see
// `FocusTimelineCard`).
export function focusCurveMidpoints(state: FocusState): { peakHours: number; fadeEndHours: number } {
  return {
    peakHours: midpoint(state.peakMinHours, state.peakMaxHours),
    fadeEndHours: state.fadeEndMaxHours,
  };
}

export function formatClockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
