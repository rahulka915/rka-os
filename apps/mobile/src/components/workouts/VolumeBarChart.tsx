// apps/mobile/src/components/workouts/VolumeBarChart.tsx
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { VolumePeriod } from '../../utils/workoutTrends';

const VIEW_W = 320;
const VIEW_H = 120;
const BAR_GAP = 4;
const MIN_BAR_WIDTH = 6; // below this, bars stop being legible — scroll instead of squeezing further

interface VolumeBarChartProps {
  weeklyPeriods: VolumePeriod[];
  monthlyPeriods: VolumePeriod[];
  isDark: boolean;
}

function formatPeriodLabel(period: VolumePeriod, mode: 'week' | 'month'): string {
  const start = new Date(period.periodStart);
  if (mode === 'month') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const end = new Date(period.periodStart + 6 * 24 * 60 * 60 * 1000);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `Week of ${startLabel} – ${endLabel}`;
}

// Simple SVG bar chart with a week/month toggle over the caller's chosen
// range (weeklyPeriods/monthlyPeriods span whatever window the Trends
// screen's range selector currently has active). Long ranges (1Y/All) can
// mean 50+ weekly bars — rather than squeeze them illegibly thin to fit one
// screen width, the chart grows past MIN_BAR_WIDTH and scrolls horizontally,
// same approach as the frequency heatmap. Tapping a bar shows that period's
// detail below the toggle, same "tap for detail" pattern as Apple
// Health/WHOOP/Tonal's bar charts (via Mobbin references).
export function VolumeBarChart({ weeklyPeriods, monthlyPeriods, isDark }: VolumeBarChartProps) {
  const palette = getThemeColors(isDark);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const periods = mode === 'week' ? weeklyPeriods : monthlyPeriods;
  const maxVolume = Math.max(1, ...periods.map((p) => p.totalVolume));
  const fittedBarWidth = periods.length > 0 ? (VIEW_W - BAR_GAP * (periods.length - 1)) / periods.length : 0;
  const barWidth = Math.max(MIN_BAR_WIDTH, fittedBarWidth);
  const chartWidth = periods.length > 0 ? periods.length * barWidth + (periods.length - 1) * BAR_GAP : VIEW_W;

  // Switching the week/month toggle invalidates whatever bar index was
  // selected under the old period set — clear it rather than show a stale
  // selection against the new bars.
  useEffect(() => {
    setSelectedIndex(null);
  }, [mode]);

  const selectedPeriod = selectedIndex !== null ? periods[selectedIndex] : null;

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

      <Text style={[s.detailText, { color: selectedPeriod ? palette.text : palette.textTertiary }]}>
        {selectedPeriod
          ? `${formatPeriodLabel(selectedPeriod, mode)} — ${Math.round(selectedPeriod.totalVolume).toLocaleString()} volume`
          : 'Tap a bar for details'}
      </Text>

      {periods.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={chartWidth} height={VIEW_H} viewBox={`0 0 ${chartWidth} ${VIEW_H}`}>
            {periods.map((p, i) => {
              const barHeight = (p.totalVolume / maxVolume) * (VIEW_H - 8);
              const x = i * (barWidth + BAR_GAP);
              const y = VIEW_H - barHeight;
              const isSelected = selectedIndex === i;
              return (
                <Rect
                  key={p.periodLabel}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill={palette.vermilion}
                  opacity={selectedIndex === null || isSelected ? 1 : 0.45}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedIndex((prev) => (prev === i ? null : i));
                  }}
                />
              );
            })}
          </Svg>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  detailText: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8 },
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
