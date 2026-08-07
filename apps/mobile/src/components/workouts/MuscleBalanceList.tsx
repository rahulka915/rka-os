// apps/mobile/src/components/workouts/MuscleBalanceList.tsx
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';
import { RiverStoneProgress } from '../ui/RiverStoneProgress';
import { MUSCLE_GROUP_LABELS } from '../../utils/exerciseLibrary';
import type { MuscleGroupVolume } from '../../utils/workoutTrends';

interface MuscleBalanceListProps {
  groups: MuscleGroupVolume[]; // pre-sorted descending by volume
  isDark: boolean;
}

// Deliberately reuses RiverStoneProgress rather than a new radial/donut
// component — the app's design system favors reusing the existing linear-bar
// indicator over inventing new shapes for the same "share of total" job.
// Tapping a row reveals the exact volume number behind that percentage —
// same "tap for detail" pattern as the heatmap/volume chart above it.
export function MuscleBalanceList({ groups, isDark }: MuscleBalanceListProps) {
  const palette = getThemeColors(isDark);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>MUSCLE GROUP BALANCE</Text>
      {groups.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <View style={s.rows}>
          {groups.map((g) => {
            const isSelected = selectedGroup === g.muscleGroup;
            return (
              <TouchableOpacity
                key={g.muscleGroup}
                style={s.row}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedGroup((prev) => (prev === g.muscleGroup ? null : g.muscleGroup));
                }}
              >
                <View style={s.labelRow}>
                  <Text style={[s.label, { color: palette.text }]}>{MUSCLE_GROUP_LABELS[g.muscleGroup]}</Text>
                  {isSelected && (
                    <Text style={[s.volumeText, { color: palette.textSecondary }]}>
                      {Math.round(g.volume).toLocaleString()} volume
                    </Text>
                  )}
                </View>
                <RiverStoneProgress
                  progress={g.percent / 100}
                  isDark={isDark}
                  label={`${Math.round(g.percent)}%`}
                  accessibilityLabel={`${MUSCLE_GROUP_LABELS[g.muscleGroup]} volume share`}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
  rows: { gap: 10 },
  row: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  volumeText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
