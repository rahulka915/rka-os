import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemWithMetadata, getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence, updateItemMetadata } from '../db/database';
import { computeStreak } from '../utils/streak';
import { buildHabitCalendarMonth, type HabitCalendarDay } from '../utils/habitCalendar';
import { POTENTIAL_STATS, POTENTIAL_STAT_LABELS, parseHabitPotentialMeta, type PotentialStat } from '../utils/potential';
import { useItemComposer } from '../components/item-composer';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ChevronLeft, ChevronRight, Flame, Pencil } from '../icons';
import type { Item } from '../db/types';

interface HabitDetailRouteParams {
  habitId: string;
  title: string;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { habitId } = route.params as HabitDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem } = useItemComposer();

  const [item, setItem] = useState<Item | null>(null);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [targetDaysText, setTargetDaysText] = useState('');

  const today = formatDate(new Date());

  const load = useCallback(() => {
    const loaded = getItemWithMetadata(habitId);
    setItem(loaded);
    setCompletedDates(getCompletedOccurrenceDates(habitId));
  }, [habitId]);

  useFocusEffect(load);

  const streak = useMemo(
    () => (item ? computeStreak(item.rrule, completedDates, today) : 0),
    [item, completedDates, today],
  );

  const calendar = useMemo(
    () => buildHabitCalendarMonth(item?.rrule, completedDates, monthAnchor, today),
    [item, completedDates, monthAnchor, today],
  );

  const sortedLog = useMemo(
    () => [...completedDates].sort((a, b) => b.localeCompare(a)),
    [completedDates],
  );

  const potentialMeta = useMemo(() => parseHabitPotentialMeta(item?.metadata), [item]);

  useEffect(() => {
    setTargetDaysText(potentialMeta.potentialTargetDays ? String(potentialMeta.potentialTargetDays) : '');
  }, [potentialMeta.potentialTargetDays]);

  const savePotentialStat = (stat: PotentialStat | null) => {
    if (!item) return;
    const existing = item.metadata ? JSON.parse(item.metadata) : {};
    if (stat === null) {
      delete existing.potentialStat;
      delete existing.potentialTargetDays;
    } else {
      existing.potentialStat = stat;
      existing.potentialTargetDays = potentialMeta.potentialTargetDays ?? 100;
    }
    updateItemMetadata(item.id, existing);
    Haptics.selectionAsync();
    load();
  };

  const saveTargetDays = () => {
    if (!item || !potentialMeta.potentialStat) return;
    const parsed = parseInt(targetDaysText, 10);
    const targetDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
    const existing = item.metadata ? JSON.parse(item.metadata) : {};
    existing.potentialTargetDays = targetDays;
    updateItemMetadata(item.id, existing);
    load();
  };

  const handleToggleDay = (day: HabitCalendarDay) => {
    if (!day.isScheduled || day.isFuture) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleHabitOccurrence(habitId, day.date);
    load();
  };

  const handleEdit = () => {
    if (!item) return;
    openEditorForItem({
      item,
      onComplete: ({ action }) => {
        if (action === 'deleted') {
          navigation.goBack();
        } else {
          load();
        }
      },
    });
  };

  if (!item) {
    return <LensSurface title="Habit"><View /></LensSurface>;
  }

  return (
    <LensSurface
      title={item.title}
      headerRight={
        <TouchableOpacity onPress={handleEdit} hitSlop={12}>
          <Pencil size={19} color={palette.text} strokeWidth={1.75} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.streakRow}>
          <Flame size={22} color={streak > 0 ? palette.red : palette.textTertiary} />
          <Text style={[styles.streakText, { color: streak > 0 ? palette.red : palette.textTertiary }]}>
            {streak} day{streak === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.potentialSection}>
          <Text style={[styles.potentialLabel, { color: palette.textTertiary }]}>POTENTIAL</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                { borderColor: palette.separator },
                !potentialMeta.potentialStat && { backgroundColor: palette.red, borderColor: palette.red },
              ]}
              onPress={() => savePotentialStat(null)}
            >
              <Text style={[styles.chipText, { color: !potentialMeta.potentialStat ? palette.surface : palette.text }]}>None</Text>
            </TouchableOpacity>
            {POTENTIAL_STATS.map((stat) => {
              const selected = potentialMeta.potentialStat === stat;
              return (
                <TouchableOpacity
                  key={stat}
                  style={[styles.chip, { borderColor: palette.separator }, selected && { backgroundColor: palette.red, borderColor: palette.red }]}
                  onPress={() => savePotentialStat(stat)}
                >
                  <Text style={[styles.chipText, { color: selected ? palette.surface : palette.text }]}>{POTENTIAL_STAT_LABELS[stat]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {potentialMeta.potentialStat && (
            <View style={styles.targetDaysRow}>
              <Text style={[styles.targetDaysLabel, { color: palette.textTertiary }]}>TARGET DAYS (100% AT)</Text>
              <TextInput
                style={[styles.targetDaysInput, { color: palette.text, borderColor: palette.separator }]}
                value={targetDaysText}
                onChangeText={setTargetDaysText}
                onBlur={saveTargetDays}
                placeholder="100"
                placeholderTextColor={palette.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          )}
        </View>

        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month - 1, 1))} hitSlop={10}>
            <ChevronLeft size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: palette.text }]}>{calendar.label}</Text>
          <TouchableOpacity onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month + 1, 1))} hitSlop={10}>
            <ChevronRight size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={[styles.weekdayLabel, { color: palette.textTertiary }]}>{label}</Text>
          ))}
        </View>

        {calendar.weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day) => {
              const disabled = !day.isScheduled || day.isFuture;
              return (
                <TouchableOpacity
                  key={day.date}
                  onPress={() => handleToggleDay(day)}
                  disabled={disabled}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      day.isCompleted && { backgroundColor: palette.red },
                      !day.isCompleted && day.isScheduled && !day.isFuture && { borderWidth: 1.5, borderColor: palette.red },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: day.isCompleted ? palette.surface : day.inCurrentMonth ? palette.text : palette.textTertiary },
                      ]}
                    >
                      {day.dayOfMonth}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <Text style={[styles.logHeader, { color: palette.textSecondary }]}>History</Text>
        {sortedLog.length === 0 ? (
          <Text style={[styles.logEmpty, { color: palette.textTertiary }]}>No check-ins yet.</Text>
        ) : (
          sortedLog.map((date) => (
            <View key={date} style={[styles.logRow, { borderBottomColor: palette.separator }]}>
              <Text style={[styles.logDate, { color: palette.text }]}>
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '700',
  },
  potentialSection: {
    marginBottom: 20,
  },
  potentialLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  targetDaysRow: {
    marginTop: 12,
    gap: 4,
  },
  targetDaysLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  targetDaysInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    fontSize: 15,
    padding: 10,
    width: 100,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
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
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  logEmpty: {
    fontSize: 14,
  },
  logRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logDate: {
    fontSize: 14,
    fontWeight: '500',
  },
});
