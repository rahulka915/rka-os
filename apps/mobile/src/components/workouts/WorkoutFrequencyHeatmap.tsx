// apps/mobile/src/components/workouts/WorkoutFrequencyHeatmap.tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { FrequencyDay } from '../../utils/workoutTrends';

const CELL = 12;
const GAP = 3;

interface WorkoutFrequencyHeatmapProps {
  days: FrequencyDay[]; // must be weeks*7 days, oldest first, starting on a Monday
  isDark: boolean;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// GitHub-contributions-style grid: one column per week, one row per weekday,
// cell shade by session count that day. Uses the app's vermilion scale, not
// a foreign green. Width scales with the caller's chosen range (3M/6M/1Y/All
// all pass different day counts) and scrolls horizontally rather than
// squeezing cells for longer ranges — a full year is 52 columns, which
// doesn't fit one screen width at a legible cell size. Tapping a cell shows
// that day's detail below the grid, same "tap for detail" pattern as Apple
// Health/WHOOP/Tonal's bar charts (via Mobbin references).
export function WorkoutFrequencyHeatmap({ days, isDark }: WorkoutFrequencyHeatmapProps) {
  const palette = getThemeColors(isDark);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const weeks = Math.max(1, Math.ceil(days.length / 7));
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  const opacityForCount = (count: number) => {
    if (count === 0) return 0;
    return 0.25 + 0.75 * (count / maxCount);
  };

  const selectedDay = selectedIndex !== null ? days[selectedIndex] : null;

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>WORKOUT FREQUENCY</Text>
        <Text style={[s.detailText, { color: selectedDay ? palette.text : palette.textTertiary }]}>
          {selectedDay
            ? `${formatDayLabel(selectedDay.date)} — ${selectedDay.count} workout${selectedDay.count === 1 ? '' : 's'}`
            : 'Tap a day for details'}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {days.map((day, i) => {
            const week = Math.floor(i / 7);
            const weekday = i % 7;
            const x = week * (CELL + GAP);
            const y = weekday * (CELL + GAP);
            const opacity = opacityForCount(day.count);
            const isSelected = selectedIndex === i;
            return (
              <Rect
                key={day.date}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={3}
                fill={palette.vermilion}
                opacity={opacity === 0 ? 1 : opacity}
                stroke={isSelected ? palette.text : opacity === 0 ? palette.separator : 'none'}
                strokeWidth={isSelected ? 1.5 : opacity === 0 ? 1 : 0}
                fillOpacity={opacity === 0 ? 0.06 : undefined}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedIndex((prev) => (prev === i ? null : i));
                }}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  headerRow: { marginBottom: 8, gap: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
