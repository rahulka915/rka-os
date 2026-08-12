import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, getDailyCheckIns } from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { isDailyCheckInEditable, parseDailyCheckInAnswers, type DailyCheckInPhase } from '../utils/dailyCheckIn';
import type { DailyCheckInRow } from '../db/types';
import { DetailPanel } from './DetailPanel';
import { DailyCheckInForm } from './DailyCheckInForm';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';

function useDailyLog() {
  const [rows, setRows] = useState<DailyCheckInRow[]>([]);
  const refresh = useCallback(() => {
    setRows(getDailyCheckIns(90));
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

function formatLogDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DailyLogScreen() {
  const { rows, refresh } = useDailyLog();
  const today = formatDate(new Date());
  const [openEntry, setOpenEntry] = useState<{ dateKey: string; phase: DailyCheckInPhase } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, DailyCheckInRow[]>();
    for (const row of rows) {
      const list = map.get(row.dateKey) ?? [];
      list.push(row);
      map.set(row.dateKey, list);
    }
    return [...map.entries()]
      .map(([dateKey, entries]) => ({ dateKey, entries }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [rows]);

  const activeGroup = openEntry ? groups.find((g) => g.dateKey === openEntry.dateKey) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Log</Text>
        <Text style={styles.count}>{groups.length}</Text>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(group) => group.dateKey}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No check-ins yet.</Text>}
        renderItem={({ item: group }) => {
          const morning = group.entries.find((row) => row.phase === 'morning');
          const evening = group.entries.find((row) => row.phase === 'evening');
          const morningAnswers = parseDailyCheckInAnswers(morning?.answers);
          const eveningAnswers = parseDailyCheckInAnswers(evening?.answers);
          const editable = isDailyCheckInEditable(group.dateKey);
          const isToday = group.dateKey === today;

          return (
            <View style={[styles.card, webDepth.card]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{formatLogDate(group.dateKey)}</Text>
                {isToday ? <Text style={styles.todayBadge}>Today</Text> : null}
              </View>

              <View style={styles.logLine}>
                <Text style={styles.logLabel}>Morning</Text>
                <Text style={styles.logValue}>
                  {[morningAnswers.sleepAmount, morningAnswers.sleepQuality, morningAnswers.energy, morningAnswers.mood].filter(Boolean).join(' · ') || 'Not logged'}
                </Text>
              </View>
              <View style={styles.logLine}>
                <Text style={styles.logLabel}>Evening</Text>
                <Text style={styles.logValue}>
                  {[eveningAnswers.dayShape, eveningAnswers.energyNow, eveningAnswers.moodNow].filter(Boolean).join(' · ') || 'Not logged'}
                </Text>
              </View>
              {morningAnswers.priorities.length > 0 ? (
                <Text style={styles.priorityCount}>
                  {morningAnswers.priorities.length} declared priorit{morningAnswers.priorities.length === 1 ? 'y' : 'ies'}
                </Text>
              ) : null}

              {editable ? (
                <View style={styles.actions}>
                  <Pressable onPress={() => setOpenEntry({ dateKey: group.dateKey, phase: 'morning' })} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>{morning ? 'Edit morning' : 'Add morning'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setOpenEntry({ dateKey: group.dateKey, phase: 'evening' })} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>{evening ? 'Edit evening' : 'Add evening'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <DetailPanel
        visible={!!openEntry}
        onClose={() => setOpenEntry(null)}
        title={openEntry?.phase === 'morning' ? 'Morning Check-In' : 'Evening Debrief'}
      >
        {openEntry ? (
          <DailyCheckInForm
            phase={openEntry.phase}
            dateKey={openEntry.dateKey}
            onSaved={() => {
              refresh();
              setOpenEntry(null);
            }}
            onCancel={() => setOpenEntry(null)}
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
    paddingBottom: webSpacing[8],
    gap: webSpacing[3],
  },
  empty: {
    color: webColors.mutedForeground,
    fontSize: webFontSize.base,
  },
  card: {
    backgroundColor: webColors.card,
    padding: webSpacing[4],
    marginBottom: webSpacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  todayBadge: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.accent,
    textTransform: 'uppercase',
  },
  logLine: {
    marginTop: webSpacing[3],
  },
  logLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: webColors.mutedForeground,
  },
  logValue: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    marginTop: 2,
  },
  priorityCount: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginTop: webSpacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginTop: webSpacing[4],
  },
  actionButton: {
    minHeight: 36,
    paddingHorizontal: webSpacing[3],
    borderRadius: webRadius.pill,
    borderWidth: 1,
    borderColor: webColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
  },
});
