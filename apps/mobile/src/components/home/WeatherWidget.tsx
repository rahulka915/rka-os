import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getApproximateLocation } from '../../services/deviceLocation';
import { getCurrentWeather } from '../../services/weather';
import { reverseGeocode } from '../../services/appleMaps';
import { describeConditionCode, getWeatherEmoji, type CurrentWeather } from '../../utils/weatherParsing';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';

interface WeatherWidgetProps {
  isDark: boolean;
}

type WeatherStatus = 'loading' | 'ready' | 'unavailable';

// Same square-card slot as MedicationQuickLogWidget, next to it in Home's
// widget row. Always renders the card shell (even before data lands) so the
// widget row's height is stable from first paint — the fetch is async and on
// a cold launch can take a real moment, and the old "render nothing until
// data arrives" approach meant the whole row visibly grew taller once
// weather popped in. A genuine failure (denied permission, offline,
// WeatherKit down) still collapses the widget to nothing once we know
// there's no data coming, same fail-soft principle as before — the shell is
// only shown while a result is still pending.
// Location name is a nice-to-have, fetched alongside weather but never
// required for the card to render — condition text still shows if the
// reverse-geocode call fails while the weather call succeeds.
export function WeatherWidget({ isDark }: WeatherWidgetProps) {
  const palette = getThemeColors(isDark);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('loading');

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

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'unavailable') return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.touchWrap} disabled={status === 'loading'}>
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.content}>
          {status === 'loading' || !weather ? (
            <View style={[styles.placeholderDot, { backgroundColor: palette.textTertiary }]} />
          ) : (
            <>
              <Text style={styles.emoji}>{getWeatherEmoji(weather.conditionCode)}</Text>
              <Text style={[styles.temperature, { color: palette.text }]}>{Math.round(weather.temperature)}°</Text>
              {locationName ? (
                <Text style={[styles.location, { color: palette.text }]} numberOfLines={1}>{locationName}</Text>
              ) : null}
              <Text style={[styles.condition, { color: palette.textTertiary }]} numberOfLines={1}>
                {describeConditionCode(weather.conditionCode)}
              </Text>
            </>
          )}
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    paddingVertical: 4,
  },
  fill: {
    flex: 1,
  },
  squareCard: {
    aspectRatio: 1.16,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  placeholderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  emoji: {
    fontSize: 20,
  },
  temperature: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  location: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  condition: {
    fontSize: 9,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
