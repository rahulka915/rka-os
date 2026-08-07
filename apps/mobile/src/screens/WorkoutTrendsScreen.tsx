// apps/mobile/src/screens/WorkoutTrendsScreen.tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { LensSurface } from '../components/LensSurface';
import { WorkoutFrequencyHeatmap } from '../components/workouts/WorkoutFrequencyHeatmap';
import { ExerciseProgressionChart } from '../components/workouts/ExerciseProgressionChart';
import { VolumeBarChart } from '../components/workouts/VolumeBarChart';
import { MuscleBalanceList } from '../components/workouts/MuscleBalanceList';
import { useThemeContext } from '../hooks/useThemeContext';
import { useExercises } from '../hooks/useDb';
import { getWorkoutSessionDates, getExerciseSetLogHistory, getWorkoutSetLogsInRange } from '../db/database';
import {
  computeFrequencyHeatmap,
  computeExerciseProgression,
  computeVolumeByPeriod,
  computeMuscleGroupBalance,
} from '../utils/workoutTrends';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { parseSetLogDetails } from '../utils/workoutSet';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 16;
const VOLUME_WEEKS_WINDOW = 12;
const VOLUME_MONTHS_WINDOW = 6;
const BALANCE_WINDOW_DAYS = 30;

export function WorkoutTrendsScreen() {
  const { isDark } = useThemeContext();
  const { exercises } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

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

  const heatmapDays = useMemo(() => {
    const sinceMs = referenceNow - HEATMAP_WEEKS * 7 * DAY_MS;
    return computeFrequencyHeatmap(allSessionDates, sinceMs, referenceNow);
  }, [allSessionDates, referenceNow]);

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

  const weeklyVolume = useMemo(() => {
    const sinceMs = referenceNow - VOLUME_WEEKS_WINDOW * 7 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, referenceNow), 'week').slice(-VOLUME_WEEKS_WINDOW);
  }, [referenceNow]);

  const monthlyVolume = useMemo(() => {
    const sinceMs = referenceNow - VOLUME_MONTHS_WINDOW * 31 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, referenceNow), 'month').slice(-VOLUME_MONTHS_WINDOW);
  }, [referenceNow]);

  const muscleBalance = useMemo(() => {
    const sinceMs = referenceNow - BALANCE_WINDOW_DAYS * DAY_MS;
    const logs = getWorkoutSetLogsInRange(sinceMs, referenceNow);
    const exerciseMuscleGroupById = Object.fromEntries(
      exercises.map((item) => [item.id, parseExerciseMeta(item.metadata).muscleGroup])
    );
    return computeMuscleGroupBalance(logs, exerciseMuscleGroupById);
  }, [referenceNow, exercises]);

  return (
    <LensSurface title="Trends">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
});
