import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Flame, Plus } from 'lucide-react-native';
import { getItemsByType, createItem, updateItemStatus, formatDate, getHabitSamples } from '../db/database';
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
import { parseHabitMeta } from '../utils/habitMeta';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { HabitDetailPanel } from './HabitDetailPanel';
import { RoutinesScreen } from './RoutinesScreen';
import { QuickAddOneControl, QuickDurationControl, HabitProgressSection, HabitMeasurementEditor, HabitPotentialEditor } from './HabitQuantifiedControls.web';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { ActivityLog } from '../db/types';

function useHabits() {
  const [rows, setRows] = useState<HabitRowData[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setRows(getItemsByType('habit').map((item) => buildHabitRowData(item, today)));
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

function useHabitSamples(itemId: string | null) {
  const [samples, setSamples] = useState<ActivityLog[]>([]);
  const refresh = useCallback(() => {
    setSamples(itemId ? getHabitSamples(itemId) : []);
  }, [itemId]);
  useDbRefresh(refresh);
  return { samples, refresh };
}

export function HabitsScreen() {
  const { rows, refresh } = useHabits();
  const [tab, setTab] = useState<'habits' | 'routines'>('habits');
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
  const selectedItem = rows.find((r) => r.item.id === selectedId)?.item ?? null;
  const { samples: selectedSamples, refresh: refreshSelectedSamples } = useHabitSamples(selectedItem?.id ?? null);

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
        <Text style={styles.count}>{tab === 'habits' ? rows.length : ''}</Text>
      </View>

      <View style={styles.tabRow}>
        <View style={styles.segmentedControl}>
          <Pressable style={[styles.segment, tab === 'habits' && styles.segmentActive]} onPress={() => setTab('habits')}>
            <Text style={[styles.segmentLabel, tab === 'habits' && styles.segmentLabelActive]}>Habits</Text>
          </Pressable>
          <Pressable style={[styles.segment, tab === 'routines' && styles.segmentActive]} onPress={() => setTab('routines')}>
            <Text style={[styles.segmentLabel, tab === 'routines' && styles.segmentLabelActive]}>Routines</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'routines' ? (
        <RoutinesScreen />
      ) : (
      <>
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
        renderItem={({ item: row }) => {
          const meta = parseHabitMeta(row.item);
          return (
            <Pressable style={styles.row} onPress={() => { setSelectedId(row.item.id); setMode('detail'); }}>
              {meta.measurement === 'binary' ? (
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
              ) : meta.measurement === 'count' ? (
                <QuickAddOneControl item={row.item} onLogged={refresh} />
              ) : (
                <QuickDurationControl item={row.item} onLogged={refresh} />
              )}
              <Text style={styles.rowTitle} numberOfLines={1}>{row.item.title}</Text>
              <View style={styles.streak}>
                <Flame size={15} color={row.streak > 0 ? webColors.destructive : webColors.mutedForeground} strokeWidth={2} />
                <Text style={[styles.streakText, row.streak > 0 && styles.streakTextActive]}>{row.streak}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={mode === 'edit' ? 'Edit Habit' : 'Habit'}>
        {selectedItem ? (
          mode === 'edit' ? (
            <>
              <ItemDetailForm
                item={selectedItem}
                onChanged={() => { refresh(); setMode('detail'); }}
                onDeleted={() => {
                  setSelectedId(null);
                  refresh();
                }}
              />
              <HabitMeasurementEditor item={selectedItem} onChanged={refresh} />
              <HabitPotentialEditor item={selectedItem} onChanged={refresh} />
            </>
          ) : (
            <>
              <HabitProgressSection item={selectedItem} samples={selectedSamples} onChanged={refreshSelectedSamples} />
              <HabitDetailPanel item={selectedItem} onEdit={() => setMode('edit')} />
            </>
          )
        ) : null}
      </DetailPanel>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[3],
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.sm - 4,
  },
  segmentActive: {
    backgroundColor: webColors.card,
  },
  segmentLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  segmentLabelActive: {
    color: webColors.foreground,
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
    ...webDepth.list,
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
