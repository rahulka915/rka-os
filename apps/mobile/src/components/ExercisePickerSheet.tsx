import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { ExerciseEditSheet, type ExerciseDraft } from './ExerciseEditSheet';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { groupExercisesByMovementFamily, filterExercisesByQuery, formatExerciseSubtitle, inferMovementFamily, parseExerciseMeta } from '../utils/exerciseLibrary';
import type { Item } from '../db/types';

interface ExercisePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Item) => void;
}

export function ExercisePickerSheet({ visible, onClose, onPick }: ExercisePickerSheetProps) {
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ movementFamily: 'other' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMovementFamily(exercises);
  }, [exercises, query]);

  const handlePick = (item: Item) => {
    Haptics.selectionAsync();
    setQuery('');
    onClose();
    onPick(item);
  };

  const handleCreateSubmit = (draft: ExerciseDraft) => {
    const id = createItem('exercise', draft.title, 'active');
    const movementFamily = draft.movementFamily ?? inferMovementFamily(draft.title);
    updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, movementFamily, notes: draft.notes, imageKey: draft.imageKey });
    refresh();
    const created: Item = {
      id,
      type: 'exercise',
      title: draft.title,
      status: 'active',
      metadata: JSON.stringify({ muscleGroup: draft.muscleGroup, equipment: draft.equipment, movementFamily, notes: draft.notes, imageKey: draft.imageKey }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCreateOpen(false);
    setQuery('');
    onClose();
    onPick(created);
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        isDark={isDark}
        title="Add Exercise"
        topAnchored
        scrollable
        sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
        contentContainerStyle={styles.content}
        headerLeft={
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        }
      >
        <TextInput
          style={[styles.search, { color: palette.text, borderColor: material.rim }]}
          placeholder="Search exercises..."
          placeholderTextColor={palette.textTertiary}
          value={query}
          onChangeText={setQuery}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
        <TouchableOpacity style={[styles.newRow, { borderColor: material.rim }]} onPress={() => setCreateOpen(true)}>
          <Text style={[styles.newRowText, { color: material.accent }]}>+ New Exercise</Text>
        </TouchableOpacity>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {groups.map((group) => (
            <View key={group.movementFamily + group.label} style={styles.sectionRows}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label.toUpperCase()}</Text>
              {group.exercises.map((item) => (
                <TouchableOpacity key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                  <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={36} />
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
      </BottomSheet>

      <ExerciseEditSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16, maxHeight: '80%' },
  content: { paddingBottom: spacing[5], flexGrow: 1 },
  actionText: { fontFamily: 'Inter_400Regular', fontSize: 16, fontWeight: '400' },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 8 },
  newRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  newRowText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  list: { maxHeight: 360 },
  sectionRows: { gap: 6, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500' },
});
