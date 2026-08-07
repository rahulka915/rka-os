import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { runOnJS } from 'react-native-reanimated';
import ReorderableList, { ScrollViewContainer, reorderItems } from 'react-native-reorderable-list';
import { useTasks, useProjects, useCompletedItems } from '../hooks/useDb';
import { deleteItem, updateItemStatus, setRelation, getRelation, getBlockingTask, applyManualOrder, setManualOrder, planForToday, unplanToday, isPlannedForToday } from '../db/database';
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

// Active and Someday used to be two separate NestedReorderableLists inside
// one ScrollViewContainer — structurally correct per the library's own
// design, but React Native's generic nested-VirtualizedList detector still
// flagged it (it can't see the library's internal scroll coordination), and
// in practice this combo produced real row-ghosting glitches, not just
// console noise. Flattened into ONE root-level ReorderableList instead —
// the same standalone pattern already used safely by ProjectDetailScreen —
// with section labels as non-draggable rows in the same array. A dragged
// task can never cross into the other section because DragHandleButton only
// exists on task rows (headers have no handle, so can't initiate a drag)
// and commitReorder clamps any drop index to the dragged row's own section.
const HEADER_ACTIVE_ID = 'header:active';
const HEADER_SOMEDAY_ID = 'header:someday';

type TaskRowEntry =
  | { id: string; kind: 'header'; label: string }
  | { id: string; kind: 'task'; item: Item };

function buildRows(active: Item[], someday: Item[]): TaskRowEntry[] {
  const rows: TaskRowEntry[] = [];
  if (active.length > 0) {
    rows.push({ id: HEADER_ACTIVE_ID, kind: 'header', label: 'ACTIVE' });
    for (const item of active) rows.push({ id: item.id, kind: 'task', item });
  }
  if (someday.length > 0) {
    rows.push({ id: HEADER_SOMEDAY_ID, kind: 'header', label: 'SOMEDAY' });
    for (const item of someday) rows.push({ id: item.id, kind: 'task', item });
  }
  return rows;
}

function tickHaptic() {
  Haptics.selectionAsync();
}

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
  onMoveUp,
  onMoveDown,
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
  onMoveUp: () => void;
  onMoveDown: () => void;
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
        <DragHandleButton color={palette.textMuted} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      </RiverStoneSurface>
    </View>
  );
});

const SectionHeaderRow = memo(function SectionHeaderRow({ label, palette }: { label: string; palette: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.sectionHeaderCell}>
      <Text style={[styles.sectionLabel, { color: palette.greige }]}>{label}</Text>
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
  // `tasks` (owned by useTasks) whenever it changes. `rows` is a pure,
  // memoized projection of these two arrays into one flat list for
  // rendering/reordering; it is never a separate source of truth.
  const [active, setActive] = useState<Item[]>([]);
  const [someday, setSomeday] = useState<Item[]>([]);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    setActive(applyManualOrder('tasks:active', tasks.filter(t => t.status !== 'someday')));
    setSomeday(applyManualOrder('tasks:someday', tasks.filter(t => t.status === 'someday')));
  }, [tasks]);

  const rows = useMemo(() => buildRows(active, someday), [active, someday]);

  const beginReorder = useCallback(() => {
    setIsReordering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const onDragStart = useCallback(() => {
    'worklet';
    runOnJS(beginReorder)();
  }, [beginReorder]);

  const onIndexChange = useCallback(() => {
    'worklet';
    runOnJS(tickHaptic)();
  }, []);

  // Shared by both drag-drop (onReorder) and VoiceOver's move-up/down
  // actions. Clamps `to` inside the dragged row's own section — headers
  // have no drag handle so `from` should never legitimately be one, but the
  // clamp makes crossing into the other section structurally impossible
  // either way, not just handle-gated.
  const commitReorder = useCallback((from: number, to: number) => {
    const fromRow = rows[from];
    if (!fromRow || fromRow.kind !== 'task') return;

    let sectionStart = 0;
    for (let i = from - 1; i >= 0; i--) {
      if (rows[i].kind === 'header') { sectionStart = i + 1; break; }
    }
    let sectionEnd = rows.length - 1;
    for (let i = from + 1; i < rows.length; i++) {
      if (rows[i].kind === 'header') { sectionEnd = i - 1; break; }
    }
    const clampedTo = Math.min(Math.max(to, sectionStart), sectionEnd);
    if (clampedTo === from) return;

    const nextRows = reorderItems(rows, from, clampedTo);
    const sectionTaskItems = nextRows
      .slice(sectionStart, sectionEnd + 1)
      .filter((r): r is Extract<TaskRowEntry, { kind: 'task' }> => r.kind === 'task')
      .map((r) => r.item);

    const headerRow = rows[sectionStart - 1];
    if (headerRow?.kind === 'header' && headerRow.id === HEADER_ACTIVE_ID) {
      setActive(sectionTaskItems);
      setManualOrder('tasks:active', sectionTaskItems.map((i) => i.id));
    } else {
      setSomeday(sectionTaskItems);
      setManualOrder('tasks:someday', sectionTaskItems.map((i) => i.id));
    }
  }, [rows]);

  const onReorder = useCallback(({ from, to }: { from: number; to: number }) => {
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

  // Row HEIGHT is a pure function of the row (uniform cell gap + badge keyed
  // off the item's own blocker), never of position. The connector line is a
  // zero-layout overlay, hidden during a drag. Adjacency for the connector
  // only looks at the previous TASK row (skipping past a header), so it
  // never spans a section boundary.
  const renderRow = ({ item: row }: { item: TaskRowEntry }) => {
    if (row.kind === 'header') {
      return <SectionHeaderRow label={row.label} palette={palette} />;
    }
    const item = row.item;
    const projectTitle = getProjectTitle(item);
    const blocker = getBlockingTask(item.id);
    const index = rows.findIndex((r) => r.id === row.id);
    const prevRow = rows[index - 1];
    const prevItem = prevRow?.kind === 'task' ? prevRow.item : null;
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
          // A single root-level ReorderableList — not nested inside any
          // ScrollView — replaces the old two-NestedReorderableLists-inside-
          // ScrollViewContainer structure. Same standalone pattern as
          // ProjectDetailScreen; this list IS the screen's scroll container.
          <ReorderableList
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={renderRow}
            onDragStart={onDragStart}
            onIndexChange={onIndexChange}
            onReorder={onReorder}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
