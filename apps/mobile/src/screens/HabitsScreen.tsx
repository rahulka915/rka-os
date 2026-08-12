import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemsByType, createItem, updateItemStatus, deleteItem, formatDate, logHabitSample, undoLastHabitSample, getHabitSamples } from '../db/database';
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
import { parseHabitMeta, computeHabitPeriodProgress } from '../utils/habitMeta';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { LacquerDiscControl, LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { HabitQuantifiedSheet } from '../components/home/HabitQuantifiedSheet';
import { useOpenItem } from '../hooks/useOpenItem';
import { showActionSheet } from '../utils/actionSheet';
import { Flame } from '../icons';
import { HabitRitualIcon } from '../components/icons/CollectionIcons';
import type { Item } from '../db/types';

// No header "+" — holding the dock FAB while this screen is focused opens
// New Habit instead (see useRegisterFabHoldAction / App.tsx's runFabHold),
// same pattern as Projects/Tasks.
export function HabitsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const navigation = useNavigation<any>();
  const openItem = useOpenItem();
  const [rows, setRows] = useState<HabitRowData[]>([]);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [quantifiedHabit, setQuantifiedHabit] = useState<Item | null>(null);

  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setRows(getItemsByType('habit').map((item) => buildHabitRowData(item, today)));
  }, []);

  useFocusEffect(refresh);

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (title: string) => {
    createItem('habit', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleCheckIn = (row: HabitRowData) => {
    if (!row.isScheduledToday || row.isCompletedToday || completingIds.has(row.item.id)) return;
    setCompletingIds((current) => new Set(current).add(row.item.id));
    setTimeout(() => {
      updateItemStatus(row.item.id, 'completed');
      refresh();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(row.item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const handleRowPress = (row: HabitRowData) => {
    const meta = parseHabitMeta(row.item);
    if (meta.measurement === 'binary') {
      handleCheckIn(row);
    } else if (meta.contextualAction === 'add-one') {
      logHabitSample(row.item.id, 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } else {
      setQuantifiedHabit(row.item);
    }
  };

  const handleLongPress = (row: HabitRowData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const meta = parseHabitMeta(row.item);
    const progress = meta.measurement === 'binary' ? null : computeHabitPeriodProgress(row.item, getHabitSamples(row.item.id), new Date());
    showActionSheet(row.item.title, [
      { label: 'Edit', onPress: () => openItem({ item: row.item, onComplete: ({ action }) => { if (action !== 'cancelled') refresh(); } }) },
      ...(progress && progress.current > 0
        ? [{ label: 'Undo last log', onPress: () => { undoLastHabitSample(row.item.id); refresh(); } }]
        : []),
      {
        label: 'Delete',
        onPress: () => {
          deleteItem(row.item.id);
          refresh();
        },
        destructive: true,
      },
    ]);
  };

  const renderRow = (row: HabitRowData) => (
    <TouchableOpacity
      key={row.item.id}
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => openItem({ item: row.item, onComplete: ({ action }) => { if (action !== 'cancelled') refresh(); } })}
      onLongPress={() => handleLongPress(row)}
      delayLongPress={400}
    >
      <LacquerDiscControl
        isCompleted={completingIds.has(row.item.id) || row.isCompletedToday}
        isEnabled={row.isScheduledToday && !row.isCompletedToday}
        accessibilityLabel={row.isScheduledToday ? `Check in ${row.item.title}` : `${row.item.title}, not scheduled today`}
        onToggle={() => handleRowPress(row)}
      />
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.item.title}</Text>
      </View>
      <View style={styles.streak}>
        <Flame size={16} color={row.streak > 0 ? palette.red : palette.textTertiary} />
        <Text style={[styles.streakText, { color: row.streak > 0 ? palette.red : palette.textTertiary }]}>{row.streak}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <LensSurface title="Habits">
      <View style={styles.topLinksRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Routines')} hitSlop={8}>
          <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Routines →</Text>
        </TouchableOpacity>
      </View>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No habits yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to create one</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>{rows.map(renderRow)}</View>
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title="New Habit"
        placeholder="Habit name..."
        icon={<HabitRitualIcon size={38} color={palette.red} />}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <HabitQuantifiedSheet
        visible={quantifiedHabit !== null}
        habit={quantifiedHabit}
        onClose={() => setQuantifiedHabit(null)}
        onLogged={(value) => {
          if (quantifiedHabit) logHabitSample(quantifiedHabit.id, value);
          refresh();
        }}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  topLinksRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  rows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
