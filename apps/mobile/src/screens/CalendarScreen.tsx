import { useState } from 'react';
import { ScrollView, TouchableOpacity, View as RNView, Text as RNText, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar } from '../hooks/useDb';
import { formatDate, completeInstance } from '../db/database';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ChevronLeft, ChevronRight, Check } from '../icons';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

interface WeekStripProps {
  selected: Date;
  onSelect: (d: Date) => void;
  isDark: boolean;
}

function WeekStrip({ selected, onSelect, isDark }: WeekStripProps) {
  const palette = getThemeColors(isDark);
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate() - selected.getDay());
  const today = formatDate(new Date());

  return (
    <RNView style={s.weekStrip}>
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(startOfWeek, i);
        const isSelected = formatDate(day) === formatDate(selected);
        const isToday = formatDate(day) === today;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(day); }}
            style={s.weekDay}
            activeOpacity={0.6}
          >
            <RNText style={[s.dayLabel, { color: palette.textTertiary }]}>
              {DAYS[day.getDay()]}
            </RNText>
            <RNView
              style={[
                s.dayCircle,
                { backgroundColor: isSelected ? palette.text : 'transparent' },
              ]}
            >
              <RNText
                style={[
                  s.dayNumber,
                  {
                    color: isSelected ? palette.bg : isToday ? '#007aff' : palette.text,
                    fontWeight: isToday ? '800' : '400',
                  },
                ]}
              >
                {day.getDate()}
              </RNText>
            </RNView>
            {isToday && !isSelected && (
              <RNView style={s.todayDot} />
            )}
          </TouchableOpacity>
        );
      })}
    </RNView>
  );
}

export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [selected, setSelected] = useState(new Date());
  const dateStr = formatDate(selected);
  const { items, instances, refresh } = useCalendar(dateStr);
  const today = formatDate(new Date());
  const isToday = dateStr === today;

  const goWeek = (dir: number) => setSelected(prev => addDays(prev, dir * 7));

  const handleComplete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeInstance(id);
    refresh();
  };

  const isEmpty = items.length === 0 && instances.length === 0;

  return (
    <RNView style={[s.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      {/* Month + nav */}
      <RNView style={s.monthNav}>
        <TouchableOpacity onPress={() => goWeek(-1)} hitSlop={16}>
          <ChevronLeft size={18} color={palette.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        <RNView style={s.monthCenter}>
          <RNText style={[s.monthTitle, { color: palette.text }]}>
            {MONTHS[selected.getMonth()]}
          </RNText>
          <RNText style={[s.monthSub, { color: isToday ? '#007aff' : palette.textTertiary }]}>
            {isToday ? 'Today' : selected.getFullYear()}
          </RNText>
        </RNView>

        <TouchableOpacity onPress={() => goWeek(1)} hitSlop={16}>
          <ChevronRight size={18} color={palette.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </RNView>

      {/* Week strip */}
      <WeekStrip selected={selected} onSelect={setSelected} isDark={isDark} />

      {/* Divider */}
      <RNView style={[s.divider, { backgroundColor: palette.separator }]} />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {isEmpty ? (
          <RNView style={s.empty}>
            <RNText style={s.emptyIcon}>◯</RNText>
            <RNText style={[s.emptyTitle, { color: palette.text }]}>Nothing here</RNText>
            <RNText style={[s.emptySub, { color: palette.textSecondary }]}>
              {isToday ? 'Your day is clear.' : 'No items for this date.'}
            </RNText>
            {!isToday && (
              <TouchableOpacity onPress={() => setSelected(new Date())} style={{ marginTop: 12 }}>
                <RNText style={s.goToday}>Go to today →</RNText>
              </TouchableOpacity>
            )}
          </RNView>
        ) : (
          <>
            {/* Instances */}
            {instances.length > 0 && (
              <RNView style={s.section}>
                <RNText style={[s.sectionTitle, { color: palette.textTertiary }]}>
                  SCHEDULED ({instances.length})
                </RNText>
                {instances.map((instance, i) => {
                  const isDone = instance.status === 'completed';
                  const isLast = i === instances.length - 1;
                  return (
                    <RNView key={instance.id}>
                      <RNView style={s.timelineItem}>
                        <RNView style={s.timelineLeft}>
                          <TouchableOpacity
                            onPress={() => !isDone && handleComplete(instance.id)}
                            style={[
                              s.checkbox,
                              {
                                borderColor: isDone ? 'transparent' : palette.textMuted,
                                backgroundColor: isDone ? '#34a853' : 'transparent',
                              },
                            ]}
                          >
                            {isDone && <Check size={11} color="white" strokeWidth={3} />}
                          </TouchableOpacity>
                          {!isLast && <RNView style={[s.timelineConnector, { backgroundColor: palette.separator }]} />}
                        </RNView>
                        <RNView style={s.timelineContent}>
                          <RNText style={[s.itemTitle, { color: palette.text, textDecorationLine: isDone ? 'line-through' : 'none', opacity: isDone ? 0.5 : 1 }]}>
                            {instance.itemId}
                          </RNText>
                          <RNText style={[s.itemStatus, { color: palette.textTertiary }]}>
                            {isDone ? 'Completed' : 'Pending'}
                          </RNText>
                        </RNView>
                      </RNView>
                      {!isLast && <RNView style={[s.sep, { backgroundColor: palette.separator }]} />}
                    </RNView>
                  );
                })}
              </RNView>
            )}

            {/* Items */}
            {items.length > 0 && (
              <RNView style={s.section}>
                <RNText style={[s.sectionTitle, { color: palette.textTertiary }]}>
                  ITEMS ({items.length})
                </RNText>
                {items.map((item, i) => {
                  const isLast = i === items.length - 1;
                  return (
                    <RNView key={item.id}>
                      <RNView style={s.timelineItem}>
                        <RNView style={s.timelineLeft}>
                          <RNView style={[s.dot, { backgroundColor: '#007aff' }]} />
                          {!isLast && <RNView style={[s.timelineConnector, { backgroundColor: palette.separator }]} />}
                        </RNView>
                        <RNView style={s.timelineContent}>
                          <RNText style={[s.itemTitle, { color: palette.text }]}>{item.title}</RNText>
                          {item.notes && (
                            <RNText style={[s.itemNotes, { color: palette.textSecondary }]}>{item.notes}</RNText>
                          )}
                          <RNView style={[s.typeBadge, { backgroundColor: palette.fill }]}>
                            <RNText style={[s.typeBadgeText, { color: palette.textSecondary }]}>
                              {item.type}
                            </RNText>
                          </RNView>
                        </RNView>
                      </RNView>
                      {!isLast && <RNView style={[s.sep, { backgroundColor: palette.separator }]} />}
                    </RNView>
                  );
                })}
              </RNView>
            )}
          </>
        )}
      </ScrollView>
    </RNView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  monthSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#007aff',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 44,
    opacity: 0.2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  goToday: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007aff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeft: {
    width: 36,
    alignItems: 'center',
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  timelineConnector: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  itemNotes: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
  },
  itemStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
  },
});
