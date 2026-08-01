import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Flame, Pencil } from 'lucide-react-native';
import { getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence } from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { computeStreak } from '../utils/streak';
import { buildHabitCalendarMonth, type HabitCalendarDay } from '../utils/habitCalendar';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface HabitDetailPanelProps {
  item: Item;
  onEdit: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitDetailPanel({ item, onEdit }: HabitDetailPanelProps) {
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // Subscribes to the same Firestore-mirror change stream every other web
  // screen uses (useDbRefresh), rather than a manual revision counter —
  // toggleHabitOccurrence's write is async, so reading getCompletedOccurrenceDates
  // synchronously right after calling it can return stale data; the
  // subscription re-reads once the store actually reflects the write.
  const refresh = useCallback(() => {
    setCompletedDates(getCompletedOccurrenceDates(item.id));
  }, [item.id]);
  useDbRefresh(refresh);

  const today = formatDate(new Date());
  const streak = useMemo(() => computeStreak(item.rrule, completedDates, today), [item.rrule, completedDates, today]);
  const calendar = useMemo(
    () => buildHabitCalendarMonth(item.rrule, completedDates, monthAnchor, today),
    [item.rrule, completedDates, monthAnchor, today],
  );
  const sortedLog = useMemo(() => [...completedDates].sort((a, b) => b.localeCompare(a)), [completedDates]);

  const handleToggleDay = (day: HabitCalendarDay) => {
    if (!day.isScheduled || day.isFuture) return;
    toggleHabitOccurrence(item.id, day.date);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View style={styles.streakRow}>
        <Flame size={20} color={streak > 0 ? webColors.destructive : webColors.mutedForeground} strokeWidth={2} />
        <Text style={[styles.streakText, streak > 0 && { color: webColors.destructive }]}>
          {streak} day{streak === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.monthHeader}>
        <Pressable onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month - 1, 1))}>
          <ChevronLeft size={16} color={webColors.foreground} strokeWidth={2} />
        </Pressable>
        <Text style={styles.monthLabel}>{calendar.label}</Text>
        <Pressable onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month + 1, 1))}>
          <ChevronRight size={16} color={webColors.foreground} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {calendar.weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day) => {
            const disabled = !day.isScheduled || day.isFuture;
            return (
              <Pressable key={day.date} onPress={() => handleToggleDay(day)} disabled={disabled} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    day.isCompleted && { backgroundColor: webColors.destructive },
                    !day.isCompleted && day.isScheduled && !day.isFuture && styles.dayCircleOutline,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: day.isCompleted ? webColors.card : day.inCurrentMonth ? webColors.foreground : webColors.mutedForeground },
                    ]}
                  >
                    {day.dayOfMonth}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.logHeader}>History</Text>
      {sortedLog.length === 0 ? (
        <Text style={styles.logEmpty}>No check-ins yet.</Text>
      ) : (
        sortedLog.map((date) => (
          <View key={date} style={styles.logRow}>
            <Text style={styles.logDate}>
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginBottom: webSpacing[4],
  },
  streakText: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.mutedForeground,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[2],
  },
  monthLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: webSpacing[1],
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: webRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleOutline: {
    borderWidth: 1.5,
    borderColor: webColors.destructive,
  },
  dayText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
  },
  logHeader: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: webColors.mutedForeground,
    marginTop: webSpacing[5],
    marginBottom: webSpacing[2],
  },
  logEmpty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  logRow: {
    paddingVertical: webSpacing[2],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  logDate: {
    fontSize: webFontSize.sm,
    fontWeight: '500',
    color: webColors.foreground,
  },
});
