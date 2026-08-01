import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata } from '../db/database';
import { groupExercisesByMuscle, filterExercisesByQuery, formatExerciseSubtitle, parseExerciseMeta } from '../utils/exerciseLibrary';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { ExerciseEditForm } from './ExerciseEditForm.web';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Item) => void;
}

export function ExercisePickerModal({ visible, onClose, onPick }: ExercisePickerModalProps) {
  const { exercises, refresh } = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ muscleGroup: 'full-body' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMuscle(exercises);
  }, [exercises, query]);

  if (!visible) return null;

  const handlePick = (item: Item) => {
    setQuery('');
    setCreating(false);
    onClose();
    onPick(item);
  };

  const handleCreateSubmit = (draft: ExerciseDraft) => {
    const id = createItem('exercise', draft.title, 'active');
    updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    refresh();
    const created: Item = {
      id,
      type: 'exercise',
      title: draft.title,
      status: 'active',
      metadata: JSON.stringify({ muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCreating(false);
    setQuery('');
    onClose();
    onPick(created);
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.dialog}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{creating ? 'New Exercise' : 'Add Exercise'}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {creating ? (
          <ExerciseEditForm onSubmit={handleCreateSubmit} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.search}
            />
            <Pressable onPress={() => setCreating(true)} style={styles.newRow}>
              <Text style={styles.newRowText}>+ New Exercise</Text>
            </Pressable>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.muscleGroup + group.label} style={styles.sectionRows}>
                  <Text style={styles.sectionLabel}>{group.label.toUpperCase()}</Text>
                  {group.exercises.map((item) => (
                    <Pressable key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                      <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={32} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>{formatExerciseSubtitle(parseExerciseMeta(item.metadata))}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  dialog: {
    width: 420,
    maxHeight: '80%',
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  headerTitle: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  search: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[3],
  },
  newRow: {
    borderWidth: 1,
    borderColor: webColors.border,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    marginBottom: webSpacing[3],
  },
  newRowText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.accent },
  list: { maxHeight: 360 },
  sectionRows: { gap: webSpacing[2], marginBottom: webSpacing[4] },
  sectionLabel: { fontSize: webFontSize.xs, fontWeight: '700', color: webColors.mutedForeground, letterSpacing: 0.5, marginBottom: webSpacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: webSpacing[2], paddingVertical: webSpacing[2] },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
});
