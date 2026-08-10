// Plan Backwards metadata shapes — see database.ts's "Plan Backwards"
// section for the repository functions that read/write these, and
// backwardPlanCalc.ts for the pure time-budget math that consumes them.

export type PlacementBehavior = 'auto' | 'anytime-before' | 'keep-near-event';
export type TravelMode = 'walking' | 'driving' | 'transit';

// Goal Time is the only required scheduling anchor — Start/Expected/Latest/End
// are all optional and deliberately distinct concepts (an event's official
// start time is not the same as the user's personal Goal Time to be there).
// Times are 'HH:MM' 24h strings, consistent with utils/time.ts's convention.
export interface BackwardPlanMeta {
  goalTime?: string;
  startTime?: string;
  expectedTime?: string;
  latestTime?: string;
  endTime?: string;
  location?: string;
  // Read-only reference to a device calendar event (services/deviceCalendar.ts).
  // Never written back to — RKA owns the plan, the calendar owns the event.
  deviceCalendarEventId?: string;
}

export function parseBackwardPlanMeta(metadata?: string | null): BackwardPlanMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
    return {
      goalTime: str(parsed.goalTime),
      startTime: str(parsed.startTime),
      expectedTime: str(parsed.expectedTime),
      latestTime: str(parsed.latestTime),
      endTime: str(parsed.endTime),
      location: str(parsed.location),
      deviceCalendarEventId: str(parsed.deviceCalendarEventId),
    };
  } catch {
    return {};
  }
}

export interface TravelConfig {
  startLocation?: string;
  destination?: string;
  mode: TravelMode;
  durationMinutes: number;
  bufferMinutes?: number;
  // Provenance of durationMinutes — never faked (spec: don't fake route
  // data). 'live' means it came from a real Apple Maps ETA at estimatedAt;
  // editing the duration by hand, or a route that couldn't be resolved,
  // always falls back to 'manual'.
  source?: 'manual' | 'live';
  distanceMeters?: number;
  estimatedAt?: number;
}

const VALID_MODES: TravelMode[] = ['walking', 'driving', 'transit'];

export function parseTravelConfig(json?: string | null): TravelConfig {
  if (!json) return { mode: 'driving', durationMinutes: 20 };
  try {
    const parsed = JSON.parse(json);
    return {
      startLocation: typeof parsed.startLocation === 'string' ? parsed.startLocation : undefined,
      destination: typeof parsed.destination === 'string' ? parsed.destination : undefined,
      mode: VALID_MODES.includes(parsed.mode) ? parsed.mode : 'driving',
      durationMinutes: typeof parsed.durationMinutes === 'number' ? parsed.durationMinutes : 20,
      bufferMinutes: typeof parsed.bufferMinutes === 'number' ? parsed.bufferMinutes : undefined,
      source: parsed.source === 'live' ? 'live' : 'manual',
      distanceMeters: typeof parsed.distanceMeters === 'number' ? parsed.distanceMeters : undefined,
      estimatedAt: typeof parsed.estimatedAt === 'number' ? parsed.estimatedAt : undefined,
    };
  } catch {
    return { mode: 'driving', durationMinutes: 20 };
  }
}

export function serializeTravelConfig(config: TravelConfig): string {
  return JSON.stringify(config);
}

export function isPlacementBehavior(v: unknown): v is PlacementBehavior {
  return v === 'auto' || v === 'anytime-before' || v === 'keep-near-event';
}

// 'HH:MM' 24h -> "7:50 PM", for display only — storage/comparison always
// uses the raw 24h string.
export function formatClockTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export const PLACEMENT_LABELS: Record<PlacementBehavior, string> = {
  auto: 'Auto',
  'anytime-before': 'Anytime before',
  'keep-near-event': 'Keep near event',
};
