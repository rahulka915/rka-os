// Live routing for Plan Backwards' Travel block, via Apple's Maps Server
// API (https://developer.apple.com/documentation/applemapsserverapi).
// The signing private key lives only in the `getAppleMapsToken` Cloud
// Function (functions/src/index.ts) — this client only ever holds a
// short-lived access token, cached in memory and refetched near expiry.
// Every call here fails soft (returns null) so Travel always has the manual
// duration fallback already built into AddPlanBlockSheet — live routing is
// an enhancement, never a requirement (spec section 28).
import { httpsCallable } from 'firebase/functions';
import { functions, hasFirebaseConfig } from '../lib/firebase';
import type { TravelMode } from '../utils/backwardPlanMeta';
import {
  parseGeocodeResponse,
  parseEtaResponse,
  parseEtasResponse,
  parseSearchAutocompleteResponse,
  parseReverseGeocodeResponse,
  type GeocodedPlace,
  type EtaResult,
  type LocationSearchResult,
} from '../utils/appleMapsParsing';

export { parseGeocodeResponse, parseEtaResponse, type GeocodedPlace, type EtaResult, type LocationSearchResult };

// /v1/etas caps destinations at 10 per call.
const MAX_ETA_DESTINATIONS = 10;

const APPLE_MAPS_TRANSPORT_TYPE: Record<TravelMode, string> = {
  driving: 'Automobile',
  walking: 'Walking',
  transit: 'Transit',
};

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: TokenState | null = null;

async function getMapsAccessToken(): Promise<string | null> {
  if (!hasFirebaseConfig || !functions) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  try {
    const call = httpsCallable<void, { accessToken: string; expiresInSeconds: number }>(functions, 'getAppleMapsToken');
    const result = await call();
    cachedToken = {
      accessToken: result.data.accessToken,
      expiresAt: Date.now() + result.data.expiresInSeconds * 1000,
    };
    return cachedToken.accessToken;
  } catch {
    return null;
  }
}

export async function geocode(address: string): Promise<GeocodedPlace | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const accessToken = await getMapsAccessToken();
  if (!accessToken) return null;
  try {
    const response = await fetch(`https://maps-api.apple.com/v1/geocode?q=${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return parseGeocodeResponse(await response.json());
  } catch {
    return null;
  }
}

export async function getEta(origin: GeocodedPlace, destination: GeocodedPlace, mode: TravelMode): Promise<EtaResult | null> {
  const accessToken = await getMapsAccessToken();
  if (!accessToken) return null;
  try {
    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destinations: `${destination.latitude},${destination.longitude}`,
      transportType: APPLE_MAPS_TRANSPORT_TYPE[mode],
    });
    const response = await fetch(`https://maps-api.apple.com/v1/etas?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return parseEtaResponse(await response.json());
  } catch {
    return null;
  }
}

// Batched ETA for a search dropdown — one request for up to 10 destinations
// rather than one per row. Position-aligned with `destinations` (null where
// Apple couldn't resolve that one), so the caller zips it against its own
// results array by index. Destinations beyond the cap are simply not priced
// (returned as null) rather than erroring the whole batch.
export async function getEtasBatch(origin: GeocodedPlace, destinations: GeocodedPlace[], mode: TravelMode): Promise<Array<EtaResult | null>> {
  if (destinations.length === 0) return [];
  const capped = destinations.slice(0, MAX_ETA_DESTINATIONS);
  const accessToken = await getMapsAccessToken();
  if (!accessToken) return destinations.map(() => null);
  try {
    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destinations: capped.map((d) => `${d.latitude},${d.longitude}`).join('|'),
      transportType: APPLE_MAPS_TRANSPORT_TYPE[mode],
    });
    const response = await fetch(`https://maps-api.apple.com/v1/etas?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return destinations.map(() => null);
    const results = parseEtasResponse(await response.json());
    return destinations.map((_, i) => results[i] ?? null);
  } catch {
    return destinations.map(() => null);
  }
}

// Powers the "search as you type" location field in AnchorEventEditSheet /
// AddPlanBlockSheet's Travel tab — each result already carries its own
// coordinate (Apple's /v1/searchAutocomplete), so picking one never needs a
// follow-up geocode call the way free-text entry does. `near`, when
// available (LocationSearchField supplies the device's approximate
// location), biases/ranks results the way the native Maps app does — a bare
// query without it still works, just unranked by distance.
export async function searchLocations(query: string, near?: GeocodedPlace): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const accessToken = await getMapsAccessToken();
  if (!accessToken) return [];
  try {
    const params = new URLSearchParams({ q: trimmed });
    if (near) {
      const coords = `${near.latitude},${near.longitude}`;
      params.set('userLocation', coords);
      params.set('searchLocation', coords);
    }
    const response = await fetch(`https://maps-api.apple.com/v1/searchAutocomplete?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    return parseSearchAutocompleteResponse(await response.json());
  } catch {
    return [];
  }
}

// Labels the Weather widget with a city name — cached by ~1km-rounded
// coordinate for an hour (a location name is effectively static, unlike
// weather itself) so it isn't re-fetched every widget mount/refresh.
const REVERSE_GEOCODE_CACHE_MS = 60 * 60 * 1000;
let reverseGeocodeCache: { key: string; name: string; fetchedAt: number } | null = null;

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  if (reverseGeocodeCache?.key === key && Date.now() - reverseGeocodeCache.fetchedAt < REVERSE_GEOCODE_CACHE_MS) {
    return reverseGeocodeCache.name;
  }
  const accessToken = await getMapsAccessToken();
  if (!accessToken) return null;
  try {
    const response = await fetch(`https://maps-api.apple.com/v1/reverseGeocode?loc=${latitude},${longitude}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const name = parseReverseGeocodeResponse(await response.json());
    if (name) reverseGeocodeCache = { key, name, fetchedAt: Date.now() };
    return name;
  } catch {
    return null;
  }
}

export interface LiveTravelEstimate extends EtaResult {}

// The one function AddPlanBlockSheet actually calls — geocodes both ends
// then fetches the ETA between them. Returns null at any failure point
// (unresolvable address, no network, no token, quota) so the caller can fall
// back to manual entry without special-casing which step failed.
export async function estimateTravel(startLocation: string, destination: string, mode: TravelMode): Promise<LiveTravelEstimate | null> {
  const [origin, dest] = await Promise.all([geocode(startLocation), geocode(destination)]);
  if (!origin || !dest) return null;
  return getEta(origin, dest, mode);
}
