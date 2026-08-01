import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { groupExercisesByMuscle, filterExercisesByQuery, formatExerciseSubtitle, parseExerciseMeta } from '../utils/exerciseLibrary';
import { STARTER_EXERCISES } from '../utils/starterExercises';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

export function ExerciseLibraryScreen() {
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ muscleGroup: 'full-body' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMuscle(exercises);
  }, [exercises, query]);

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
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
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

  const addStarters = () => {
    for (const starter of STARTER_EXERCISES) {
      const id = createItem('exercise', starter.title, 'active');
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment, imageKey: starter.imageKey });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  return (
    <LensSurface
      title="Exercise Library"
      headerRight={
        <TouchableOpacity onPress={openCreate} hitSlop={12} accessibilityLabel="Add exercise">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      {exercises.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No exercises yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Add your own, or start from a common set.</Text>
          <TouchableOpacity style={[styles.primaryCard, { backgroundColor: palette.text }]} onPress={addStarters} activeOpacity={0.85}>
            <Text style={[styles.primaryCardText, { color: palette.bg }]}>Add starter exercises</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} hitSlop={8}>
            <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Add one manually →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.search, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.separator }]}
            placeholder="Search exercises..."
            placeholderTextColor={palette.textTertiary}
            value={query}
            onChangeText={setQuery}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
          {groups.map((group) => (
            <View key={group.muscleGroup + group.label} style={styles.sectionRows}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label.toUpperCase()}</Text>
              {group.exercises.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => openEdit(item)}
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
      )}

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
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  sectionRows: { gap: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontWeight: '400', textAlign: 'center', marginBottom: 8 },
  primaryCard: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginTop: 8 },
  primaryCardText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  linkText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', marginTop: 8 },
});
