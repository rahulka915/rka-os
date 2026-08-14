import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus, Filter, ChevronUp, ChevronDown, Lock, Flag, Repeat, ListChecks, MoveRight } from 'lucide-react-native';
import { useTasks, useProjects } from '../hooks/useDb';
import { updateItemStatus, createItem, getCompletedItems, formatDate, setManualOrder, getBlockingTask } from '../db/database';
import { groupCompletedByDay } from '../utils/completedGrouping';
import {
  buildGroupedRows,
  DEFAULT_TASKS_VIEW_CONFIG,
  manualOrderKey,
  isGroupingMutable,
  applyGroupMutation,
  type TaskRowEntry,
  type TasksFilter,
  type TasksViewConfig,
  type TasksGroupBy,
} from '../utils/taskViews';
import { ArchiveScreen } from './ArchiveScreen';
import { deadlineStatus } from '../utils/deadline';
import { repeatLabel } from '../utils/repeat';
import { readChecklist, checklistProgress } from '../utils/checklist';
import { TasksViewPanel } from './TasksViewPanel.web';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

export type TasksTab = 'tasks' | 'logbook' | 'archive';

function filterLabel(filter: TasksFilter): string {
  switch (filter.type) {
    case 'none': return 'All';
    case 'mission': return filter.missionId ? 'Mission' : 'No Mission';
    case 'priority': return filter.priority ? `${filter.priority[0].toUpperCase()}${filter.priority.slice(1)}` : 'No Priority';
    case 'dueDate': return filter.mode === 'overdue' ? 'Overdue' : 'Has Due Date';
  }
}

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function TasksScreen({ initialTab }: { initialTab?: TasksTab } = {}) {
  const { tasks, refresh } = useTasks();
  const { projects } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TasksTab>(initialTab ?? 'tasks');
  const [captureText, setCaptureText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'someday'>('all');
  const [completedItems, setCompletedItems] = useState<Item[]>([]);
  const [viewPanelOpen, setViewPanelOpen] = useState(false);
  const [viewConfig, setViewConfig] = useState<TasksViewConfig>(DEFAULT_TASKS_VIEW_CONFIG);
  const [moveMenuTaskId, setMoveMenuTaskId] = useState<string | null>(null);

  const refreshCompleted = () => setCompletedItems(getCompletedItems());

  useEffect(() => {
    if (initialTab === 'logbook') refreshCompleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLogbook = () => {
    setActiveTab('logbook');
    refreshCompleted();
  };

  const today = formatDate(new Date());

  const effectiveViewConfig = useMemo(() => {
    if (viewConfig.groupBy !== 'status') return viewConfig;
    if (statusFilter === 'all') return viewConfig;
    return { ...viewConfig, filter: { type: 'none' as const } };
  }, [viewConfig, statusFilter]);

  const rows = useMemo(() => {
    const visibleTasks = viewConfig.groupBy === 'status' && statusFilter !== 'all'
      ? tasks.filter((t) => (statusFilter === 'someday' ? t.status === 'someday' : t.status !== 'someday'))
      : tasks;
    return buildGroupedRows(visibleTasks, effectiveViewConfig, projects, today);
  }, [tasks, projects, effectiveViewConfig, statusFilter, viewConfig.groupBy, today]);

  const completedGroups = groupCompletedByDay(completedItems);

  const allItems = [...tasks, ...completedItems];
  const selectedItem = allItems.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
    if (activeTab === 'logbook') refreshCompleted();
  };

  const submitCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('task', trimmed, 'active');
    setCaptureText('');
    refresh();
  };

  const cycleStatusFilter = () => {
    setStatusFilter((current) => (current === 'all' ? 'active' : current === 'active' ? 'someday' : 'all'));
  };

  const moveRow = (row: Extract<TaskRowEntry, { kind: 'task' }>, direction: 'up' | 'down') => {
    const groupRows = rows.filter((r) => r.kind === 'task' && r.groupKey === row.groupKey) as Array<Extract<TaskRowEntry, { kind: 'task' }>>;
    const from = groupRows.findIndex((r) => r.item.id === row.item.id);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= groupRows.length) return;
    const next = [...groupRows];
    [next[from], next[to]] = [next[to], next[from]];
    setManualOrder(manualOrderKey(viewConfig.groupBy, row.groupKey), next.map((r) => r.item.id));
    refresh();
  };

  const moveToGroup = (item: Item, targetGroupKey: string) => {
    applyGroupMutation(viewConfig.groupBy, item, targetGroupKey);
    setMoveMenuTaskId(null);
    refresh();
  };

  const groupKeysForMove = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.kind === 'header') seen.add(row.groupKey);
    }
    return [...seen];
  }, [rows]);

  const renderMoveMenu = (row: Extract<TaskRowEntry, { kind: 'task' }>) => {
    if (!isGroupingMutable(viewConfig.groupBy)) return null;
    const others = groupKeysForMove.filter((k) => k !== row.groupKey);
    if (others.length === 0) return null;
    return (
      <View style={styles.moveMenu}>
        {others.map((key) => (
          <Pressable key={key} style={styles.moveMenuItem} onPress={() => moveToGroup(row.item, key)}>
            <Text style={styles.moveMenuItemLabel}>
              {key === 'someday' ? 'Someday' : key === 'active' ? 'Active' : key === 'none' ? 'None' : key}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderBadges = (item: Item) => {
    const meta = parseMetadata(item);
    const badges: ReactElement[] = [];

    const blocker = getBlockingTask(item.id);
    if (blocker) {
      badges.push(
        <View key="blocked" style={styles.badgeRow}>
          <Lock size={11} color={webColors.mutedForeground} strokeWidth={2} />
          <Text style={styles.badgeText} numberOfLines={1}>Blocked by {blocker.title}</Text>
        </View>
      );
    }

    if (item.dueDate) {
      const status = deadlineStatus(item.dueDate, today);
      if (status) {
        const color = status.tone === 'overdue' || status.tone === 'today' ? webColors.destructive : webColors.mutedForeground;
        badges.push(
          <View key="deadline" style={styles.badgeRow}>
            <Flag size={11} color={color} strokeWidth={2} />
            <Text style={[styles.badgeText, { color }]} numberOfLines={1}>{status.label}</Text>
          </View>
        );
      }
    }

    if (item.rrule) {
      const label = repeatLabel(item.rrule);
      if (label) {
        badges.push(
          <View key="repeat" style={styles.badgeRow}>
            <Repeat size={11} color={webColors.mutedForeground} strokeWidth={2} />
            <Text style={styles.badgeText} numberOfLines={1}>{label}</Text>
          </View>
        );
      }
    }

    const checklist = readChecklist(meta);
    if (checklist.length > 0) {
      const { done, total } = checklistProgress(checklist);
      badges.push(
        <View key="checklist" style={styles.badgeRow}>
          <ListChecks size={11} color={webColors.mutedForeground} strokeWidth={2} />
          <Text style={styles.badgeText} numberOfLines={1}>{done}/{total}</Text>
        </View>
      );
    }

    if (badges.length === 0) return null;
    return <View style={styles.badgeGroup}>{badges}</View>;
  };

  const renderRow = (row: TaskRowEntry, index: number) => {
    if (row.kind === 'header') {
      return (
        <Text key={row.id} style={styles.sectionLabel}>{row.label}</Text>
      );
    }
    const item = row.item;
    const groupRows = rows.filter((r) => r.kind === 'task' && r.groupKey === row.groupKey) as Array<Extract<TaskRowEntry, { kind: 'task' }>>;
    const posInGroup = groupRows.findIndex((r) => r.item.id === item.id);
    const canMove = viewConfig.sortBy === 'manual';
    return (
      <View key={item.id} style={styles.rowWrapper}>
        <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              toggleComplete(item);
            }}
            style={styles.checkbox}
          />
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            {renderBadges(item)}
          </View>
          {canMove && (
            <View style={styles.rowActions}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  moveRow(row, 'up');
                }}
                disabled={posInGroup === 0}
                hitSlop={6}
              >
                <ChevronUp size={16} color={posInGroup === 0 ? webColors.border : webColors.mutedForeground} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  moveRow(row, 'down');
                }}
                disabled={posInGroup === groupRows.length - 1}
                hitSlop={6}
              >
                <ChevronDown size={16} color={posInGroup === groupRows.length - 1 ? webColors.border : webColors.mutedForeground} strokeWidth={2} />
              </Pressable>
            </View>
          )}
          {isGroupingMutable(viewConfig.groupBy) && (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setMoveMenuTaskId(moveMenuTaskId === item.id ? null : item.id);
              }}
              hitSlop={6}
            >
              <MoveRight size={15} color={webColors.mutedForeground} strokeWidth={2} />
            </Pressable>
          )}
        </Pressable>
        {moveMenuTaskId === item.id && renderMoveMenu(row)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.count}>{tasks.length}</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segment, activeTab === 'tasks' && styles.segmentActive]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text style={[styles.segmentLabel, activeTab === 'tasks' && styles.segmentLabelActive]}>Tasks</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, activeTab === 'logbook' && styles.segmentActive]}
            onPress={openLogbook}
          >
            <Text style={[styles.segmentLabel, activeTab === 'logbook' && styles.segmentLabelActive]}>Logbook</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, activeTab === 'archive' && styles.segmentActive]}
            onPress={() => setActiveTab('archive')}
          >
            <Text style={[styles.segmentLabel, activeTab === 'archive' && styles.segmentLabelActive]}>Archive</Text>
          </Pressable>
        </View>

        {activeTab === 'tasks' && (
          <>
            {viewConfig.groupBy === 'status' && (
              <Pressable style={styles.filterButton} onPress={cycleStatusFilter}>
                <Filter size={13} color={statusFilter !== 'all' ? webColors.accent : webColors.mutedForeground} strokeWidth={2} />
                <Text style={[styles.filterButtonLabel, statusFilter !== 'all' && styles.filterButtonLabelActive]}>
                  {statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'Someday'}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.filterButton} onPress={() => setViewPanelOpen((v) => !v)}>
              <Text style={[styles.filterButtonLabel, viewPanelOpen && styles.filterButtonLabelActive]}>
                View · {filterLabel(viewConfig.filter)}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {activeTab === 'archive' ? (
        <ArchiveScreen />
      ) : (
      <>
      {activeTab === 'tasks' && viewPanelOpen && (
        <TasksViewPanel
          groupBy={viewConfig.groupBy}
          sortBy={viewConfig.sortBy}
          filter={viewConfig.filter}
          projects={projects}
          onChangeGroupBy={(groupBy: TasksGroupBy) => setViewConfig((c) => ({ ...c, groupBy }))}
          onChangeSortBy={(sortBy) => setViewConfig((c) => ({ ...c, sortBy }))}
          onChangeFilter={(filter) => setViewConfig((c) => ({ ...c, filter }))}
          onClose={() => setViewPanelOpen(false)}
        />
      )}

      {activeTab === 'tasks' && (
        <View style={styles.captureRow}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
          <TextInput
            value={captureText}
            onChangeText={setCaptureText}
            onSubmitEditing={submitCapture}
            placeholder="Add a task..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInput}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.listContent}>
        {activeTab === 'tasks' ? (
          rows.length === 0 ? (
            <Text style={styles.empty}>No tasks match this view.</Text>
          ) : (
            rows.map(renderRow)
          )
        ) : completedGroups.length === 0 ? (
          <Text style={styles.empty}>No completed tasks yet.</Text>
        ) : (
          completedGroups.map((group) => (
            <View key={group.label} style={styles.section}>
              <Text style={styles.sectionLabel}>{group.label}</Text>
              {group.items.map((item) => (
                <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleComplete(item);
                    }}
                    style={[styles.checkbox, styles.checkboxDone]}
                  >
                    <Check size={13} color={webColors.card} strokeWidth={2.5} />
                  </Pressable>
                  <Text style={[styles.rowTitle, styles.rowTitleDone]} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Task">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={() => {
              refresh();
              if (activeTab === 'logbook') refreshCompleted();
            }}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
              if (activeTab === 'logbook') refreshCompleted();
            }}
          />
        ) : null}
      </DetailPanel>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    marginBottom: webSpacing[3],
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.sm - 4,
  },
  segmentActive: {
    backgroundColor: webColors.card,
  },
  segmentLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  segmentLabelActive: {
    color: webColors.foreground,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  filterButtonLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  filterButtonLabelActive: {
    color: webColors.accent,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[6],
  },
  section: {
    gap: webSpacing[2],
    marginBottom: webSpacing[3],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: webSpacing[1],
    marginTop: webSpacing[2],
  },
  rowWrapper: {
    gap: webSpacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[4],
    ...webDepth.list,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[3],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  moveMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[2],
    marginHorizontal: webSpacing[1],
  },
  moveMenuItem: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.card,
  },
  moveMenuItemLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.foreground,
  },
});
