import type { TravelMode } from './backwardPlanMeta';

// Apple Maps' documented URL scheme (maps.apple.com query params) — deep
// links out to the real Maps app for a route preview. No in-app map view,
// no native module, no rebuild: this is the stopgap until expo-maps lands
// in a future dev-client build (see apps/mobile/CLAUDE.md's Plan Backwards
// section for that note).
const DIRECTION_FLAG: Record<TravelMode, string> = {
  driving: 'd',
  walking: 'w',
  transit: 'r',
};

export function buildAppleMapsDirectionsUrl(startLocation: string, destination: string, mode: TravelMode): string | null {
  const start = startLocation.trim();
  const dest = destination.trim();
  if (!dest) return null;
  const params = new URLSearchParams({ daddr: dest, dirflg: DIRECTION_FLAG[mode] });
  if (start) params.set('saddr', start);
  return `https://maps.apple.com/?${params.toString()}`;
}
