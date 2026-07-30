import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTasks } from '../hooks/useDb';
import { updateItemStatus } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = tasks.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.count}>{tasks.length}</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet.</Text>}
        renderItem={({ item }) => {
          const completed = item.status === 'completed';
          return (
            <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
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
        }}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Task">
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
