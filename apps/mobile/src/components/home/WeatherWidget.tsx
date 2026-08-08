import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getApproximateLocation } from '../../services/deviceLocation';
import { getCurrentWeather } from '../../services/weather';
import { describeConditionCode, getWeatherEmoji, type CurrentWeather } from '../../utils/weatherParsing';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';

interface WeatherWidgetProps {
  isDark: boolean;
}

// Same square-card slot as MedicationQuickLogWidget, next to it in Home's
// widget row.
//
// TEMPORARY: the long-term intent (see git history) is fail-soft-to-nothing
// — no placeholder, no error state, the widget just silently doesn't appear
// when there's no data, same as MedicationQuickLogWidget. Currently showing
// a placeholder instead, at the user's request, purely so the widget's
// layout/shape is visible on Home while waiting out WeatherKit's first-
// activation propagation window (HANDOVER_SUMMARY.md 2026-08-08 — auth
// succeeded, WeatherKit returned 401 NOT_ENABLED, expected to clear on its
// own). Revert to `if (!weather) return null;` once real data is confirmed
// flowing, rather than keeping this placeholder as a permanent loading state.
export function WeatherWidget({ isDark }: WeatherWidgetProps) {
  const palette = getThemeColors(isDark);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);

  const load = useCallback(async () => {
    const coords = await getApproximateLocation();
    if (!coords) return;
    const current = await getCurrentWeather(coords.latitude, coords.longitude);
    if (current) setWeather(current);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.touchWrap}>
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={[styles.content, !weather && styles.contentPlaceholder]}>
          <Text style={styles.emoji}>{weather ? getWeatherEmoji(weather.conditionCode) : '⛅'}</Text>
          <Text style={[styles.temperature, { color: palette.text }]}>{weather ? `${Math.round(weather.temperature)}°` : '--°'}</Text>
          <Text style={[styles.condition, { color: palette.textTertiary }]} numberOfLines={1}>
            {weather ? describeConditionCode(weather.conditionCode) : 'Waiting for weather'}
          </Text>
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
  // Dims the placeholder state so it doesn't read as real data at a glance.
  contentPlaceholder: {
    opacity: 0.45,
  },
  emoji: {
    fontSize: 22,
  },
  temperature: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  condition: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
