// apps/mobile/src/components/workouts/MuscleBalanceList.tsx
import { StyleSheet, Text, View } from 'react-native';
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
export function MuscleBalanceList({ groups, isDark }: MuscleBalanceListProps) {
  const palette = getThemeColors(isDark);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>MUSCLE GROUP BALANCE</Text>
      {groups.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <View style={s.rows}>
          {groups.map((g) => (
            <View key={g.muscleGroup} style={s.row}>
              <Text style={[s.label, { color: palette.text }]}>{MUSCLE_GROUP_LABELS[g.muscleGroup]}</Text>
              <RiverStoneProgress
                progress={g.percent / 100}
                isDark={isDark}
                label={`${Math.round(g.percent)}%`}
                accessibilityLabel={`${MUSCLE_GROUP_LABELS[g.muscleGroup]} volume share`}
              />
            </View>
          ))}
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
  label: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
