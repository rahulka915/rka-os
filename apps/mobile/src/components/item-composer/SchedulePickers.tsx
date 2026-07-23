import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '../../icons';
import { DateCalendarIcon } from '../icons/DateCalendarIcon';
import { TimeClockIcon } from '../icons/TimeClockIcon';
import { formatDate } from '../../db/database';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, radius, spacing } from '../../theme';
import type { ItemDraft } from './types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

type LacquerDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LacquerDatePicker({ value, onChange }: LacquerDatePickerProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const selected = localDate(value);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));

  useEffect(() => {
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  }, [value]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - leading + 1;
      return day >= 1 && day <= count ? new Date(year, month, day, 12) : null;
    });
  }, [visibleMonth]);

  const today = formatDate(new Date());
  const select = (date: Date) => {
    Haptics.selectionAsync();
    onChange(formatDate(date));
  };

  return (
    <View style={styles.pickerContent}>
      <View style={[styles.pickerCard, { backgroundColor: material.surface, borderColor: material.rim }]}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={[styles.roundButton, { backgroundColor: material.fill, borderColor: material.rim }]}
            onPress={() => setVisibleMonth((month) => shiftMonth(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={18} color={material.accent} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.monthTitleGroup}>
            <DateCalendarIcon size={34} />
            <Text style={[styles.monthTitle, { color: palette.text }]}> 
              {visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.roundButton, { backgroundColor: material.fill, borderColor: material.rim }]}
            onPress={() => setVisibleMonth((month) => shiftMonth(month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <ChevronRight size={18} color={material.accent} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((weekday, index) => (
            <Text key={`${weekday}-${index}`} style={[styles.weekday, { color: material.platinumMuted }]}>{weekday}</Text>
          ))}
        </View>

        <View style={styles.dayGrid}>
          {days.map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
            const dateValue = formatDate(date);
            const isSelected = dateValue === value;
            const isToday = dateValue === today;
            return (
              <TouchableOpacity
                key={dateValue}
                style={styles.dayCell}
                onPress={() => select(date)}
                accessibilityRole="button"
                accessibilityLabel={date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.dayDisc,
                    {
                      backgroundColor: isSelected ? material.accent : 'transparent',
                      borderColor: isToday && !isSelected ? material.rimStrong : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.dayText, { color: isSelected ? material.onAccent : palette.text }]}>{date.getDate()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.todayButton, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}
        onPress={() => {
          const date = new Date();
          setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
          select(date);
        }}
      >
        <Text style={[styles.todayText, { color: material.accent }]}>Today</Text>
      </TouchableOpacity>
    </View>
  );
}

type LacquerTimePickerProps = {
  value: string;
  minuteInterval: ItemDraft['minuteInterval'];
  onChange: (value: string) => void;
};

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : 9,
    minute: Number.isInteger(minute) && minute >= 0 && minute < 60 ? minute : 0,
  };
}

function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function LacquerTimePicker({ value, minuteInterval, onChange }: LacquerTimePickerProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const selected = parseTime(value);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteInterval) }, (_, index) => index * minuteInterval).filter((minute) => minute < 60),
    [minuteInterval],
  );

  const change = (hour: number, minute: number) => {
    Haptics.selectionAsync();
    onChange(timeValue(hour, minute));
  };

  const selectNow = () => {
    const now = new Date();
    const rounded = Math.ceil(now.getMinutes() / minuteInterval) * minuteInterval;
    const hour = rounded >= 60 ? (now.getHours() + 1) % 24 : now.getHours();
    change(hour, rounded >= 60 ? 0 : rounded);
  };

  return (
    <View style={styles.pickerContent}>
      <View style={[styles.timePreview, { backgroundColor: material.surface, borderColor: material.rim }]}> 
        <TimeClockIcon size={38} />
        <Text style={[styles.timePreviewText, { color: palette.text }]}>{timeValue(selected.hour, selected.minute)}</Text>
      </View>

      <Text style={[styles.pickerSectionLabel, { color: material.platinumMuted }]}>HOUR</Text>
      <View style={styles.optionGrid}>
        {HOURS.map((hour) => {
          const isSelected = hour === selected.hour;
          return (
            <TouchableOpacity
              key={hour}
              style={[
                styles.timeOption,
                {
                  backgroundColor: isSelected ? material.accentSoft : material.surface,
                  borderColor: isSelected ? material.rimStrong : material.rim,
                },
              ]}
              onPress={() => change(hour, selected.minute)}
              accessibilityRole="button"
              accessibilityLabel={`${String(hour).padStart(2, '0')} hours`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.timeOptionText, { color: isSelected ? material.accent : palette.textSecondary }]}>
                {String(hour).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.pickerSectionLabel, { color: material.platinumMuted }]}>MINUTE</Text>
      <View style={styles.optionGrid}>
        {minutes.map((minute) => {
          const isSelected = minute === selected.minute;
          return (
            <TouchableOpacity
              key={minute}
              style={[
                styles.timeOption,
                {
                  backgroundColor: isSelected ? material.accentSoft : material.surface,
                  borderColor: isSelected ? material.rimStrong : material.rim,
                },
              ]}
              onPress={() => change(selected.hour, minute)}
              accessibilityRole="button"
              accessibilityLabel={`${String(minute).padStart(2, '0')} minutes`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.timeOptionText, { color: isSelected ? material.accent : palette.textSecondary }]}>
                {String(minute).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.todayButton, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}
        onPress={selectNow}
      >
        <Text style={[styles.todayText, { color: material.accent }]}>Use current time</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerContent: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: 40, gap: spacing[3] },
  pickerCard: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: spacing[2] },
  monthHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  monthTitleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  monthTitle: { textAlign: 'center', fontSize: 17, fontWeight: '600', fontFamily: 'Georgia' },
  weekRow: { flexDirection: 'row', paddingTop: 4 },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 4 },
  dayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dayDisc: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  todayButton: { minHeight: 48, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  timePreview: { minHeight: 72, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  timePreviewText: { fontSize: 28, fontWeight: '600', fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  pickerSectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeOption: { width: '15.2%', minHeight: 44, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  timeOptionText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
});
