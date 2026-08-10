import * as Location from 'expo-location';

// Coarse, short-lived cache of the device's approximate location — used only
// to bias Apple Maps search relevance (see LocationSearchField.tsx), never
// stored or sent anywhere else. Same permission-request pattern as
// locationReminders.ts. Fails soft to null on denial/error so search still
// works (just unranked-by-distance) rather than blocking on a permission
// prompt every time a field is focused.
const CACHE_MS = 5 * 60 * 1000;
let cached: { latitude: number; longitude: number; fetchedAt: number } | null = null;

export async function getApproximateLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // Last-known position resolves instantly (no GPS fix wait); only fall
    // back to a fresh fix if the device has none cached yet.
    const position = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!position) return null;
    cached = { latitude: position.coords.latitude, longitude: position.coords.longitude, fetchedAt: Date.now() };
    return cached;
  } catch {
    return null;
  }
}
