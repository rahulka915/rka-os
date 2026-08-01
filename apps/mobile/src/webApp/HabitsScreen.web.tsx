import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Flame, Plus } from 'lucide-react-native';
import { getItemsByType, createItem, updateItemStatus, formatDate } from '../db/database';
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

function useHabits() {
  const [rows, setRows] = useState<HabitRowData[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setRows(getItemsByType('habit').map((item) => buildHabitRowData(item, today)));
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

export function HabitsScreen() {
  const { rows, refresh } = useHabits();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = rows.find((r) => r.item.id === selectedId)?.item ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('habit', trimmed, 'active');
    setCaptureText('');
    refresh();
  };

  const checkIn = (row: HabitRowData) => {
    if (!row.isScheduledToday || row.isCompletedToday) return;
    updateItemStatus(row.item.id, 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <Text style={styles.count}>{rows.length}</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submit}
          placeholder="Add a habit..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No habits yet.</Text>}
        renderItem={({ item: row }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(row.item.id)}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                checkIn(row);
              }}
              disabled={!row.isScheduledToday || row.isCompletedToday}
              style={[
                styles.checkbox,
                row.isCompletedToday && styles.checkboxDone,
                !row.isScheduledToday && !row.isCompletedToday && styles.checkboxDisabled,
              ]}
            >
              {row.isCompletedToday ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
            </Pressable>
            <Text style={styles.rowTitle} numberOfLines={1}>{row.item.title}</Text>
            <View style={styles.streak}>
              <Flame size={15} color={row.streak > 0 ? webColors.destructive : webColors.mutedForeground} strokeWidth={2} />
              <Text style={[styles.streakText, row.streak > 0 && styles.streakTextActive]}>{row.streak}</Text>
            </View>
          </Pressable>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Habit">
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
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
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
  checkboxDisabled: {
    opacity: 0.35,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.mutedForeground,
  },
  streakTextActive: {
    color: webColors.destructive,
  },
});
