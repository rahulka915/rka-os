import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { TaskRow } from '../TaskRow';
import { getThemeColors } from '../../theme';
import {
  applyManualOrder,
  getBlockingTask,
  getItemWithMetadata,
  getRelation,
  setManualOrder,
  TODAY_LIST_KEY,
} from '../../db/database';
import { nonVirtualizedListProps } from '../../utils/nestedReorderableListProps';
import type { Item } from '../../db/types';

function tickHaptic() {
  Haptics.selectionAsync();
}

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onMoreActions: (item: Item) => void;
  isDark: boolean;
}

// Today's list is just a filtered, drag-reorderable view of the same tasks
// Tasks shows — it renders the exact same TaskRow component (RiverStoneSurface
// card, badges, "more" menu) rather than a hand-copied lookalike, same
// DraggableFlatList mechanics as TasksScreen.
export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  onMoreActions,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);

  // Manual drag order takes over from here — items land in their
  // last-persisted order (new items with no stored position fall to the
  // end). Local state (not a plain derivation of `items`) so a refresh
  // triggered elsewhere mid-drag doesn't swap the array out from under
  // DraggableFlatList's in-progress gesture — same reasoning as TasksScreen.
  const [ordered, setOrdered] = useState<Item[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  useEffect(() => {
    if (isReordering) return;
    setOrdered(applyManualOrder(TODAY_LIST_KEY, items));
  }, [items, isReordering]);

  const handleDragBegin = useCallback(() => {
    setIsReordering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePlaceholderIndexChange = useCallback(() => {
    tickHaptic();
  }, []);

  const commitReorder = useCallback((from: number, to: number) => {
    setOrdered((current) => {
      if (from < 0 || from >= current.length || to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setManualOrder(TODAY_LIST_KEY, next.map((item) => item.id));
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(({ from, to }: { from: number; to: number }) => {
    setIsReordering(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    commitReorder(from, to);
  }, [commitReorder]);

  const moveItem = useCallback((itemId: string, direction: 'up' | 'down') => {
    const from = ordered.findIndex((item) => item.id === itemId);
    if (from === -1) return;
    const to = direction === 'up' ? from - 1 : from + 1;
    Haptics.selectionAsync();
    commitReorder(from, to);
  }, [ordered, commitReorder]);

  // Resolved once per list change, same reasoning as TasksScreen's
  // projectTitleById/blockerIdById — avoids a DB query per row per render.
  const projectTitleById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of ordered) {
      const projectId = getRelation(item.id, 'project');
      map.set(item.id, projectId ? getItemWithMetadata(projectId)?.title ?? null : null);
    }
    return map;
  }, [ordered]);

  const blockerIdById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of ordered) map.set(item.id, getBlockingTask(item.id)?.id ?? null);
    return map;
  }, [ordered]);

  return (
    <View style={styles.container}>
      {ordered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to do today</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Enjoy the calm</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={ordered}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={({ item, drag, isActive }: RenderItemParams<Item>) => {
            const index = ordered.findIndex((r) => r.id === item.id);
            const prevItem = ordered[index - 1] ?? null;
            const blockerId = blockerIdById.get(item.id) ?? null;
            const prevBlocksThis = !!blockerId && !!prevItem && blockerId === prevItem.id;
            const thisBlocksPrev = !!prevItem && (blockerIdById.get(prevItem.id) ?? null) === item.id;
            const showConnector = !isReordering && (prevBlocksThis || thisBlocksPrev);
            return (
              <TaskRow
                item={item}
                isDark={isDark}
                palette={palette}
                projectTitle={projectTitleById.get(item.id) ?? null}
                showConnector={showConnector}
                isCompleting={completingIds.has(item.id)}
                isActive={isActive}
                dragEnabled
                drag={drag}
                onComplete={onComplete}
                onOpen={onOpen}
                onMoreActions={onMoreActions}
                onMoveUp={() => moveItem(item.id, 'up')}
                onMoveDown={() => moveItem(item.id, 'down')}
              />
            );
          }}
          onDragBegin={handleDragBegin}
          onPlaceholderIndexChange={handlePlaceholderIndexChange}
          onDragEnd={handleDragEnd}
          scrollEnabled={false}
          activationDistance={0}
          contentContainerStyle={styles.listContent}
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
  listContent: {},
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
