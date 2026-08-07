// apps/mobile/src/screens/WorkoutTrendsScreen.tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LensSurface } from '../components/LensSurface';
import { WorkoutFrequencyHeatmap } from '../components/workouts/WorkoutFrequencyHeatmap';
import { ExerciseProgressionChart } from '../components/workouts/ExerciseProgressionChart';
import { VolumeBarChart } from '../components/workouts/VolumeBarChart';
import { MuscleBalanceList } from '../components/workouts/MuscleBalanceList';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
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
const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];
// Fixed lookback in days for every range except 'all', which is resolved
// dynamically per-account from the earliest workout session on record —
// matches the Apple Health / Peloton Strength+ / Bevel pattern of a single
// range selector driving every chart on the page together, rather than each
// chart picking its own independent window.
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '3m': 92, '6m': 183, '1y': 366 };

export function WorkoutTrendsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { exercises } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('6m');

  const exercisesWithLogs = useMemo(() => {
    // Only exercises with at least one set log are offered in the picker —
    // computed once per exercise list change, not on every render, since
    // getExerciseSetLogHistory hits SQLite.
    return exercises
      .map((item) => ({ item, hasLogs: getExerciseSetLogHistory(item.id).length > 0 }))
      .filter((e) => e.hasLogs)
      .map((e) => ({ item: e.item }));
  }, [exercises]);

  // All the "trailing window" views (heatmap/volume/balance) below are
  // meaningless anchored to the real wall-clock "now" for an account whose
  // workout history is a one-time historical import (e.g. RepCount) with no
  // recent activity — every window would show empty even though the data
  // exists. Anchor them instead to the most recent workout session on
  // record: for an active user that's ~today anyway (unchanged behavior),
  // but for a lapsed/historical-only account it shows the actual last N
  // periods of real data instead of an empty trailing window ending today.
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

  const progressionPoints = useMemo(() => {
    if (!selectedExerciseId) return [];
    return computeExerciseProgression(getExerciseSetLogHistory(selectedExerciseId));
  }, [selectedExerciseId]);

  const selectedExerciseUnit = useMemo(() => {
    if (progressionPoints.length === 0 || !selectedExerciseId) return 'kg';
    const logs = getExerciseSetLogHistory(selectedExerciseId);
    const last = logs[logs.length - 1];
    return parseSetLogDetails(last?.details)?.weightUnit ?? 'kg';
  }, [selectedExerciseId, progressionPoints.length]);

  const setLogsInRange = useMemo(() => getWorkoutSetLogsInRange(sinceMs, referenceNow), [sinceMs, referenceNow]);

  const weeklyVolume = useMemo(() => computeVolumeByPeriod(setLogsInRange, 'week'), [setLogsInRange]);
  const monthlyVolume = useMemo(() => computeVolumeByPeriod(setLogsInRange, 'month'), [setLogsInRange]);

  const muscleBalance = useMemo(() => {
    const exerciseGroupWeightsById = Object.fromEntries(
      exercises.map((item) => [item.id, getMuscleGroupWeights(parseExerciseMeta(item.metadata))])
    );
    return computeMuscleGroupBalance(setLogsInRange, exerciseGroupWeightsById);
  }, [setLogsInRange, exercises]);

  return (
    <LensSurface title="Trends">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setRange(opt.key)}
              style={[
                styles.rangePill,
                { backgroundColor: range === opt.key ? palette.vermilionSoft : 'transparent' },
              ]}
            >
              <Text style={[styles.rangeText, { color: range === opt.key ? palette.vermilion : palette.textTertiary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <WorkoutFrequencyHeatmap days={heatmapDays} isDark={isDark} />
        <ExerciseProgressionChart
          exercises={exercisesWithLogs}
          points={progressionPoints}
          selectedExerciseId={selectedExerciseId}
          onSelectExercise={setSelectedExerciseId}
          weightUnit={selectedExerciseUnit}
          isDark={isDark}
        />
        <VolumeBarChart weeklyPeriods={weeklyVolume} monthlyPeriods={monthlyVolume} isDark={isDark} />
        <MuscleBalanceList groups={muscleBalance} isDark={isDark} />
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rangeText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
