import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import { useExercises } from '../hooks/useDb';
import { getWorkoutSessionDates, getExerciseSetLogHistory, getWorkoutSetLogsInRange } from '../db/database';
import {
  computeFrequencyHeatmap,
  computeExerciseProgression,
  computeVolumeByPeriod,
  computeMuscleGroupBalance,
} from '../utils/workoutTrends';
import { parseExerciseMeta, getMuscleGroupWeights } from '../utils/exerciseLibrary';
import { parseSetLogDetails } from '../utils/workoutSet';

const DAY_MS = 24 * 60 * 60 * 1000;

type Range = '3m' | '6m' | '1y' | 'all';
type VolumePeriod = 'week' | 'month';
const VOLUME_PERIOD_OPTIONS: { key: VolumePeriod; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
];
const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '3m': 92, '6m': 183, '1y': 366 };

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  'full-body': 'Full Body',
  cardio: 'Cardio',
};

export function WorkoutTrendsScreen() {
  const { exercises } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('6m');
  const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>('week');

  const exercisesWithLogs = useMemo(() => {
    return exercises.filter((item) => getExerciseSetLogHistory(item.id).length > 0);
  }, [exercises]);

  const allSessionDates = useMemo(() => getWorkoutSessionDates(0), [exercises]);
  const referenceNow = allSessionDates.length > 0 ? Math.max(...allSessionDates) : Date.now();
  const earliestSessionDate = allSessionDates.length > 0 ? Math.min(...allSessionDates) : referenceNow;

  const sinceMs = useMemo(() => {
    if (range === 'all') return earliestSessionDate;
    return referenceNow - RANGE_DAYS[range] * DAY_MS;
  }, [range, referenceNow, earliestSessionDate]);

  const heatmapDays = useMemo(
    () => computeFrequencyHeatmap(allSessionDates, sinceMs, referenceNow),
    [allSessionDates, sinceMs, referenceNow]
  );

  const selectedExercise = exercisesWithLogs.find((e) => e.id === selectedExerciseId) ?? exercisesWithLogs[0] ?? null;

  const progressionPoints = useMemo(() => {
    if (!selectedExercise) return [];
    return computeExerciseProgression(getExerciseSetLogHistory(selectedExercise.id));
  }, [selectedExercise]);

  const selectedExerciseUnit = useMemo(() => {
    if (!selectedExercise || progressionPoints.length === 0) return 'kg';
    const logs = getExerciseSetLogHistory(selectedExercise.id);
    const last = logs[logs.length - 1];
    return parseSetLogDetails(last?.details)?.weightUnit ?? 'kg';
  }, [selectedExercise, progressionPoints.length]);

  const setLogsInRange = useMemo(() => getWorkoutSetLogsInRange(sinceMs, referenceNow), [sinceMs, referenceNow]);

  const volumeByPeriod = useMemo(
    () => computeVolumeByPeriod(setLogsInRange, volumePeriod),
    [setLogsInRange, volumePeriod]
  );

  const muscleBalance = useMemo(() => {
    const exerciseGroupWeightsById = Object.fromEntries(
      exercises.map((item) => [item.id, getMuscleGroupWeights(parseExerciseMeta(item.metadata))])
    );
    return computeMuscleGroupBalance(setLogsInRange, exerciseGroupWeightsById);
  }, [setLogsInRange, exercises]);

  const activeDays = heatmapDays.filter((d) => d.count > 0).length;
  const maxPeriodVolume = Math.max(1, ...volumeByPeriod.map((w) => w.totalVolume));
  const maxTopWeight = Math.max(1, ...progressionPoints.map((p) => p.topWeight));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setRange(opt.key)}
              style={[styles.rangePill, range === opt.key && styles.rangePillActive]}
            >
              <Text style={[styles.rangeText, range === opt.key && styles.rangeTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.card, webDepth.card]}>
          <Text style={styles.cardTitle}>Frequency</Text>
          <Text style={styles.cardSubtitle}>{activeDays} active days in range</Text>
          <View style={styles.heatmapRow}>
            {heatmapDays.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: day.count > 0 ? webColors.accent : webColors.muted, opacity: day.count > 0 ? Math.min(1, 0.5 + day.count * 0.25) : 1 },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.card, webDepth.card]}>
          <Text style={styles.cardTitle}>Exercise Progression</Text>
          {exercisesWithLogs.length === 0 ? (
            <Text style={styles.empty}>Log some sets to see progression here.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exercisePickerRow}>
                {exercisesWithLogs.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => setSelectedExerciseId(ex.id)}
                    style={[styles.exercisePill, selectedExercise?.id === ex.id && styles.exercisePillActive]}
                  >
                    <Text style={[styles.exercisePillText, selectedExercise?.id === ex.id && styles.exercisePillTextActive]} numberOfLines={1}>
                      {ex.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {progressionPoints.length === 0 ? (
                <Text style={styles.empty}>No logged sets for this exercise yet.</Text>
              ) : (
                <View style={styles.barChartRow}>
                  {progressionPoints.map((point, idx) => (
                    <View key={`${point.sessionDate}-${idx}`} style={styles.barColumn}>
                      <View style={[styles.bar, { height: `${(point.topWeight / maxTopWeight) * 100}%` }]} />
                    </View>
                  ))}
                </View>
              )}
              {progressionPoints.length > 0 && (
                <Text style={styles.cardSubtitle}>
                  Top set: {progressionPoints[progressionPoints.length - 1].topWeight}
                  {selectedExerciseUnit} (most recent session)
                </Text>
              )}
            </>
          )}
        </View>

        <View style={[styles.card, webDepth.card]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{volumePeriod === 'week' ? 'Weekly Volume' : 'Monthly Volume'}</Text>
            <View style={styles.periodToggleRow}>
              {VOLUME_PERIOD_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setVolumePeriod(opt.key)}
                  style={[styles.periodPill, volumePeriod === opt.key && styles.periodPillActive]}
                >
                  <Text style={[styles.periodText, volumePeriod === opt.key && styles.periodTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {volumeByPeriod.length === 0 ? (
            <Text style={styles.empty}>No set logs in range.</Text>
          ) : (
            <View style={styles.barChartRow}>
              {volumeByPeriod.map((w) => (
                <View key={w.periodLabel} style={styles.barColumn}>
                  <View style={[styles.bar, styles.barSecondary, { height: `${(w.totalVolume / maxPeriodVolume) * 100}%` }]} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.card, webDepth.card]}>
          <Text style={styles.cardTitle}>Muscle Balance</Text>
          {muscleBalance.length === 0 ? (
            <Text style={styles.empty}>No set logs in range.</Text>
          ) : (
            <View style={styles.balanceList}>
              {muscleBalance.map((group) => (
                <View key={group.muscleGroup} style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{MUSCLE_GROUP_LABELS[group.muscleGroup] ?? group.muscleGroup}</Text>
                  <View style={styles.balanceTrack}>
                    <View style={[styles.balanceFill, { width: `${group.percent}%` }]} />
                  </View>
                  <Text style={styles.balancePercent}>{Math.round(group.percent)}%</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  content: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[4],
  },
  rangeRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  rangePill: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  rangePillActive: {
    backgroundColor: webColors.accent,
  },
  rangeText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  rangeTextActive: {
    color: webColors.card,
  },
  card: {
    backgroundColor: webColors.card,
    padding: webSpacing[5],
    gap: webSpacing[2],
  },
  cardTitle: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodToggleRow: {
    flexDirection: 'row',
    gap: webSpacing[1],
  },
  periodPill: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  periodPillActive: {
    backgroundColor: webColors.accent,
  },
  periodText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  periodTextActive: {
    color: webColors.card,
  },
  cardSubtitle: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[3],
  },
  heatmapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: webSpacing[2],
  },
  heatmapCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  exercisePickerRow: {
    marginBottom: webSpacing[3],
  },
  exercisePill: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    marginRight: webSpacing[2],
    maxWidth: 180,
  },
  exercisePillActive: {
    backgroundColor: webColors.accent,
  },
  exercisePillText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  exercisePillTextActive: {
    color: webColors.card,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 120,
    marginTop: webSpacing[2],
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 3,
    borderRadius: 4,
    backgroundColor: webColors.accent,
  },
  barSecondary: {
    backgroundColor: webColors.primary,
  },
  balanceList: {
    gap: webSpacing[3],
    marginTop: webSpacing[1],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
  },
  balanceLabel: {
    fontSize: webFontSize.xs,
    color: webColors.foreground,
    width: 80,
  },
  balanceTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: webColors.muted,
    overflow: 'hidden',
  },
  balanceFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: webColors.accent,
  },
  balancePercent: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    width: 36,
    textAlign: 'right',
  },
});
