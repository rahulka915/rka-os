import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  isDark: boolean;
}

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

export function TodayCard({ items, completingIds, onComplete, onOpen, isDark }: TodayCardProps) {
  const palette = getThemeColors(isDark);
  const sorted = sortTodayItems(items);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
        TODAY · {items.length} {items.length === 1 ? 'TASK' : 'TASKS'}
      </Text>
      {sorted.length === 0 ? (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
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
