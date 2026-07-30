import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInbox } from '../hooks/useDb';
import { processInboxItem } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export function InboxScreen() {
  const { items, refresh } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const moveToday = (item: Item) => {
    processInboxItem(item.id, 'today');
    refresh();
  };
  const moveSomeday = (item: Item) => {
    processInboxItem(item.id, 'someday');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.count}>{items.length} unprocessed</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>Inbox zero. Nice work.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.rowActions}>
              <Pressable onPress={() => moveToday(item)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>Today</Text>
              </Pressable>
              <Pressable onPress={() => moveSomeday(item)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>Someday</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Inbox item">
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  rowActions: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  actionChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  actionChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
});
