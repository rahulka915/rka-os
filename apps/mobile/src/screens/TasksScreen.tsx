import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, { ScaleDecorator, ShadowDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTasks, useProjects } from '../hooks/useDb';
import {
  deleteItem,
  getCompletedItems,
  updateItemStatus,
  setRelation,
  getRelation,
  getBlockingTask,
  planForToday,
  unplanToday,
  isPlannedForToday,
  formatDate,
  getTasksViewConfig,
  setTasksViewConfig,
  setManualOrder,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { RiverStoneSurface } from '../components/riverstone';
import { NativeBottomSheet } from '../components/ui/NativeBottomSheet';
import { CheckCircle2, MoreHorizontal, Filter, ChevronDownUp } from '../icons';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import { groupCompletedByDay } from '../utils/completedGrouping';
import type { Item } from '../db/types';
import { useItemComposer } from '../components/item-composer';
import { BlockedBadge } from '../components/BlockedBadge';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { RepeatBadge } from '../components/RepeatBadge';
import { DependencyConnector } from '../components/DependencyConnector';
import { promptSetDependency } from '../utils/dependencyPrompt';
import { showActionSheet } from '../utils/actionSheet';
import { readChecklist, checklistProgress } from '../utils/checklist';
import { nonVirtualizedListProps } from '../utils/nestedReorderableListProps';
import {
  buildGroupedRows,
  reorderArray,
  rowGroupAt,
  isGroupingMutable,
  applyGroupMutation,
  manualOrderKey,
  isValidTasksViewConfig,
  DEFAULT_TASKS_VIEW_CONFIG,
  type TaskRowEntry,
  type TasksViewConfig,
  type TasksGroupBy,
  type TasksSortBy,
  type TasksFilter,
} from '../utils/taskViews';

// Item-local, so it never makes a row's height depend on list position.
function checklistLabel(item: Item): string | null {
  const entries = readChecklist(item.metadata ? JSON.parse(item.metadata) : {});
  if (!entries.length) return null;
  const { done, total } = checklistProgress(entries);
  return `${done}/${total}`;
}

const CHECKBOX_CENTER_X = 32; // row paddingHorizontal(10) + half the 44pt disc touch target

type TasksTab = 'tasks' | 'logbook';

function tickHaptic() {
  Haptics.selectionAsync();
}

function groupByLabel(g: TasksGroupBy): string {
  switch (g) {
    case 'status': return 'Status';
    case 'priority': return 'Priority';
    case 'mission': return 'Mission';
    case 'dueDate': return 'Due Date';
    case 'none': return 'No Grouping';
  }
}

function sortByLabel(s: TasksSortBy): string {
  switch (s) {
    case 'manual': return 'Manual';
    case 'dueDate': return 'Due Date';
    case 'priority': return 'Priority';
    case 'alphabetical': return 'Alphabetical';
    case 'created': return 'Date Created';
  }
}

function filterSummaryLabel(filter: TasksFilter, projects: Item[]): string {
  switch (filter.type) {
    case 'none': return 'None';
    case 'mission': return filter.missionId ? (projects.find((p) => p.id === filter.missionId)?.title ?? 'Mission') : 'No Mission';
    case 'priority': return filter.priority ? `${filter.priority[0].toUpperCase()}${filter.priority.slice(1)} Priority` : 'No Priority';
    case 'dueDate': return filter.mode === 'overdue' ? 'Overdue' : 'Has Due Date';
  }
}

const TaskRow = memo(function TaskRow({
  item,
  isDark,
  palette,
  projectTitle,
  showConnector,
  isCompleting,
  isActive,
  dragEnabled,
  drag,
  onComplete,
  onOpen,
  onMoreActions,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  projectTitle: string | null;
  showConnector: boolean;
  isCompleting: boolean;
  isActive: boolean;
  dragEnabled: boolean;
  drag: () => void;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onMoreActions: (item: Item) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const blocker = getBlockingTask(item.id);
  return (
    <ScaleDecorator activeScale={1.015}>
      <ShadowDecorator elevation={8} opacity={0.3} radius={10} color="#000000">
        <View style={styles.cell}>
          {showConnector && <DependencyConnector isDark={isDark} leftOffset={CHECKBOX_CENTER_X} />}
          {/* Whole row lifts on a hold, matching Reminders/Things — the
              checkbox and "more" button are nested touch targets that claim
              their own taps first, so they never trigger the row's drag.
              Long-press is a no-op (not just visually disabled) whenever a
              non-manual sort is active, since sort order overrides drag. */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpen(item)}
            onLongPress={dragEnabled ? drag : undefined}
            delayLongPress={350}
            disabled={isActive}
          >
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
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.ivory }]} numberOfLines={1}>{item.title}</Text>
                {/* Always rendered, even when empty — a row whose meta line
                    only appears for SOME items is exactly the variable-height
                    mix that desyncs the drag library's cached row offsets
                    (the cause of the overlap/gap glitches). Reserving this
                    slot unconditionally keeps every row's total height
                    identical regardless of content. */}
                <View style={styles.metaRow}>
                  {projectTitle && (
                    <Text style={[styles.rowSub, { color: palette.greige }]} numberOfLines={1}>{projectTitle}</Text>
                  )}
                  {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
                  {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
                  {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
                  {checklistLabel(item) && (
                    <Text style={[styles.rowSub, { color: palette.greige }]}>{checklistLabel(item)}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onMoreActions(item)}
                hitSlop={10}
                style={styles.moreButton}
                accessible
                accessibilityLabel="More actions"
                accessibilityHint={dragEnabled ? 'Opens actions for this task. Use the increment or decrement actions to reorder it.' : 'Opens actions for this task.'}
                accessibilityRole="button"
                accessibilityActions={dragEnabled ? [
                  { name: 'increment', label: 'Move up' },
                  { name: 'decrement', label: 'Move down' },
                ] : undefined}
                onAccessibilityAction={dragEnabled ? (event) => {
                  if (event.nativeEvent.actionName === 'increment') onMoveUp();
                  else if (event.nativeEvent.actionName === 'decrement') onMoveDown();
                } : undefined}
              >
                <MoreHorizontal size={20} color={palette.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </RiverStoneSurface>
          </TouchableOpacity>
        </View>
      </ShadowDecorator>
    </ScaleDecorator>
  );
});

const SectionHeaderRow = memo(function SectionHeaderRow({ label, palette }: { label: string; palette: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.sectionHeaderCell}>
      <Text style={[styles.sectionLabel, { color: palette.greige }]}>{label}</Text>
    </View>
  );
});

function TasksViewRow({
  label,
  value,
  onPress,
  palette,
  isLast,
}: {
  label: string;
  value: string;
  onPress: () => void;
  palette: ReturnType<typeof getThemeColors>;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.viewRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.separator }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[styles.viewRowLabel, { color: palette.ivory }]}>{label}</Text>
      <View style={styles.viewRowValue}>
        <Text style={[styles.viewRowValueText, { color: palette.greige }]}>{value}</Text>
        <ChevronDownUp size={16} color={palette.textMuted} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// No header "+" here — creating a plain task is identical to the dock FAB's
// default action (see App.tsx, which defaults to status:
// 'active' when focused on this screen). A second create entry point here
// would just be a second button for the same underlying action.
export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem, revision: composerRevision } = useItemComposer();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');
  const activeTabRef = useRef<TasksTab>('tasks');
  const [completedItems, setCompletedItems] = useState<Item[]>([]);
  const refreshCompleted = useCallback(() => {
    setCompletedItems(getCompletedItems());
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    refresh();
    if (activeTabRef.current === 'logbook') refreshCompleted();
  }, [composerRevision, refresh, refreshCompleted]);

  useEffect(() => {
    if (activeTab === 'logbook') refreshCompleted();
  }, [activeTab, refreshCompleted]);

  // The Tasks screen "view" — like a Notion database view, this is purely a
  // display transform over `tasks`, loaded once and persisted immediately on
  // every change (see database.ts's getTasksViewConfig/setTasksViewConfig).
  const [viewConfig, setViewConfig] = useState<TasksViewConfig>(DEFAULT_TASKS_VIEW_CONFIG);
  useEffect(() => {
    const saved = getTasksViewConfig();
    if (isValidTasksViewConfig(saved)) setViewConfig(saved);
  }, []);
  const [viewSheetVisible, setViewSheetVisible] = useState(false);

  const updateViewConfig = useCallback((patch: Partial<TasksViewConfig>) => {
    setViewConfig((current) => {
      const next = { ...current, ...patch };
      setTasksViewConfig(next);
      return next;
    });
  }, []);

  // Dragging only makes sense when the order is manual — any other sort
  // determines the order itself, so rows stop responding to long-press
  // entirely rather than fighting the sort on every render.
  const dragEnabled = viewConfig.sortBy === 'manual';

  // `rows` is local state (not a plain useMemo off `tasks`) for the same
  // reason the old Active/Someday split needed it: a refresh() triggered
  // elsewhere mid-drag must NOT swap the array out from under
  // DraggableFlatList's in-progress gesture. Deferring the resync until the
  // drag ends keeps `rows` stable for its whole duration.
  const [rows, setRows] = useState<TaskRowEntry[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const isReorderingRef = useRef(false);
  useEffect(() => {
    isReorderingRef.current = isReordering;
  }, [isReordering]);

  useEffect(() => {
    if (isReorderingRef.current) return;
    setRows(buildGroupedRows(tasks, viewConfig, projects, formatDate(new Date())));
  }, [tasks, viewConfig, projects, isReordering]);

  // react-native-draggable-flatlist keeps per-index animated layout state
  // that can go stale whenever the list's composition changes from outside
  // a drag gesture (e.g. a status/priority/mission change reshuffling which
  // header a row sits under) — the row at a given index can briefly render
  // at its PREDECESSOR's cached position, producing a header/row overlap
  // glitch. Remounting the list whenever row order/composition changes is
  // the library maintainer's own documented workaround
  // (https://github.com/computerjazz/react-native-draggable-flatlist/issues/123)
  // — cheap here since these lists are small and reorders are infrequent.
  // `remountNonce` forces the same remount when a cross-group drop is
  // cancelled, snapping the list back to its unchanged `rows` order.
  const rowsKey = useMemo(() => rows.map((r) => r.id).join('|'), [rows]);
  const [remountNonce, setRemountNonce] = useState(0);

  // Resolve each task's project title and blocking-task id once, when the
  // underlying lists change — renderRow/renderCompletedRow otherwise ran a
  // getRelation + up-to-two getBlockingTask DB queries per row on every
  // render, and this list re-renders continuously while a drag is in flight.
  const projectTitleById = useMemo(() => {
    const titleByProjectId = new Map(projects.map((p) => [p.id, p.title] as const));
    const map = new Map<string, string | null>();
    const resolve = (item: Item) => {
      const projectId = getRelation(item.id, 'project');
      return projectId ? titleByProjectId.get(projectId) ?? null : null;
    };
    for (const r of rows) if (r.kind === 'task') map.set(r.item.id, resolve(r.item));
    for (const item of completedItems) if (!map.has(item.id)) map.set(item.id, resolve(item));
    return map;
  }, [rows, completedItems, projects]);

  const blockerIdById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of rows) if (r.kind === 'task') map.set(r.item.id, getBlockingTask(r.item.id)?.id ?? null);
    return map;
  }, [rows]);

  const handleDragBegin = useCallback(() => {
    setIsReordering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePlaceholderIndexChange = useCallback(() => {
    tickHaptic();
  }, []);

  // Shared by both drag-drop (handleDragEnd) and VoiceOver's move-up/down
  // actions. Groups are just a display bucket over the same tasks — like a
  // Notion board's columns — so for mutable groupings (status/priority/
  // mission) dropping into a DIFFERENT group changes that property (with
  // confirmation) instead of snapping back. Due-date buckets and the
  // single-group "no grouping" view aren't mutable (see isGroupingMutable),
  // so cross-group drops there always snap back. Dropping within the SAME
  // group always just reorders it. The library's own already-reordered
  // `data` is intentionally ignored in favor of this recomputation from
  // `rows`, which stays the single source of truth.
  const commitReorder = useCallback((from: number, to: number) => {
    const fromRow = rows[from];
    if (!fromRow || fromRow.kind !== 'task') return;
    const item = fromRow.item;

    const originInfo = rowGroupAt(rows, from);
    const targetInfo = rowGroupAt(rows, to);
    if (!originInfo || !targetInfo) return;

    if (targetInfo.groupKey === originInfo.groupKey) {
      const clampedTo = Math.min(Math.max(to, originInfo.start), originInfo.end);
      if (clampedTo === from) return;

      const nextRows = reorderArray(rows, from, clampedTo);
      const groupTaskItems = nextRows
        .slice(originInfo.start, originInfo.end + 1)
        .filter((r): r is Extract<TaskRowEntry, { kind: 'task' }> => r.kind === 'task')
        .map((r) => r.item);

      setRows(nextRows);
      setManualOrder(manualOrderKey(viewConfig.groupBy, originInfo.groupKey), groupTaskItems.map((i) => i.id));
      return;
    }

    if (!isGroupingMutable(viewConfig.groupBy)) {
      // Reorder-only grouping (due date) or nowhere else to go (no
      // grouping) — cross-group drops always snap back.
      setRemountNonce((n) => n + 1);
      return;
    }

    // Cross-group drop: this is a real, persistent property change, not
    // just a reorder — confirm before applying it. The list has already
    // animated the row into the new group visually; on Cancel, bumping
    // `remountNonce` forces it to remount and snap back to the (unchanged)
    // `rows` order.
    const targetHeader = rows.slice(0, targetInfo.start).reverse().find((r): r is Extract<TaskRowEntry, { kind: 'header' }> => r.kind === 'header');
    const targetLabel = targetHeader?.label ?? '';
    Alert.alert(
      `Move "${item.title}" to ${targetLabel}?`,
      `Dropping it here will change its ${groupByLabel(viewConfig.groupBy).toLowerCase()} to match ${targetLabel}.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setRemountNonce((n) => n + 1) },
        {
          text: 'Move',
          onPress: () => {
            const originTaskIds = rows
              .slice(originInfo.start, originInfo.end + 1)
              .filter((r): r is Extract<TaskRowEntry, { kind: 'task' }> => r.kind === 'task' && r.item.id !== item.id)
              .map((r) => r.item.id);
            const targetTaskIds = rows
              .slice(targetInfo.start, targetInfo.end + 1)
              .filter((r): r is Extract<TaskRowEntry, { kind: 'task' }> => r.kind === 'task')
              .map((r) => r.item.id);
            const insertAt = Math.min(Math.max(to - targetInfo.start, 0), targetTaskIds.length);
            targetTaskIds.splice(insertAt, 0, item.id);

            applyGroupMutation(viewConfig.groupBy, item, targetInfo.groupKey);
            setManualOrder(manualOrderKey(viewConfig.groupBy, originInfo.groupKey), originTaskIds);
            setManualOrder(manualOrderKey(viewConfig.groupBy, targetInfo.groupKey), targetTaskIds);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refresh();
          },
        },
      ],
    );
  }, [rows, viewConfig.groupBy, refresh]);

  const handleDragEnd = useCallback(({ from, to }: { from: number; to: number }) => {
    setIsReordering(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    commitReorder(from, to);
  }, [commitReorder]);

  const moveTask = useCallback((itemId: string, direction: 'up' | 'down') => {
    const from = rows.findIndex((r) => r.kind === 'task' && r.item.id === itemId);
    if (from === -1) return;
    const to = direction === 'up' ? from - 1 : from + 1;
    Haptics.selectionAsync();
    commitReorder(from, to);
  }, [rows, commitReorder]);

  const getProjectTitle = (item: Item): string | null => projectTitleById.get(item.id) ?? null;

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

  const handleMoreActions = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  // Row HEIGHT is a pure function of the row (uniform cell gap + badge keyed
  // off the item's own blocker), never of position. The connector line is a
  // zero-layout overlay, hidden during a drag. Adjacency for the connector
  // only looks at the previous TASK row (skipping past a header), so it
  // never spans a group boundary.
  const renderRow = ({ item: row, drag, isActive }: RenderItemParams<TaskRowEntry>) => {
    if (!row) return null;
    if (row.kind === 'header') {
      return <SectionHeaderRow label={row.label} palette={palette} />;
    }
    const item = row.item;
    const projectTitle = getProjectTitle(item);
    const blockerId = blockerIdById.get(item.id) ?? null;
    const index = rows.findIndex((r) => r.id === row.id);
    const prevRow = rows[index - 1];
    const prevItem = prevRow?.kind === 'task' ? prevRow.item : null;
    // Adjacency can run either way depending on creation order — the blocker
    // isn't always the row directly above; it can be the row directly below
    // instead (its own blocker points back up at us).
    const prevBlocksThis = !!blockerId && !!prevItem && blockerId === prevItem.id;
    const thisBlocksPrev = !!prevItem && (blockerIdById.get(prevItem.id) ?? null) === item.id;
    const showConnector = !isReordering && (prevBlocksThis || thisBlocksPrev);
    return (
      <TaskRow
        item={item}
        isDark={isDark}
        palette={palette}
        projectTitle={projectTitle}
        showConnector={showConnector}
        isCompleting={completingIds.has(item.id)}
        isActive={isActive}
        dragEnabled={dragEnabled}
        drag={drag}
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
        onMoreActions={handleMoreActions}
        onMoveUp={() => moveTask(item.id, 'up')}
        onMoveDown={() => moveTask(item.id, 'down')}
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

  const pickGroupBy = () => {
    showActionSheet('Group by', [
      { label: 'Status', onPress: () => updateViewConfig({ groupBy: 'status' }) },
      { label: 'Priority', onPress: () => updateViewConfig({ groupBy: 'priority' }) },
      { label: 'Mission', onPress: () => updateViewConfig({ groupBy: 'mission' }) },
      { label: 'Due Date', onPress: () => updateViewConfig({ groupBy: 'dueDate' }) },
      { label: 'No Grouping', onPress: () => updateViewConfig({ groupBy: 'none' }) },
    ]);
  };

  const pickSortBy = () => {
    showActionSheet('Sort by', [
      { label: 'Manual', onPress: () => updateViewConfig({ sortBy: 'manual' }) },
      { label: 'Due Date', onPress: () => updateViewConfig({ sortBy: 'dueDate' }) },
      { label: 'Priority', onPress: () => updateViewConfig({ sortBy: 'priority' }) },
      { label: 'Alphabetical', onPress: () => updateViewConfig({ sortBy: 'alphabetical' }) },
      { label: 'Date Created', onPress: () => updateViewConfig({ sortBy: 'created' }) },
    ]);
  };

  const pickMissionFilter = () => {
    showActionSheet('Filter by mission', [
      { label: 'No Mission', onPress: () => updateViewConfig({ filter: { type: 'mission', missionId: null } }) },
      ...projects.map((p) => ({ label: p.title, onPress: () => updateViewConfig({ filter: { type: 'mission' as const, missionId: p.id } }) })),
    ]);
  };

  const pickPriorityFilter = () => {
    showActionSheet('Filter by priority', [
      { label: 'High', onPress: () => updateViewConfig({ filter: { type: 'priority', priority: 'high' } }) },
      { label: 'Medium', onPress: () => updateViewConfig({ filter: { type: 'priority', priority: 'medium' } }) },
      { label: 'Low', onPress: () => updateViewConfig({ filter: { type: 'priority', priority: 'low' } }) },
      { label: 'No Priority', onPress: () => updateViewConfig({ filter: { type: 'priority', priority: null } }) },
    ]);
  };

  const pickFilter = () => {
    showActionSheet('Filter', [
      { label: 'None', onPress: () => updateViewConfig({ filter: { type: 'none' } }) },
      { label: 'By Mission...', onPress: pickMissionFilter },
      { label: 'By Priority...', onPress: pickPriorityFilter },
      { label: 'Overdue only', onPress: () => updateViewConfig({ filter: { type: 'dueDate', mode: 'overdue' } }) },
      { label: 'Has due date', onPress: () => updateViewConfig({ filter: { type: 'dueDate', mode: 'hasDueDate' } }) },
    ]);
  };

  const isFiltered = viewConfig.filter.type !== 'none';

  return (
    <LensSurface title="Tasks" titleStyle="editorial">
      <View style={styles.headerRow}>
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

        {activeTab === 'tasks' && (
          <TouchableOpacity
            style={[styles.viewButton, { borderColor: isFiltered ? palette.antiqueBrass : 'transparent', backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}
            onPress={() => setViewSheetVisible(true)}
            accessibilityLabel="Tasks view options"
            accessibilityHint="Change grouping, sorting, and filtering"
          >
            <Filter size={14} color={isFiltered ? palette.antiqueBrass : palette.greige} strokeWidth={2} />
            <Text style={[styles.viewButtonLabel, { color: isFiltered ? palette.antiqueBrass : palette.greige }]} numberOfLines={1}>
              {groupByLabel(viewConfig.groupBy)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'tasks' ? (
        tasks.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={40} color={palette.antiqueBrass} strokeWidth={1.3} />
            <Text style={[styles.emptyTitle, { color: palette.ivory }]}>No tasks yet</Text>
            <Text style={[styles.emptySub, { color: palette.greige }]}>Tap the + in the dock to create one</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={40} color={palette.antiqueBrass} strokeWidth={1.3} />
            <Text style={[styles.emptyTitle, { color: palette.ivory }]}>No tasks match this filter</Text>
            <Text style={[styles.emptySub, { color: palette.greige }]}>Adjust the view to see more.</Text>
          </View>
        ) : (
          // A single root-level DraggableFlatList — not nested inside any
          // ScrollView — this list IS the screen's scroll container.
          <DraggableFlatList
            key={`${rowsKey}:${remountNonce}`}
            data={rows}
            keyExtractor={(row, index) => row?.id ?? String(index)}
            renderItem={renderRow}
            onDragBegin={handleDragBegin}
            onPlaceholderIndexChange={handlePlaceholderIndexChange}
            onDragEnd={handleDragEnd}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            {...nonVirtualizedListProps(rows.length)}
          />
        )
      ) : completedGroups.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle2 size={40} color={palette.antiqueBrass} strokeWidth={1.3} />
          <Text style={[styles.emptyTitle, { color: palette.ivory }]}>No completed tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.greige }]}>Finished tasks will rest here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {completedGroups.map((group) => (
            <View key={group.label} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.greige }]}>{group.label}</Text>
              <View style={styles.sectionRows}>{group.items.map(renderCompletedRow)}</View>
            </View>
          ))}
        </ScrollView>
      )}

      <NativeBottomSheet
        visible={viewSheetVisible}
        onClose={() => setViewSheetVisible(false)}
        isDark={isDark}
        title="View"
        heightFraction={0.32}
      >
        <TasksViewRow label="Group by" value={groupByLabel(viewConfig.groupBy)} onPress={pickGroupBy} palette={palette} />
        <TasksViewRow label="Sort by" value={sortByLabel(viewConfig.sortBy)} onPress={pickSortBy} palette={palette} />
        <TasksViewRow label="Filter" value={filterSummaryLabel(viewConfig.filter, projects)} onPress={pickFilter} palette={palette} isLast />
        <TouchableOpacity
          style={styles.resetRow}
          onPress={() => updateViewConfig(DEFAULT_TASKS_VIEW_CONFIG)}
        >
          <Text style={[styles.resetRowLabel, { color: palette.red }]}>Reset to Default</Text>
        </TouchableOpacity>
      </NativeBottomSheet>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderCell: {
    marginBottom: 8,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  // Fixed, not minHeight — every row (title + metaRow, whether or not the
  // meta row has anything in it) must measure identically for the drag
  // library's cached row offsets to stay in sync. See the metaRow comment
  // at its usage site.
  rowContent: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 16,
    overflow: 'hidden',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  moreButton: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    flex: 1,
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
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 120,
  },
  viewButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  viewRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  viewRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewRowValueText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  resetRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
