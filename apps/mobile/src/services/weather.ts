// Current conditions via WeatherKit, proxied through the getWeather Cloud
// Function (functions/src/index.ts) — unlike the Maps integration, the
// client never sees an Apple-facing token at all here; the function mints
// its JWT and calls WeatherKit itself, relaying the JSON straight through.
// Fails soft to null throughout, same principle as the rest of this app's
// Apple integrations: weather is an enhancement, never a requirement.
import { httpsCallable } from 'firebase/functions';
import { functions, hasFirebaseConfig } from '../lib/firebase';
import { parseCurrentWeather, type CurrentWeather } from '../utils/weatherParsing';

interface CachedWeather {
  weather: CurrentWeather;
  fetchedAt: number;
}

// Coordinates rounded to ~1km before caching/keying — a widget refresh from
// a few meters away shouldn't count as a new location and re-fetch.
const CACHE_MS = 20 * 60 * 1000;
let cache: { key: string; entry: CachedWeather } | null = null;

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

export async function getCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather | null> {
  const key = cacheKey(latitude, longitude);
  if (cache?.key === key && Date.now() - cache.entry.fetchedAt < CACHE_MS) {
    return cache.entry.weather;
  }
  if (!hasFirebaseConfig || !functions) return null;
  try {
    const call = httpsCallable(functions, 'getWeather');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await call({ latitude, longitude, timezone });
    const weather = parseCurrentWeather(result.data);
    if (!weather) return null;
    cache = { key, entry: { weather, fetchedAt: Date.now() } };
    return weather;
  } catch {
    return null;
  }
}
