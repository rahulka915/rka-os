import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import ReorderableList from 'react-native-reorderable-list';
import {
  getRelatedItems,
  applyManualOrder,
  createItem,
  setRelation,
  getRelation,
  updateItemMetadata,
  deleteItem,
  getItemWithMetadata,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { DragHandleButton } from '../components/ui/DragHandleButton';
import { BlockEditSheet } from '../components/BlockEditSheet';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { useHapticReorder } from '../hooks/useHapticReorder';
import { parseBlockMeta, formatBlockSummary } from '../utils/workoutBlock';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { showActionSheet } from '../utils/actionSheet';
import { Play, Plus } from '../icons';
import type { Item } from '../db/types';

interface WorkoutTemplateDetailRouteParams {
  templateId: string;
  title: string;
}

interface BlockRow {
  block: Item;
  exerciseTitle: string;
  exerciseImageKey?: string;
}

export function WorkoutTemplateDetailScreen() {
  const route = useRoute();
  const { templateId, title } = route.params as WorkoutTemplateDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const navigation = useNavigation();
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BlockRow | null>(null);

  const listKey = `workout-template:${templateId}`;

  const refresh = useCallback(() => {
    const blocks = applyManualOrder(listKey, getRelatedItems(templateId, 'workout-template'));
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
  }, [templateId, listKey]);

  useFocusEffect(refresh);

  const { onDragStart, onIndexChange, onReorder } = useHapticReorder(
    listKey,
    rows.map((r) => r.block),
    (nextBlocks) => {
      const byId = new Map(rows.map((r) => [r.block.id, r]));
      setRows(nextBlocks.map((b) => byId.get(b.id)!));
    },
  );

  const handlePickExercise = (exercise: Item) => {
    const blockId = createItem('workout-block', exercise.title, 'active');
    setRelation(blockId, 'exercise', exercise.id);
    setRelation(blockId, 'workout-template', templateId);
    updateItemMetadata(blockId, {});
    refresh();
    const block = getItemWithMetadata(blockId);
    if (block) setEditingBlock({ block, exerciseTitle: exercise.title });
  };

  const handleBlockSave = (meta: ReturnType<typeof parseBlockMeta>) => {
    if (!editingBlock) return;
    updateItemMetadata(editingBlock.block.id, meta);
    setEditingBlock(null);
    refresh();
  };

  const handleLongPress = (row: BlockRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(row.exerciseTitle, [
      { label: 'Edit', onPress: () => setEditingBlock(row) },
      {
        label: 'Remove from template',
        destructive: true,
        onPress: () => {
          deleteItem(row.block.id);
          refresh();
        },
      },
    ]);
  };

  const renderRow = ({ item }: { item: Item }) => {
    const row = rows.find((r) => r.block.id === item.id);
    if (!row) return null;
    return (
      <View style={styles.cell}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: isDark ? palette.separatorStrong : palette.separator }]}
          activeOpacity={0.75}
          onPress={() => setEditingBlock(row)}
          onLongPress={() => handleLongPress(row)}
          delayLongPress={400}
        >
          <ExerciseThumbnail imageKey={row.exerciseImageKey} size={36} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.exerciseTitle}</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
              {formatBlockSummary(parseBlockMeta(row.block.metadata))}
            </Text>
          </View>
          <DragHandleButton color={palette.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <LensSurface
      title={title}
      headerRight={
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('WorkoutSession', { templateId })}
            hitSlop={12}
            accessibilityLabel="Start workout"
          >
            <Play size={22} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={12} accessibilityLabel="Add exercise to template">
            <Plus size={22} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      }
    >
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No exercises yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap + to add one.</Text>
        </View>
      ) : (
        <ReorderableList
          data={rows.map((r) => r.block)}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={renderRow}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ExercisePickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickExercise} />

      <BlockEditSheet
        visible={!!editingBlock}
        exerciseTitle={editingBlock?.exerciseTitle ?? ''}
        initialValue={editingBlock ? parseBlockMeta(editingBlock.block.metadata) : undefined}
        onClose={() => setEditingBlock(null)}
        onSubmit={handleBlockSave}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  cell: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400' },
});
