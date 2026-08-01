import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, Plus } from 'lucide-react-native';
import {
  getRelatedItems,
  applyManualOrder,
  setManualOrder,
  createItem,
  setRelation,
  getRelation,
  updateItemMetadata,
  deleteItem,
  getItemWithMetadata,
} from '../db/database';
import { parseBlockMeta, formatBlockSummary, type WorkoutBlockMeta } from '../utils/workoutBlock';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { useDbRefresh } from '../hooks/useDb';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { BlockEditForm } from './BlockEditForm.web';
import { ExercisePickerModal } from './ExercisePickerModal.web';
import { useDraggableRef, useDropZoneRef, useMergeRefs } from './hooks/useDomDragAndDrop';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface WorkoutTemplateDetailPanelProps {
  item: Item;
  onEditDetails: () => void;
}

interface BlockRow {
  block: Item;
  exerciseTitle: string;
  exerciseImageKey?: string;
}

interface BlockRowItemProps {
  row: BlockRow;
  onPress: () => void;
  onReorderDrop: (draggedId: string) => void;
}

function BlockRowItem({ row, onPress, onReorderDrop }: BlockRowItemProps) {
  const [hovering, setHovering] = useState(false);
  const dragRef = useDraggableRef(row.block.id);
  const dropRef = useDropZoneRef(onReorderDrop, setHovering);
  const mergedRef = useMergeRefs(dragRef, dropRef);

  return (
    <Pressable ref={mergedRef} style={[styles.row, hovering && styles.rowHovering]} onPress={onPress}>
      <ExerciseThumbnail imageKey={row.exerciseImageKey} size={32} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{row.exerciseTitle}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{formatBlockSummary(parseBlockMeta(row.block.metadata))}</Text>
      </View>
    </Pressable>
  );
}

export function WorkoutTemplateDetailPanel({ item, onEditDetails }: WorkoutTemplateDetailPanelProps) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const listKey = `workout-template:${item.id}`;

  const refresh = useCallback(() => {
    const blocks = applyManualOrder(listKey, getRelatedItems(item.id, 'workout-template'));
    const nextRows: BlockRow[] = blocks.map((block) => {
      const exerciseId = getRelation(block.id, 'exercise');
      const exercise = exerciseId ? getItemWithMetadata(exerciseId) : null;
      return {
        block,
        exerciseTitle: exercise?.title ?? block.title,
        exerciseImageKey: exercise ? parseExerciseMeta(exercise.metadata).imageKey : undefined,
      };
    });
    setRows(nextRows);
  }, [item.id, listKey]);

  useDbRefresh(refresh);

  const editingRow = rows.find((r) => r.block.id === editingBlockId) ?? null;

  const handlePickExercise = (exercise: Item) => {
    const blockId = createItem('workout-block', exercise.title, 'active');
    setRelation(blockId, 'exercise', exercise.id);
    setRelation(blockId, 'workout-template', item.id);
    updateItemMetadata(blockId, {});
    refresh();
    setEditingBlockId(blockId);
  };

  const handleBlockSave = (meta: WorkoutBlockMeta) => {
    if (!editingBlockId) return;
    updateItemMetadata(editingBlockId, meta);
    setEditingBlockId(null);
    refresh();
  };

  const handleBlockDelete = () => {
    if (!editingBlockId) return;
    deleteItem(editingBlockId);
    setEditingBlockId(null);
    refresh();
  };

  const handleReorderDrop = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = rows.map((r) => r.block.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    setManualOrder(listKey, next);
    refresh();
  };

  if (editingRow) {
    return (
      <BlockEditForm
        exerciseTitle={editingRow.exerciseTitle}
        initialValue={parseBlockMeta(editingRow.block.metadata)}
        onSubmit={handleBlockSave}
        onCancel={() => setEditingBlockId(null)}
        onDelete={handleBlockDelete}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEditDetails} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No exercises yet. Tap + to add one.</Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <BlockRowItem
              key={row.block.id}
              row={row}
              onPress={() => setEditingBlockId(row.block.id)}
              onReorderDrop={(draggedId) => handleReorderDrop(draggedId, row.block.id)}
            />
          ))}
        </ScrollView>
      )}

      <Pressable onPress={() => setPickerOpen(true)} style={styles.addButton}>
        <Plus size={16} color={webColors.card} strokeWidth={2} />
        <Text style={styles.addButtonText}>Add exercise</Text>
      </Pressable>

      <ExercisePickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickExercise} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: webSpacing[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground, flex: 1, marginRight: webSpacing[3] },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  emptyText: { fontSize: webFontSize.sm, color: webColors.mutedForeground },
  list: { gap: webSpacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  rowHovering: { borderColor: webColors.accent, backgroundColor: `${webColors.accent}1A` },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
  },
  addButtonText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.card },
});
