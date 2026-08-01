import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useArchivedItems } from '../hooks/useDb';
import { updateItemStatus, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { LacquerDiscControl, LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { showActionSheet } from '../utils/actionSheet';
import type { Item, ItemType } from '../db/types';

const TYPE_LABELS: Record<ItemType, string> = {
  task: 'Task',
  project: 'Mission',
  area: 'Domain',
  habit: 'Habit',
  medication: 'Medication',
  'workout-template': 'Workout',
  'workout-block': 'Workout',
  exercise: 'Exercise',
  'workout-session': 'Workout',
  meal: 'Meal',
  object: 'To Get',
};

export function ArchiveScreen() {
  const { items, refresh } = useArchivedItems();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  const handleRestore = (item: Item) => {
    if (restoringIds.has(item.id)) return;
    setRestoringIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'active');
      refresh();
      setRestoringIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(item.title, [
      { label: 'Restore', onPress: () => handleRestore(item) },
      {
        label: 'Delete Permanently',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
        destructive: true,
      },
    ]);
  };

  const renderRow = (item: Item) => (
    <View key={item.id} style={styles.cell}>
      <TouchableOpacity
        style={[styles.row, { backgroundColor: palette.surface }]}
        activeOpacity={0.7}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <LacquerDiscControl
          isCompleted={!restoringIds.has(item.id)}
          accessibilityLabel={`Restore ${item.title}`}
          onToggle={() => handleRestore(item)}
        />
        <View style={styles.rowContent}>
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.rowSub, { color: palette.textTertiary }]}>{TYPE_LABELS[item.type] ?? item.type}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <LensSurface title="Archive">
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing archived</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Archived items show up here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionRows}>{items.map(renderRow)}</View>
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionRows: {},
  cell: {
    marginBottom: 8,
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
    fontWeight: '400',
  },
});
