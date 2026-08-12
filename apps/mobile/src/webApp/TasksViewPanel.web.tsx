import { Pressable, StyleSheet, Text, View } from 'react-native';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { TasksGroupBy, TasksSortBy, TasksFilter, TaskPriority } from '../utils/taskViews';
import type { Item } from '../db/types';

const GROUP_OPTIONS: Array<{ value: TasksGroupBy; label: string }> = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'mission', label: 'Mission' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'none', label: 'None' },
];

const SORT_OPTIONS: Array<{ value: TasksSortBy; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'created', label: 'Created' },
];

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

interface TasksViewPanelProps {
  groupBy: TasksGroupBy;
  sortBy: TasksSortBy;
  filter: TasksFilter;
  projects: Item[];
  onChangeGroupBy: (value: TasksGroupBy) => void;
  onChangeSortBy: (value: TasksSortBy) => void;
  onChangeFilter: (value: TasksFilter) => void;
  onClose: () => void;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function TasksViewPanel({
  groupBy,
  sortBy,
  filter,
  projects,
  onChangeGroupBy,
  onChangeSortBy,
  onChangeFilter,
  onClose,
}: TasksViewPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>View</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.closeLabel}>Done</Text>
        </Pressable>
      </View>

      <Text style={styles.rowLabel}>Group by</Text>
      <View style={styles.chipRow}>
        {GROUP_OPTIONS.map((opt) => (
          <Chip key={opt.value} label={opt.label} active={groupBy === opt.value} onPress={() => onChangeGroupBy(opt.value)} />
        ))}
      </View>

      <Text style={styles.rowLabel}>Sort by</Text>
      <View style={styles.chipRow}>
        {SORT_OPTIONS.map((opt) => (
          <Chip key={opt.value} label={opt.label} active={sortBy === opt.value} onPress={() => onChangeSortBy(opt.value)} />
        ))}
      </View>

      <Text style={styles.rowLabel}>Filter</Text>
      <View style={styles.chipRow}>
        <Chip label="All" active={filter.type === 'none'} onPress={() => onChangeFilter({ type: 'none' })} />
        <Chip
          label="Overdue"
          active={filter.type === 'dueDate' && filter.mode === 'overdue'}
          onPress={() => onChangeFilter({ type: 'dueDate', mode: 'overdue' })}
        />
        <Chip
          label="Has Due Date"
          active={filter.type === 'dueDate' && filter.mode === 'hasDueDate'}
          onPress={() => onChangeFilter({ type: 'dueDate', mode: 'hasDueDate' })}
        />
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            label={`${p[0].toUpperCase()}${p.slice(1)}`}
            active={filter.type === 'priority' && filter.priority === p}
            onPress={() => onChangeFilter({ type: 'priority', priority: p })}
          />
        ))}
        <Chip
          label="No Priority"
          active={filter.type === 'priority' && filter.priority === null}
          onPress={() => onChangeFilter({ type: 'priority', priority: null })}
        />
        {projects.map((p) => (
          <Chip
            key={p.id}
            label={p.title}
            active={filter.type === 'mission' && filter.missionId === p.id}
            onPress={() => onChangeFilter({ type: 'mission', missionId: p.id })}
          />
        ))}
        <Chip
          label="No Mission"
          active={filter.type === 'mission' && filter.missionId === null}
          onPress={() => onChangeFilter({ type: 'mission', missionId: null })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[4],
    marginHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
    gap: webSpacing[2],
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[1],
  },
  panelTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
  },
  closeLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.accent,
  },
  rowLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: webSpacing[2],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  chipActive: {
    backgroundColor: webColors.accent,
  },
  chipLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipLabelActive: {
    color: webColors.card,
  },
});
