import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getItemsByType, getCompletedOccurrenceDates, formatDate } from '../db/database';
import { POTENTIAL_STATS, POTENTIAL_STAT_LABELS, computePotentialStats, type PotentialStatResult } from '../utils/potential';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { KatanaProgress } from '../components/ui/KatanaProgress';

export function PotentialScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [results, setResults] = useState<Record<string, PotentialStatResult> | null>(null);

  const load = useCallback(() => {
    const habits = getItemsByType('habit');
    const completedDatesByHabitId: Record<string, Set<string>> = {};
    for (const habit of habits) {
      completedDatesByHabitId[habit.id] = getCompletedOccurrenceDates(habit.id);
    }
    const today = formatDate(new Date());
    setResults(computePotentialStats(habits, completedDatesByHabitId, today));
  }, []);

  useFocusEffect(load);

  return (
    <LensSurface title="Potential">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {POTENTIAL_STATS.map((stat) => {
          const result = results?.[stat];
          const percent = result ? Math.round(result.percent) : 0;
          const contributionNames = result?.contributions.map((c) => c.habitTitle).join(', ') ?? '';
          return (
            <View key={stat} style={styles.statRow}>
              <View style={styles.statHeaderRow}>
                <Text style={[styles.statLabel, { color: palette.text }]}>{POTENTIAL_STAT_LABELS[stat]}</Text>
                <Text style={[styles.statPercent, { color: palette.textTertiary }]}>{percent}%</Text>
              </View>
              <KatanaProgress progress={(result?.percent ?? 0) / 100} size={16} accessibilityLabel={`${POTENTIAL_STAT_LABELS[stat]} potential`} />
              <Text style={[styles.statSubtext, { color: palette.textTertiary }]}>
                {contributionNames || 'No habits linked yet — assign one from a habit’s detail page.'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  statRow: { gap: 8 },
  statHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statLabel: { fontSize: 16, fontWeight: '700' },
  statPercent: { fontSize: 14, fontWeight: '600' },
  statSubtext: { fontSize: 13, fontWeight: '400' },
});
