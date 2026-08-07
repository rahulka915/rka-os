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

  const now = Date.now();

  const heatmapDays = useMemo(() => {
    const sinceMs = now - HEATMAP_WEEKS * 7 * DAY_MS;
    const sessionDates = getWorkoutSessionDates(sinceMs);
    return computeFrequencyHeatmap(sessionDates, sinceMs, now);
  }, [now]);

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
    const sinceMs = now - VOLUME_WEEKS_WINDOW * 7 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, now), 'week').slice(-VOLUME_WEEKS_WINDOW);
  }, [now]);

  const monthlyVolume = useMemo(() => {
    const sinceMs = now - VOLUME_MONTHS_WINDOW * 31 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, now), 'month').slice(-VOLUME_MONTHS_WINDOW);
  }, [now]);

  const muscleBalance = useMemo(() => {
    const sinceMs = now - BALANCE_WINDOW_DAYS * DAY_MS;
    const logs = getWorkoutSetLogsInRange(sinceMs, now);
    const exerciseMuscleGroupById = Object.fromEntries(
      exercises.map((item) => [item.id, parseExerciseMeta(item.metadata).muscleGroup])
    );
    return computeMuscleGroupBalance(logs, exerciseMuscleGroupById);
  }, [now, exercises]);

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
