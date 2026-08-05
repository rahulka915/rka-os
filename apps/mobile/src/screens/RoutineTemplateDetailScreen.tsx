import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import ReorderableList from 'react-native-reorderable-list';
import { getRoutineSteps, addRoutineStep, updateItem, updateRoutineStep, deleteItem, startRoutineSession, getActiveRoutineSession } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { DragHandleButton } from '../components/ui/DragHandleButton';
import { RoutineStepEditSheet } from '../components/RoutineStepEditSheet';
import { useHapticReorder } from '../hooks/useHapticReorder';
import { parseRoutineStepMeta } from '../utils/routineMeta';
import { showActionSheet } from '../utils/actionSheet';
import { PlayCircle, Plus } from '../icons';
import type { Item } from '../db/types';

interface RoutineTemplateDetailRouteParams {
  routineId: string;
  title: string;
}

function formatStepSummary(meta: ReturnType<typeof parseRoutineStepMeta>): string {
  if (!meta.durationSeconds) return 'Manual step';
  const minutes = Math.floor(meta.durationSeconds / 60);
  const seconds = meta.durationSeconds % 60;
  const time = minutes > 0 ? `${minutes}m ${seconds ? `${seconds}s` : ''}`.trim() : `${seconds}s`;
  return meta.autoAdvance ? `${time} · auto-advance` : time;
}

export function RoutineTemplateDetailScreen() {
  const route = useRoute();
  const { routineId, title } = route.params as RoutineTemplateDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const navigation = useNavigation();
  const [steps, setSteps] = useState<Item[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingStep, setEditingStep] = useState<Item | null>(null);

  const listKey = `routine:${routineId}`;

  const refresh = useCallback(() => {
    setSteps(getRoutineSteps(routineId));
  }, [routineId]);

  useFocusEffect(refresh);

  const { onDragStart, onIndexChange, onReorder } = useHapticReorder(listKey, steps, setSteps);

  const handleStart = () => {
    const existing = getActiveRoutineSession(routineId);
    const sessionId = existing?.id;
    (navigation as any).navigate('RoutineSession', { routineId, sessionId });
  };

  const handleSaveStep = (stepTitle: string, meta: ReturnType<typeof parseRoutineStepMeta>) => {
    if (editingStep) {
      updateItem(editingStep.id, { title: stepTitle });
      updateRoutineStep(editingStep.id, meta);
    } else {
      addRoutineStep(routineId, stepTitle, meta);
    }
    setEditingStep(null);
    refresh();
  };

  const handleLongPress = (step: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(step.title, [
      { label: 'Edit', onPress: () => setEditingStep(step) },
      {
        label: 'Remove step',
        destructive: true,
        onPress: () => {
          deleteItem(step.id);
          refresh();
        },
      },
    ]);
  };

  const renderRow = ({ item }: { item: Item }) => {
    const meta = parseRoutineStepMeta(item.metadata);
    return (
      <View style={styles.cell}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: isDark ? palette.separatorStrong : palette.separator }]}
          activeOpacity={0.75}
          onPress={() => setEditingStep(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>{formatStepSummary(meta)}</Text>
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
          <TouchableOpacity onPress={handleStart} hitSlop={12} accessibilityLabel="Start routine">
            <PlayCircle size={22} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCreating(true)} hitSlop={12} accessibilityLabel="Add step">
            <Plus size={22} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      }
    >
      {steps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No steps yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap + to add one.</Text>
        </View>
      ) : (
        <ReorderableList
          data={steps}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={renderRow}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <RoutineStepEditSheet
        visible={creating || editingStep !== null}
        stepTitle={editingStep?.title ?? ''}
        initialValue={editingStep ? parseRoutineStepMeta(editingStep.metadata) : undefined}
        onClose={() => { setCreating(false); setEditingStep(null); }}
        onSubmit={handleSaveStep}
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
