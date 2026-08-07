// apps/mobile/src/components/workouts/VolumeBarChart.tsx
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { VolumePeriod } from '../../utils/workoutTrends';

const VIEW_W = 320;
const VIEW_H = 120;
const BAR_GAP = 4;

interface VolumeBarChartProps {
  weeklyPeriods: VolumePeriod[];
  monthlyPeriods: VolumePeriod[];
  isDark: boolean;
}

// Simple SVG bar chart with a week/month toggle over a trailing window
// (weeklyPeriods/monthlyPeriods are pre-sliced by the caller to the desired
// trailing window, e.g. last 12 weeks / last 6 months).
export function VolumeBarChart({ weeklyPeriods, monthlyPeriods, isDark }: VolumeBarChartProps) {
  const palette = getThemeColors(isDark);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const periods = mode === 'week' ? weeklyPeriods : monthlyPeriods;
  const maxVolume = Math.max(1, ...periods.map((p) => p.totalVolume));
  const barWidth = periods.length > 0 ? (VIEW_W - BAR_GAP * (periods.length - 1)) / periods.length : 0;

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>TRAINING VOLUME</Text>
        <View style={s.toggle}>
          {(['week', 'month'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[
                s.toggleBtn,
                { backgroundColor: mode === m ? palette.vermilionSoft : 'transparent' },
              ]}
            >
              <Text style={[s.toggleText, { color: mode === m ? palette.vermilion : palette.textTertiary }]}>
                {m === 'week' ? 'Week' : 'Month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {periods.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {periods.map((p, i) => {
            const barHeight = (p.totalVolume / maxVolume) * (VIEW_H - 8);
            const x = i * (barWidth + BAR_GAP);
            const y = VIEW_H - barHeight;
            return <Rect key={p.periodLabel} x={x} y={y} width={barWidth} height={barHeight} rx={2} fill={palette.vermilion} />;
          })}
        </Svg>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  toggle: { flexDirection: 'row', gap: 4 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
