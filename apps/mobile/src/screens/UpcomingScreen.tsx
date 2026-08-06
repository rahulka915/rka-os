import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUpcomingItems, formatDate } from '../db/database';
import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import type { Item } from '../db/types';

export function UpcomingScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { revision } = useItemComposer();
  const openItem = useOpenItem();
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);

  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setGroups(groupByScheduledDate(getUpcomingItems(today), today));
  }, [revision]);

  useFocusEffect(refresh);

  const renderRow = (item: Item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => openItem({
        item,
        onComplete: ({ action }) => {
          if (action !== 'cancelled') refresh();
        },
      })}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <LensSurface title="Upcoming">
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing scheduled</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tasks with a future date land here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groups.map((group) => (
            <View key={group.date} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              {group.items.map(renderRow)}
            </View>
          ))}
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  rowContent: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400' },
});
