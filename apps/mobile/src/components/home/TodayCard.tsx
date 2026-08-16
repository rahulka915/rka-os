import { memo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NestedReorderableList } from 'react-native-reorderable-list';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { DragHandleButton } from '../ui/DragHandleButton';
import { getThemeColors } from '../../theme';
import { applyManualOrder, TODAY_LIST_KEY } from '../../db/database';
import { useHapticReorder } from '../../hooks/useHapticReorder';
import { nonVirtualizedListProps } from '../../utils/nestedReorderableListProps';
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
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isDark: boolean;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
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
      <DragHandleButton color={palette.textMuted} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    </View>
  );
});

export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);

  // Manual drag order takes over from here — items land in their
  // last-persisted order (new items with no stored position fall to the
  // end). Overdue styling stays per-row (see TodayTaskRow), independent of
  // this order.
  const [ordered, setOrdered] = useState<Item[]>([]);
  useEffect(() => {
    setOrdered(applyManualOrder(TODAY_LIST_KEY, items));
  }, [items]);
  const { onDragStart, onIndexChange, onReorder, moveItem } = useHapticReorder(TODAY_LIST_KEY, ordered, setOrdered);

  return (
    <View style={styles.container}>
      {ordered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to do today</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Enjoy the calm</Text>
        </View>
      ) : (
        <NestedReorderableList
          data={ordered}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={({ item }: { item: Item }) => (
            <TodayTaskRow
              item={item}
              isDark={isDark}
              isCompleting={completingIds.has(item.id)}
              onComplete={onComplete}
              onOpen={onOpen}
              onMoveUp={() => moveItem(item.id, 'up')}
              onMoveDown={() => moveItem(item.id, 'down')}
            />
          )}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          scrollable={false}
          {...nonVirtualizedListProps(ordered.length)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
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
  // Task/card titles use 600, not 700/800 — one consistent emphasis level
  // instead of every title shouting louder than the text around it.
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  // Reduced from 700/16 — stays Inter (not Newsreader) per the follow-up
  // note that a serif empty-state heading was one serif usage too many;
  // Newsreader stays exclusive to the Journey card's emotional copy.
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
