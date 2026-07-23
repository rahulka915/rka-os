import { useCallback, useEffect, useState, memo } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import ReorderableList from 'react-native-reorderable-list';
import { getRelatedItems, getBlockingTask, applyManualOrder, updateItemStatus, deleteItem, planForToday, unplanToday, isPlannedForToday } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import { DragHandleButton } from '../components/ui/DragHandleButton';
import type { Item } from '../db/types';
import { useItemComposer } from '../components/item-composer';
import { BlockedBadge } from '../components/BlockedBadge';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { RepeatBadge } from '../components/RepeatBadge';
import { DependencyConnector } from '../components/DependencyConnector';
import { promptSetDependency } from '../utils/dependencyPrompt';
import { useHapticReorder } from '../hooks/useHapticReorder';
import { readChecklist, checklistProgress } from '../utils/checklist';

// Item-local, so it never makes a row's height depend on list position.
function checklistLabel(item: Item): string | null {
  const entries = readChecklist(item.metadata ? JSON.parse(item.metadata) : {});
  if (!entries.length) return null;
  const { done, total } = checklistProgress(entries);
  return `${done}/${total}`;
}

const CHECKBOX_CENTER_X = 32; // row paddingHorizontal(10) + half the 44pt disc touch target

interface ProjectDetailRouteParams {
  projectId: string;
  title: string;
}

const ProjectTaskRow = memo(function ProjectTaskRow({
  item,
  isDark,
  palette,
  cardBg,
  cardBorder,
  showConnector,
  isCompleting,
  onComplete,
  onOpen,
  onLongPress,
}: {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  cardBg: string;
  cardBorder: string;
  showConnector: boolean;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onLongPress: (item: Item) => void;
}) {
  const blocker = getBlockingTask(item.id);
  return (
    <View style={styles.cell}>
      {showConnector && <DependencyConnector isDark={isDark} leftOffset={CHECKBOX_CENTER_X} />}
      <View style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <LacquerDiscControl
          isCompleted={isCompleting}
          accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
          onToggle={() => onComplete(item)}
        />
        <TouchableOpacity
          style={styles.rowContent}
          activeOpacity={0.75}
          onPress={() => onOpen(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={400}
        >
          <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
          {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
          {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
          {checklistLabel(item) && (
            <Text style={[styles.rowTitle, { color: palette.textTertiary, fontSize: 12 }]}>{checklistLabel(item)}</Text>
          )}
        </TouchableOpacity>
        <DragHandleButton color={palette.textMuted} />
      </View>
    </View>
  );
});

// No header "+" here — adding a task to this project is the dock FAB's job
// (see App.tsx, which detects this route by name and pre-fills
// the project relation + active status). A second create button here would
// just duplicate that same underlying action.
export function ProjectDetailScreen() {
  const route = useRoute();
  const { projectId, title } = route.params as ProjectDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem, revision: composerRevision } = useItemComposer();
  const [tasks, setTasks] = useState<Item[]>([]);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const listKey = `project:${projectId}`;

  const refresh = useCallback(() => {
    setTasks(applyManualOrder(listKey, getRelatedItems(projectId, 'project')));
  }, [projectId, listKey]);

  const { isReordering, onDragStart, onIndexChange, onReorder } = useHapticReorder(listKey, tasks, setTasks);

  useFocusEffect(refresh);

  useEffect(() => {
    refresh();
  }, [composerRevision, refresh]);

  const handleComplete = (item: Item) => {
    if (completingIds.has(item.id)) return;
    const blocker = getBlockingTask(item.id);
    if (blocker) {
      Alert.alert('Blocked', `Complete "${blocker.title}" first.`, [{ text: 'OK' }]);
      return;
    }
    setCompletingIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'completed');
      refresh();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEditorForItem({
        item,
        context: { projectId, projectTitle: title },
        onComplete: ({ action }) => {
          if (action !== 'cancelled') refresh();
        },
      }) },
      { text: 'Complete', onPress: () => handleComplete(item) },
      {
        text: isPlannedForToday(item) ? 'Remove from Today' : 'Add to Today',
        onPress: () => {
          isPlannedForToday(item) ? unplanToday(item.id) : planForToday(item.id);
          refresh();
        },
      },
      { text: 'Depends on...', onPress: () => promptSetDependency(item, tasks, refresh) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  const renderRow = ({ item }: { item: Item }) => {
    const index = tasks.findIndex((t) => t.id === item.id);
    const prevItem = tasks[index - 1];
    const blocker = getBlockingTask(item.id);
    const prevBlocksThis = !!blocker && !!prevItem && blocker.id === prevItem.id;
    const thisBlocksPrev = !!prevItem && getBlockingTask(prevItem.id)?.id === item.id;
    return (
      <ProjectTaskRow
        item={item}
        isDark={isDark}
        palette={palette}
        cardBg={cardBg}
        cardBorder={cardBorder}
        showConnector={!isReordering && (prevBlocksThis || thisBlocksPrev)}
        isCompleting={completingIds.has(item.id)}
        onComplete={handleComplete}
        onOpen={(t) => openEditorForItem({
          item: t,
          context: { projectId, projectTitle: title },
          onComplete: ({ action }) => { if (action !== 'cancelled') refresh(); },
        })}
        onLongPress={handleLongPress}
      />
    );
  };

  return (
    <LensSurface title={title}>
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap the + in the dock to add one here</Text>
        </View>
      ) : (
        <ReorderableList
          data={tasks}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={renderRow}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Uniform gap on EVERY cell (was a conditional spacer) so row height never
  // depends on list order — the connector that used to occupy this space is
  // now a zero-layout overlay. position:relative anchors that overlay.
  cell: {
    position: 'relative',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowActive: {
    opacity: 0.9,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
});
