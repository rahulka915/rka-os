import { useEffect, useState, memo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScrollViewContainer, NestedReorderableList } from 'react-native-reorderable-list';
import { useTasks, useProjects, useCompletedItems } from '../hooks/useDb';
import { deleteItem, updateItemStatus, setRelation, getRelation, getBlockingTask, applyManualOrder, planForToday, unplanToday, isPlannedForToday } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { RiverStoneSurface } from '../components/riverstone';
import { CheckCircle2 } from '../icons';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import { DragHandleButton } from '../components/ui/DragHandleButton';
import { groupCompletedByDay } from '../utils/completedGrouping';
import type { Item } from '../db/types';
import { useItemComposer } from '../components/item-composer';
import { BlockedBadge } from '../components/BlockedBadge';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { RepeatBadge } from '../components/RepeatBadge';
import { DependencyConnector } from '../components/DependencyConnector';
import { promptSetDependency } from '../utils/dependencyPrompt';
import { showActionSheet } from '../utils/actionSheet';
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

type TasksTab = 'tasks' | 'logbook';

const TaskRow = memo(function TaskRow({
  item,
  isDark,
  palette,
  projectTitle,
  showConnector,
  isCompleting,
  onComplete,
  onOpen,
  onLongPress,
}: {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  projectTitle: string | null;
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
      <RiverStoneSurface
        variant="list"
        mode={isDark ? 'dark' : 'light'}
        shape="regular"
        style={styles.rowStone}
        contentStyle={styles.row}
      >
        <LacquerDiscControl
          isCompleted={isCompleting}
          accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
          onToggle={() => onComplete(item)}
        />
        <TouchableOpacity
          style={styles.rowContent}
          activeOpacity={0.7}
          onPress={() => onOpen(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={400}
        >
          <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.ivory }]} numberOfLines={1}>{item.title}</Text>
          {projectTitle && (
            <Text style={[styles.rowSub, { color: palette.greige }]} numberOfLines={1}>{projectTitle}</Text>
          )}
          {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
          {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
          {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
          {checklistLabel(item) && (
            <Text style={[styles.rowSub, { color: palette.greige }]}>{checklistLabel(item)}</Text>
          )}
        </TouchableOpacity>
        <DragHandleButton color={palette.textMuted} />
      </RiverStoneSurface>
    </View>
  );
});

// No header "+" here — creating a plain task is identical to the dock FAB's
// default action (see App.tsx, which defaults to status:
// 'active' when focused on this screen). A second create entry point here
// would just be a second button for the same underlying action.
export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { items: completedItems, refresh: refreshCompleted } = useCompletedItems();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem, revision: composerRevision } = useItemComposer();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');

  useEffect(() => {
    refresh();
    refreshCompleted();
  }, [composerRevision, refresh, refreshCompleted]);

  // Local, manually-orderable copies of the two sections — re-derived from
  // `tasks` (owned by useTasks) whenever it changes, then drag-reordered
  // in place via useHapticReorder, same pattern as ProjectDetailScreen.
  const [active, setActive] = useState<Item[]>([]);
  const [someday, setSomeday] = useState<Item[]>([]);

  useEffect(() => {
    setActive(applyManualOrder('tasks:active', tasks.filter(t => t.status !== 'someday')));
    setSomeday(applyManualOrder('tasks:someday', tasks.filter(t => t.status === 'someday')));
  }, [tasks]);

  const activeReorder = useHapticReorder('tasks:active', active, setActive);
  const somedayReorder = useHapticReorder('tasks:someday', someday, setSomeday);

  const getProjectTitle = (item: Item): string | null => {
    const id = getRelation(item.id, 'project');
    return id ? projects.find(p => p.id === id)?.title ?? null : null;
  };

  const promptSetProject = (item: Item) => {
    if (projects.length === 0) {
      Alert.alert('No missions yet', 'Create a mission first, then assign tasks to it.');
      return;
    }
    const currentProjectId = getRelation(item.id, 'project');
    showActionSheet('Move to mission', [
      ...(currentProjectId ? [{ label: 'Remove from mission', onPress: () => { setRelation(item.id, 'project', null); refresh(); } }] : []),
      ...projects.map(p => ({
        label: p.title,
        onPress: () => {
          setRelation(item.id, 'project', p.id);
          refresh();
        },
      })),
    ]);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const moveLabel = item.status === 'someday' ? 'Move to Active' : 'Move to Someday';
    const plannedToday = isPlannedForToday(item);
    showActionSheet(item.title, [
      { label: 'Edit', onPress: () => openEditorForItem({
        item,
        onComplete: ({ action }) => {
          if (action !== 'cancelled') {
            refresh();
            refreshCompleted();
          }
        },
      }) },
      { label: 'Complete', onPress: () => handleComplete(item) },
      {
        label: plannedToday ? 'Remove from Today' : 'Add to Today',
        onPress: () => {
          plannedToday ? unplanToday(item.id) : planForToday(item.id);
          refresh();
        },
      },
      {
        label: moveLabel,
        onPress: () => {
          updateItemStatus(item.id, item.status === 'someday' ? 'active' : 'someday');
          refresh();
        },
      },
      { label: 'Move to Mission...', onPress: () => promptSetProject(item) },
      { label: 'Depends on...', onPress: () => promptSetDependency(item, tasks, refresh) },
      {
        label: 'Delete',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
        destructive: true,
      },
    ]);
  };

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
      refreshCompleted();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const handleRestore = (item: Item) => {
    if (restoringIds.has(item.id)) return;
    setRestoringIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'active');
      refresh();
      refreshCompleted();
      setRestoringIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  // Factory rather than one shared render function — each section (Active,
  // Someday) is its own manually-orderable list with its own live array and
  // isReordering flag. Row HEIGHT is a pure function of the item (uniform
  // cell gap + badge keyed off the item's own blocker), never of position.
  // The connector line is a zero-layout overlay, hidden during a drag.
  const makeRenderRow = (list: Item[], isReordering: boolean) => ({ item }: { item: Item }) => {
    const projectTitle = getProjectTitle(item);
    const blocker = getBlockingTask(item.id);
    const index = list.findIndex((t) => t.id === item.id);
    const prevItem = list[index - 1];
    // Adjacency can run either way depending on creation order — the blocker
    // isn't always the row directly above; it can be the row directly below
    // instead (its own blocker points back up at us).
    const prevBlocksThis = !!blocker && !!prevItem && blocker.id === prevItem.id;
    const thisBlocksPrev = !!prevItem && getBlockingTask(prevItem.id)?.id === item.id;
    const showConnector = !isReordering && (prevBlocksThis || thisBlocksPrev);
    return (
      <TaskRow
        item={item}
        isDark={isDark}
        palette={palette}
        projectTitle={projectTitle}
        showConnector={showConnector}
        isCompleting={completingIds.has(item.id)}
        onComplete={handleComplete}
        onOpen={(t) => openEditorForItem({
          item: t,
          onComplete: ({ action }) => {
            if (action !== 'cancelled') {
              refresh();
              refreshCompleted();
            }
          },
        })}
        onLongPress={handleLongPress}
      />
    );
  };

  const renderCompletedRow = (item: Item) => (
    <View key={item.id} style={styles.cell}>
      <RiverStoneSurface
        variant="list"
        mode={isDark ? 'dark' : 'light'}
        shape="regular"
        style={styles.rowStone}
        contentStyle={styles.row}
      >
        <LacquerDiscControl
          isCompleted={!restoringIds.has(item.id)}
          accessibilityLabel={`Restore ${item.title}`}
          onToggle={() => handleRestore(item)}
        />
        <View style={styles.rowContent}>
          <Text
            style={[styles.rowTitle, styles.rowTitleCompleted, { color: palette.greige }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {getProjectTitle(item) && (
            <Text style={[styles.rowSub, { color: palette.greige }]} numberOfLines={1}>{getProjectTitle(item)}</Text>
          )}
        </View>
      </RiverStoneSurface>
    </View>
  );

  const completedGroups = groupCompletedByDay(completedItems);

  return (
    <LensSurface title="Tasks" titleStyle="editorial">
      <RiverStoneSurface
        variant="chip"
        mode={isDark ? 'dark' : 'light'}
        shape="regular"
        style={styles.segmentedControlStone}
        contentStyle={styles.segmentedControl}
      >
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'tasks' && { borderColor: palette.antiqueBrass, borderWidth: 1 },
          ]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'tasks' ? palette.antiqueBrass : palette.greige }]}>
            Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'logbook' && { borderColor: palette.antiqueBrass, borderWidth: 1 },
          ]}
          onPress={() => setActiveTab('logbook')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'logbook' ? palette.antiqueBrass : palette.greige }]}>
            Logbook
          </Text>
        </TouchableOpacity>
      </RiverStoneSurface>

      {activeTab === 'tasks' ? (
        tasks.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={40} color={palette.antiqueBrass} strokeWidth={1.3} />
            <Text style={[styles.emptyTitle, { color: palette.ivory }]}>No tasks yet</Text>
            <Text style={[styles.emptySub, { color: palette.greige }]}>Tap the + in the dock to create one</Text>
          </View>
        ) : (
          <ScrollViewContainer contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {active.length > 0 && (
              <View style={[styles.section, activeReorder.isReordering && styles.sectionDragging]}>
                <Text style={[styles.sectionLabel, { color: palette.greige }]}>ACTIVE</Text>
                <NestedReorderableList
                  data={active}
                  keyExtractor={(item, index) => item?.id ?? String(index)}
                  renderItem={makeRenderRow(active, activeReorder.isReordering)}
                  onDragStart={activeReorder.onDragStart}
                  onIndexChange={activeReorder.onIndexChange}
                  onReorder={activeReorder.onReorder}
                  scrollable={false}
                />
              </View>
            )}
            {someday.length > 0 && (
              <View style={[styles.section, somedayReorder.isReordering && styles.sectionDragging]}>
                <Text style={[styles.sectionLabel, { color: palette.greige }]}>SOMEDAY</Text>
                <NestedReorderableList
                  data={someday}
                  keyExtractor={(item, index) => item?.id ?? String(index)}
                  renderItem={makeRenderRow(someday, somedayReorder.isReordering)}
                  onDragStart={somedayReorder.onDragStart}
                  onIndexChange={somedayReorder.onIndexChange}
                  onReorder={somedayReorder.onReorder}
                  scrollable={false}
                />
              </View>
            )}
          </ScrollViewContainer>
        )
      ) : completedGroups.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle2 size={40} color={palette.antiqueBrass} strokeWidth={1.3} />
          <Text style={[styles.emptyTitle, { color: palette.ivory }]}>No completed tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.greige }]}>Finished tasks will rest here.</Text>
        </View>
      ) : (
        <ScrollViewContainer contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {completedGroups.map((group) => (
            <View key={group.label} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.greige }]}>{group.label}</Text>
              <View style={styles.sectionRows}>{group.items.map(renderCompletedRow)}</View>
            </View>
          ))}
        </ScrollViewContainer>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  // Applied only to the section being reordered: the two sections are
  // siblings, so without this a row dragged in Active paints under the
  // Someday section below it.
  sectionDragging: {
    zIndex: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionRows: {
  },
  // Uniform gap on EVERY cell (was a conditional spacer) so row height never
  // depends on list order — the connector that used to occupy this space is
  // now a zero-layout overlay. position:relative anchors that overlay.
  cell: {
    position: 'relative',
    marginBottom: 6,
  },
  rowStone: {
    // RiverStoneSurface owns the clip/shape; this wrapper just carries the
    // ambient/contact shadow layers from `container` outward.
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rowActive: {
    opacity: 0.9,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
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
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  segmentedControlStone: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
  },
});
