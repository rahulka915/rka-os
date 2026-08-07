// apps/mobile/src/components/workouts/WorkoutFrequencyHeatmap.tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { FrequencyDay } from '../../utils/workoutTrends';

const CELL = 12;
const GAP = 3;

interface WorkoutFrequencyHeatmapProps {
  days: FrequencyDay[]; // must be weeks*7 days, oldest first, starting on a Monday
  isDark: boolean;
}

// GitHub-contributions-style grid: one column per week, one row per weekday,
// cell shade by session count that day. Uses the app's vermilion scale, not
// a foreign green. Width scales with the caller's chosen range (3M/6M/1Y/All
// all pass different day counts) and scrolls horizontally rather than
// squeezing cells for longer ranges — a full year is 52 columns, which
// doesn't fit one screen width at a legible cell size.
export function WorkoutFrequencyHeatmap({ days, isDark }: WorkoutFrequencyHeatmapProps) {
  const palette = getThemeColors(isDark);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const weeks = Math.max(1, Math.ceil(days.length / 7));
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  const opacityForCount = (count: number) => {
    if (count === 0) return 0;
    return 0.25 + 0.75 * (count / maxCount);
  };

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>WORKOUT FREQUENCY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {days.map((day, i) => {
            const week = Math.floor(i / 7);
            const weekday = i % 7;
            const x = week * (CELL + GAP);
            const y = weekday * (CELL + GAP);
            const opacity = opacityForCount(day.count);
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
                stroke={opacity === 0 ? palette.separator : 'none'}
                strokeWidth={opacity === 0 ? 1 : 0}
                fillOpacity={opacity === 0 ? 0.06 : undefined}
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
