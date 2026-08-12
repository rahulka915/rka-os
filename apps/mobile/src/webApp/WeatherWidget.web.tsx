import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getApproximateLocation } from '../services/deviceLocation';
import { getCurrentWeather } from '../services/weather';
import { reverseGeocode } from '../services/appleMaps';
import { describeConditionCode, getWeatherEmoji, type CurrentWeather } from '../utils/weatherParsing';
import { webColors, webRadius, webFontSize, webSpacing, webDepth } from '../theme/webTheme';

// Web port of components/home/WeatherWidget.tsx — same Cloud Function call
// (firebase/functions httpsCallable is web-portable) and the same
// getApproximateLocation() (expo-location shims to navigator.geolocation on
// web, so it's reused as-is rather than hand-rolling a second geolocation
// path). Fails soft to rendering nothing, same principle as native.
export function WeatherWidget() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    const coords = await getApproximateLocation();
    if (!coords) {
      setStatus('unavailable');
      return;
    }
    const [current, name] = await Promise.all([
      getCurrentWeather(coords.latitude, coords.longitude),
      reverseGeocode(coords.latitude, coords.longitude),
    ]);
    if (current) {
      setWeather(current);
      setStatus('ready');
    } else {
      setStatus('unavailable');
    }
    if (name) setLocationName(name);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === 'unavailable') return null;

  return (
    <Pressable onPress={load} style={[styles.card, webDepth.card]}>
      {status === 'loading' || !weather ? (
        <View style={styles.dot} />
      ) : (
        <>
          <Text style={styles.emoji}>{getWeatherEmoji(weather.conditionCode)}</Text>
          <Text style={styles.temp}>{Math.round(weather.temperature)}°</Text>
          {locationName ? <Text style={styles.location} numberOfLines={1}>{locationName}</Text> : null}
          <Text style={styles.condition} numberOfLines={1}>{describeConditionCode(weather.conditionCode)}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    padding: webSpacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: webColors.mutedForeground, opacity: 0.5 },
  emoji: { fontSize: 22 },
  temp: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  location: { fontSize: webFontSize.xs, fontWeight: '600', color: webColors.foreground, textAlign: 'center' },
  condition: { fontSize: 10, fontWeight: '500', color: webColors.mutedForeground, textAlign: 'center' },
});
