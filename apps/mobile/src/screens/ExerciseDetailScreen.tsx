import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemWithMetadata, getLastSessionSetsForExercise, getTemplatesForExercise, updateItemMetadata, updateItemTitle } from '../db/database';
import { parseExerciseMeta, formatExerciseSubtitle, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../utils/exerciseLibrary';
import { formatSetSummary, type WorkoutSetDetails } from '../utils/workoutSet';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { Pencil } from '../icons';
import type { Item } from '../db/types';

interface ExerciseDetailRouteParams {
  exerciseId: string;
}

export function ExerciseDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { exerciseId } = route.params as ExerciseDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const [item, setItem] = useState<Item | null>(null);
  const [templates, setTemplates] = useState<Item[]>([]);
  const [lastSets, setLastSets] = useState<WorkoutSetDetails[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    setItem(getItemWithMetadata(exerciseId));
    setTemplates(getTemplatesForExercise(exerciseId));
    setLastSets(getLastSessionSetsForExercise(exerciseId));
  }, [exerciseId]);

  useFocusEffect(load);

  const handleSubmit = (draft: ExerciseDraft) => {
    updateItemMetadata(exerciseId, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    if (item && draft.title !== item.title) {
      updateItemTitle(exerciseId, draft.title);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSheetOpen(false);
    load();
  };

  if (!item) {
    return <LensSurface title="Exercise"><View /></LensSurface>;
  }

  const meta = parseExerciseMeta(item.metadata);

  return (
    <LensSurface
      title={item.title}
      headerRight={
        <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={12} accessibilityLabel="Edit exercise">
          <Pencil size={19} color={palette.text} strokeWidth={1.75} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ExerciseThumbnail imageKey={meta.imageKey} size={200} />
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: palette.fill }]}>
            <Text style={[styles.badgeText, { color: palette.text }]}>{MUSCLE_GROUP_LABELS[meta.muscleGroup]}</Text>
          </View>
          {meta.equipment && (
            <View style={[styles.badge, { backgroundColor: palette.fill }]}>
              <Text style={[styles.badgeText, { color: palette.text }]}>{EQUIPMENT_LABELS[meta.equipment]}</Text>
            </View>
          )}
        </View>

        {meta.notes && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TIPS</Text>
            <Text style={[styles.tipsText, { color: palette.text }]}>{meta.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>USED IN</Text>
          {templates.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textTertiary }]}>Not used in any template yet</Text>
          ) : (
            templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateRow, { borderBottomColor: palette.separator }]}
                onPress={() => (navigation as any).navigate('WorkoutTemplateDetail', { templateId: template.id, title: template.title })}
              >
                <Text style={[styles.templateTitle, { color: palette.text }]} numberOfLines={1}>{template.title}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PROGRESS</Text>
          {lastSets.length === 0 ? (
            <View style={[styles.progressEmpty, { backgroundColor: palette.fill }]}>
              <Text style={[styles.progressEmptyText, { color: palette.textTertiary }]}>
                Log a workout to see stats and history here
              </Text>
            </View>
          ) : (
            <Text style={[styles.tipsText, { color: palette.text }]}>
              Last time: {lastSets.map(formatSetSummary).join(', ')}
            </Text>
          )}
        </View>
      </ScrollView>

      <ExerciseEditSheet
        visible={sheetOpen}
        initialValue={{ title: item.title, ...meta }}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  hero: { alignItems: 'center', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  badge: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tipsText: { fontFamily: 'Inter_400Regular', fontSize: 15, fontWeight: '400', lineHeight: 21 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400' },
  templateRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  templateTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  progressEmpty: { borderRadius: 14, paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center' },
  progressEmptyText: { fontFamily: 'Inter_500Medium', fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
