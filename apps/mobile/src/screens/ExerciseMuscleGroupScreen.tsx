import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { groupExercisesByMuscle, groupExercisesByMovementFamily, inferMovementFamily, formatExerciseSubtitle, parseExerciseMeta, type MuscleGroup } from '../utils/exerciseLibrary';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

interface ExerciseMuscleGroupRouteParams {
  muscleGroup: MuscleGroup;
  label: string;
}

export function ExerciseMuscleGroupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { muscleGroup, label } = route.params as ExerciseMuscleGroupRouteParams;
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const groupExercises = useMemo(() => {
    const group = groupExercisesByMuscle(exercises).find((g) => g.muscleGroup === muscleGroup);
    return group?.exercises ?? [];
  }, [exercises, muscleGroup]);
  const familyGroups = useMemo(() => groupExercisesByMovementFamily(groupExercises), [groupExercises]);

  const openCreate = () => {
    setEditTarget(null);
    setSheetOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditTarget(item);
    setSheetOpen(true);
  };

  const handleSubmit = (draft: ExerciseDraft) => {
    if (editTarget) {
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, movementFamily: draft.movementFamily ?? inferMovementFamily(draft.title), notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, movementFamily: draft.movementFamily ?? inferMovementFamily(draft.title), notes: draft.notes, imageKey: draft.imageKey });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(item.title, [
      { label: 'Edit', onPress: () => openEdit(item) },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <LensSurface
      title={label}
      headerRight={
        <TouchableOpacity onPress={openCreate} hitSlop={12} accessibilityLabel="Add exercise">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {familyGroups.map((family) => (
          <View key={family.movementFamily} style={styles.familySection}>
            <View style={styles.familyHeader}>
              <Text style={[styles.familyTitle, { color: palette.textSecondary }]}>{family.label.toUpperCase()}</Text>
              <Text style={[styles.familyCount, { color: palette.textTertiary }]}>{family.exercises.length} variation{family.exercises.length === 1 ? '' : 's'}</Text>
            </View>
            {family.exercises.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: palette.surface }]}
                activeOpacity={0.7}
                onPress={() => (navigation as any).navigate('ExerciseDetail', { exerciseId: item.id })}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
                <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                    {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <ExerciseEditSheet
        visible={sheetOpen}
        initialValue={editTarget ? { title: editTarget.title, ...parseExerciseMeta(editTarget.metadata) } : undefined}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  familySection: { gap: 8, marginBottom: 12 },
  familyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  familyTitle: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  familyCount: { fontSize: 11, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500' },
});
