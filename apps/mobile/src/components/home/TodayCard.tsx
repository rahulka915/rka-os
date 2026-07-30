import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { DeadlineBadge } from '../DeadlineBadge';
import { ChevronRight } from '../../icons';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';
import type { UpcomingGroup } from '../../utils/upcomingGrouping';

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  upcomingGroups: UpcomingGroup[];
  onViewUpcoming: () => void;
  isDark: boolean;
}

type TodayTab = 'today' | 'upcoming';

const TodayTaskRow = memo(function TodayTaskRow({
  item,
  isDark,
  isCompleting,
  onComplete,
  onOpen,
}: {
  item: Item;
  isDark: boolean;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
}) {
  const palette = getThemeColors(isDark);
  const isOverdue = item.status === 'overdue';
  return (
    <View style={[styles.row, { backgroundColor: palette.surface }]}>
      <LacquerDiscControl
        isCompleted={isCompleting}
        accessibilityLabel={`Complete ${item.title}`}
        onToggle={() => onComplete(item)}
      />
      <TouchableOpacity
        style={styles.rowContent}
        activeOpacity={0.7}
        onPress={() => onOpen(item)}
      >
        <Text
          style={[styles.rowTitle, { color: isOverdue ? palette.red : palette.text }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const UpcomingTaskRow = memo(function UpcomingTaskRow({
  item,
  isDark,
  onOpen,
}: {
  item: Item;
  isDark: boolean;
  onOpen: (item: Item) => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => onOpen(item)}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
      </View>
    </TouchableOpacity>
  );
});

// Overdue items surface first so they're not buried in the day's list; the
// remainder keep whatever order useHomeData's todayItems already returns
// them in (no secondary sort key worth relying on there).
function sortTodayItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const aOverdue = a.status === 'overdue' ? 0 : 1;
    const bOverdue = b.status === 'overdue' ? 0 : 1;
    return aOverdue - bOverdue;
  });
}

export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  upcomingGroups,
  onViewUpcoming,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);
  const [activeTab, setActiveTab] = useState<TodayTab>('today');
  const sorted = sortTodayItems(items);
  const hasUpcoming = upcomingGroups.some((group) => group.items.length > 0);

  return (
    <View style={styles.container}>
      <View style={[styles.segmentedControl, { backgroundColor: palette.fill }]}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'today' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'today' ? palette.text : palette.textSecondary }]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'upcoming' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'upcoming' ? palette.text : palette.textSecondary }]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'today' ? (
        sorted.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to do today</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Enjoy the calm</Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {sorted.map((item) => (
              <TodayTaskRow
                key={item.id}
                item={item}
                isDark={isDark}
                isCompleting={completingIds.has(item.id)}
                onComplete={onComplete}
                onOpen={onOpen}
              />
            ))}
          </View>
        )
      ) : !hasUpcoming ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing scheduled</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tasks with a future date land here</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {upcomingGroups.map((group) => (
            <View key={group.date}>
              <Text style={[styles.groupLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              <View style={styles.rows}>
                {group.items.map((item) => (
                  <UpcomingTaskRow key={item.id} item={item} isDark={isDark} onOpen={onOpen} />
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.row, styles.viewAllRow, { backgroundColor: palette.surface }]}
            activeOpacity={0.7}
            onPress={onViewUpcoming}
          >
            <Text style={[styles.rowTitle, { color: palette.textSecondary }]}>View all</Text>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewAllRow: {
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
});
