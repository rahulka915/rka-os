import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import {
  groupExercisesByMuscle,
  filterExercisesByQuery,
  pickGroupThumbnailImageKey,
  parseExerciseMeta,
  formatExerciseSubtitle,
  type MuscleGroup,
} from '../utils/exerciseLibrary';
import { STARTER_EXERCISES } from '../utils/starterExercises';
import { MuscleGroupCard } from './MuscleGroupCard.web';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { ExerciseDetailPanel } from './ExerciseDetailPanel.web';
import { ExerciseEditForm } from './ExerciseEditForm.web';
import { DetailPanel } from './DetailPanel';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface ExerciseLibraryScreenProps {
  onOpenTemplate: (templateId: string, title: string) => void;
}

export function ExerciseLibraryScreen({ onOpenTemplate }: ExerciseLibraryScreenProps) {
  const { exercises, refresh } = useExercises();
  const [query, setQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'create' | 'edit'>('detail');

  const groups = useMemo(() => groupExercisesByMuscle(exercises), [exercises]);
  const searchResults = useMemo(() => (query.trim() ? filterExercisesByQuery(exercises, query) : null), [exercises, query]);
  const groupExercises = useMemo(
    () => (selectedMuscleGroup ? groups.find((g) => g.muscleGroup === selectedMuscleGroup)?.exercises ?? [] : []),
    [groups, selectedMuscleGroup],
  );
  const selectedItem = exercises.find((e) => e.id === selectedId) ?? null;

  const submitEdit = (draft: ExerciseDraft) => {
    if (mode === 'edit' && selectedItem) {
      updateItemMetadata(selectedItem.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== selectedItem.title) updateItemTitle(selectedItem.id, draft.title);
      setMode('detail');
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      setSelectedId(null);
    }
    refresh();
  };

  const addStarters = () => {
    for (const starter of STARTER_EXERCISES) {
      const id = createItem('exercise', starter.title, 'active');
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment, imageKey: starter.imageKey });
    }
    refresh();
  };

  const rows = searchResults ?? groupExercises;
  const showingRows = !!searchResults || !!selectedMuscleGroup;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        <Pressable onPress={() => { setMode('create'); setSelectedId(null); }} style={styles.addButton}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      {exercises.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No exercises yet</Text>
          <Pressable onPress={addStarters} style={styles.startersButton}>
            <Text style={styles.startersButtonText}>Add starter exercises</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.search}
          />

          {showingRows ? (
            <View>
              {!searchResults && selectedMuscleGroup ? (
                <Pressable onPress={() => setSelectedMuscleGroup(null)}>
                  <Text style={styles.backLink}>‹ Back to groups</Text>
                </Pressable>
              ) : null}
              <View style={styles.rowsList}>
                {rows.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => { setSelectedId(item.id); setMode('detail'); }}
                  >
                    <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={36} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>{formatExerciseSubtitle(parseExerciseMeta(item.metadata))}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.grid}>
              {groups.map((group) => (
                <MuscleGroupCard
                  key={group.muscleGroup}
                  label={group.label}
                  count={group.exercises.length}
                  imageKey={pickGroupThumbnailImageKey(group)}
                  onPress={() => setSelectedMuscleGroup(group.muscleGroup)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <DetailPanel
        visible={mode === 'create' || (!!selectedItem && (mode === 'detail' || mode === 'edit'))}
        onClose={() => { setSelectedId(null); setMode('detail'); }}
        title={mode === 'create' ? 'New Exercise' : mode === 'edit' ? 'Edit Exercise' : 'Exercise'}
      >
        {mode === 'create' ? (
          <ExerciseEditForm onSubmit={submitEdit} onCancel={() => setMode('detail')} />
        ) : mode === 'edit' && selectedItem ? (
          <ExerciseEditForm
            initialValue={{ title: selectedItem.title, ...parseExerciseMeta(selectedItem.metadata) }}
            onSubmit={submitEdit}
            onCancel={() => setMode('detail')}
          />
        ) : selectedItem ? (
          <ExerciseDetailPanel
            item={selectedItem}
            onEdit={() => setMode('edit')}
            onOpenTemplate={(templateId, title) => {
              setSelectedId(null);
              onOpenTemplate(templateId, title);
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: { fontSize: webFontSize.xl, fontWeight: '700', color: webColors.foreground },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  content: { paddingBottom: webSpacing[6] },
  search: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  backLink: { fontSize: webFontSize.sm, color: webColors.accent, fontWeight: '600', marginBottom: webSpacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing[3] },
  rowsList: { gap: webSpacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.base, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: webSpacing[3] },
  emptyTitle: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  startersButton: { backgroundColor: webColors.accent, borderRadius: webRadius.sm, paddingHorizontal: webSpacing[4], paddingVertical: webSpacing[3] },
  startersButtonText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.card },
});
