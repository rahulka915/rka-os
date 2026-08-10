// Pure response parsers for Apple's Maps Server API — split out from
// services/appleMaps.ts (which imports Firebase/RN) so these stay testable
// under plain Node without pulling in a runtime this repo's test suite
// can't execute.
export interface GeocodedPlace {
  latitude: number;
  longitude: number;
}

export function parseGeocodeResponse(body: unknown): GeocodedPlace | null {
  const results = (body as { results?: Array<{ coordinate?: { latitude?: number; longitude?: number } }> })?.results;
  const first = results?.[0]?.coordinate;
  if (typeof first?.latitude !== 'number' || typeof first?.longitude !== 'number') return null;
  return { latitude: first.latitude, longitude: first.longitude };
}

export interface EtaResult {
  durationSeconds: number;
  distanceMeters: number;
}

export function parseEtaResponse(body: unknown): EtaResult | null {
  const first = (body as { etas?: Array<{ expectedTravelTimeSeconds?: number; staticTravelTimeSeconds?: number; distanceMeters?: number }> })?.etas?.[0];
  const durationSeconds = first?.expectedTravelTimeSeconds ?? first?.staticTravelTimeSeconds;
  if (typeof durationSeconds !== 'number' || typeof first?.distanceMeters !== 'number') return null;
  return { durationSeconds, distanceMeters: first.distanceMeters };
}

// Batched form of parseEtaResponse — /v1/etas accepts up to 10
// pipe-separated destinations in one call, so a search dropdown can show a
// per-result ETA without one request per row. Position-aligned with the
// destinations the caller sent (null where Apple's response is missing or
// malformed for that entry), never dropped/reordered, so callers can zip it
// against their own results array by index.
export function parseEtasResponse(body: unknown): Array<EtaResult | null> {
  const etas = (body as { etas?: Array<{ expectedTravelTimeSeconds?: number; staticTravelTimeSeconds?: number; distanceMeters?: number }> })?.etas;
  if (!Array.isArray(etas)) return [];
  return etas.map((eta) => {
    const durationSeconds = eta?.expectedTravelTimeSeconds ?? eta?.staticTravelTimeSeconds;
    if (typeof durationSeconds !== 'number' || typeof eta?.distanceMeters !== 'number') return null;
    return { durationSeconds, distanceMeters: eta.distanceMeters };
  });
}

// Parses Apple's /v1/reverseGeocode PlaceResults shape — same envelope as
// geocode, just reading structuredAddress.locality (falls back to the
// place's own `name`) instead of the coordinate, since the input here IS a
// coordinate. Used to label the Weather widget with a city name.
export function parseReverseGeocodeResponse(body: unknown): string | null {
  const first = (body as {
    results?: Array<{ name?: string; structuredAddress?: { locality?: string } }>;
  })?.results?.[0];
  return first?.structuredAddress?.locality ?? first?.name ?? null;
}

export interface LocationSearchResult {
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}

// Parses Apple's /v1/searchAutocomplete SearchAutocompleteResponse — each
// result's displayLines is typically [name, descriptor], and its own
// location means a picked result never needs a second geocode call.
// NOTE: Apple's docs describe `location` as `{lat, lng}`, but the live API
// actually returns `{latitude, longitude}` (matching /v1/geocode's
// `coordinate` shape) — this reads both so a future doc/API reconciliation
// on Apple's side can't silently break this again.
export function parseSearchAutocompleteResponse(body: unknown): LocationSearchResult[] {
  const results = (body as {
    results?: Array<{
      displayLines?: string[];
      location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
    }>;
  })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((result): LocationSearchResult | null => {
      const lat = result.location?.latitude ?? result.location?.lat;
      const lng = result.location?.longitude ?? result.location?.lng;
      const [title, ...rest] = result.displayLines ?? [];
      if (typeof lat !== 'number' || typeof lng !== 'number' || !title) return null;
      const subtitle = rest.join(', ');
      return { title, subtitle: subtitle || undefined, latitude: lat, longitude: lng };
    })
    .filter((r): r is LocationSearchResult => r !== null);
}
