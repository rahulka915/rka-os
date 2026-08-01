import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  applyManualOrder,
  finishWorkoutSession,
  getItemWithMetadata,
  getLastSessionSetsForExercise,
  getRelatedItems,
  getRelation,
  logWorkoutSet,
  startWorkoutSession,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { SetLogRow } from '../components/SetLogRow';
import { parseBlockMeta, formatBlockSummary } from '../utils/workoutBlock';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { formatSetSummary, type WorkoutSetDetails } from '../utils/workoutSet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

interface WorkoutSessionRouteParams {
  templateId?: string;
}

interface SessionExerciseRow {
  exerciseId: string;
  exerciseTitle: string;
  exerciseImageKey?: string;
  targetSummary?: string;
  loggedSets: WorkoutSetDetails[];
  lastSessionSets: WorkoutSetDetails[];
}

function buildRowFromExercise(exercise: Item, sessionId: string, targetSummary?: string): SessionExerciseRow {
  return {
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    exerciseImageKey: parseExerciseMeta(exercise.metadata).imageKey,
    targetSummary,
    loggedSets: [],
    lastSessionSets: getLastSessionSetsForExercise(exercise.id, sessionId),
  };
}

function buildRowsFromTemplate(templateId: string, sessionId: string): SessionExerciseRow[] {
  const blocks = applyManualOrder(`workout-template:${templateId}`, getRelatedItems(templateId, 'workout-template'));
  const rows: SessionExerciseRow[] = [];
  for (const block of blocks) {
    const exerciseId = getRelation(block.id, 'exercise');
    const exercise = exerciseId ? getItemWithMetadata(exerciseId) : null;
    if (!exercise) continue;
    rows.push(buildRowFromExercise(exercise, sessionId, formatBlockSummary(parseBlockMeta(block.metadata))));
  }
  return rows;
}

export function WorkoutSessionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { templateId } = (route.params as WorkoutSessionRouteParams) ?? {};
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const [sessionId] = useState(() => startWorkoutSession(templateId ?? null));
  const [rows, setRows] = useState<SessionExerciseRow[]>(() => (templateId ? buildRowsFromTemplate(templateId, sessionId) : []));
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickExercise = (exercise: Item) => {
    setPickerOpen(false);
    setRows((prev) => (prev.some((row) => row.exerciseId === exercise.id) ? prev : [...prev, buildRowFromExercise(exercise, sessionId)]));
  };

  const handleLogSet = (exerciseId: string, reps: number, weight: number) => {
    const row = rows.find((r) => r.exerciseId === exerciseId);
    if (!row) return;
    const setNumber = row.loggedSets.length + 1;
    logWorkoutSet({ sessionId, exerciseId, setNumber, reps, weight });
    const newSet: WorkoutSetDetails = { sessionId, setNumber, reps, weight, weightUnit: 'kg' };
    setRows((prev) =>
      prev.map((r) => (r.exerciseId === exerciseId ? { ...r, loggedSets: [...r.loggedSets, newSet] } : r))
    );
  };

  const handleFinish = useCallback(() => {
    const totalSets = rows.reduce((sum, row) => sum + row.loggedSets.length, 0);
    if (totalSets === 0) {
      Alert.alert('No sets logged', 'Log at least one set before finishing, or go back to discard this workout.');
      return;
    }
    finishWorkoutSession(sessionId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  }, [rows, sessionId, navigation]);

  return (
    <LensSurface
      title="Log Workout"
      headerRight={
        <TouchableOpacity onPress={handleFinish} hitSlop={12}>
          <Text style={[styles.finishText, { color: palette.deeperBlue }]}>Finish</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rows.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No exercises yet</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap "Add exercise" below to get started.</Text>
          </View>
        )}

        {rows.map((row) => (
          <View key={row.exerciseId} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
            <View style={styles.cardHeader}>
              <ExerciseThumbnail imageKey={row.exerciseImageKey} size={36} />
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{row.exerciseTitle}</Text>
                {row.targetSummary && (
                  <Text style={[styles.cardTarget, { color: palette.textTertiary }]} numberOfLines={1}>{row.targetSummary}</Text>
                )}
              </View>
            </View>

            {row.lastSessionSets.length > 0 && (
              <Text style={[styles.lastTime, { color: palette.textTertiary }]} numberOfLines={1}>
                Last time: {row.lastSessionSets.map(formatSetSummary).join(', ')}
              </Text>
            )}

            {row.loggedSets.map((set) => (
              <Text key={set.setNumber} style={[styles.loggedSet, { color: palette.textSecondary }]}>
                Set {set.setNumber} · {formatSetSummary(set)}
              </Text>
            ))}

            <SetLogRow
              setNumber={row.loggedSets.length + 1}
              initialReps={row.lastSessionSets[row.loggedSets.length] ? String(row.lastSessionSets[row.loggedSets.length].reps) : undefined}
              initialWeight={row.lastSessionSets[row.loggedSets.length] ? String(row.lastSessionSets[row.loggedSets.length].weight) : undefined}
              onLog={(reps, weight) => handleLogSet(row.exerciseId, reps, weight)}
            />
          </View>
        ))}

        <TouchableOpacity style={[styles.addRow, { borderColor: palette.separator }]} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
          <Plus size={18} color={palette.text} strokeWidth={2} />
          <Text style={[styles.addRowText, { color: palette.text }]}>Add exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <ExercisePickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickExercise} />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  finishText: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  cardTarget: { fontSize: 12, fontWeight: '500' },
  lastTime: { fontSize: 12, fontWeight: '500' },
  loggedSet: { fontSize: 13, fontWeight: '500' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', paddingVertical: 14 },
  addRowText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
