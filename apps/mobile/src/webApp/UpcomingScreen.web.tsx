import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { getUpcomingItems, formatDate, updateItemStatus } from '../db/database';
import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

function useUpcomingGroups() {
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setGroups(groupByScheduledDate(getUpcomingItems(today), today));
  }, []);
  useDbRefresh(refresh);
  return { groups, refresh };
}

export function UpcomingScreen() {
  const { groups, refresh } = useUpcomingGroups();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allItems = groups.flatMap((group) => group.items);
  const selectedItem = allItems.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(group) => group.date}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Upcoming</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing upcoming.</Text>}
        renderItem={({ item: group }) => (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{group.label}</Text>
            {group.items.map((item) => {
              const completed = item.status === 'completed';
              return (
                <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleComplete(item);
                    }}
                    style={[styles.checkbox, completed && styles.checkboxDone]}
                  >
                    {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                  </Pressable>
                  <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Item">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[4],
  },
  header: {
    marginBottom: webSpacing[2],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  section: {
    gap: webSpacing[2],
    marginBottom: webSpacing[4],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
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
    flex: 1,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
