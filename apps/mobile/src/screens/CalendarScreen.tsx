import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View as RNView,
  Text as RNText,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar, useUnscheduledItems, useMonthItemCounts } from '../hooks/useDb';
import {
  CalendarPill,
  MiniTimeIcon,
  StatusChip,
} from '../components/calendar';
import {
  getTimelinePaperPalette,
  TimelinePaper,
  type TimelinePaperVariant,
} from '../components/calendar/TimelinePaper';
import { TimelineMarker } from '../components/calendar/TimelineMarker';
import { TimelinePreviewSheet } from '../components/calendar/TimelinePreviewSheet';
import { RiverStoneSurface } from '../components/riverstone';
import {
  completeInstance,
  deleteItem,
  formatDate,
  updateItemStatus,
  updateTimelineItemTime,
  updateTimelineItemSchedule,
} from '../db/database';
import type { Item, ItemType } from '../db/types';
import type { TimelineEntry } from '../db/database';
import { computeDropTarget } from '../utils/timelineDayLookup';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, radius, spacing } from '../theme';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Plus,
} from '../icons';
import { MedicationBottleIcon } from '../components/icons/MedicationBottleIcon';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
import { HabitRitualIcon, WorkoutTrainingIcon } from '../components/icons/CollectionIcons';
import {
  formatHourLabel,
  formatTimeLabel,
  getTimeOfDayFromHour,
  normalizeTimeInput,
  snapMinutesToStep,
  timeOfDayLabel,
} from '../utils/time';
import { formatTimelineTimeRange, getTimelineItemDensity } from '../utils/timelineItem';
import { useItemComposer } from '../components/item-composer';
import { getDeviceEventsForDate, type DeviceCalendarEvent } from '../services/deviceCalendar';
import { useOpenItem } from '../hooks/useOpenItem';
import { useNavigation } from '@react-navigation/native';
import { AddEventSheet } from '../components/AddEventSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { formatEventTimeLabel, parseEventMeta } from '../utils/eventMeta';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CALENDAR_GOLD = '#D4B078';
const CALENDAR_GOLD_EDGE = '#B99156';
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const TIMELINE_METRICS = {
  baseUnit: 4,
  hourHeight: 56,
  quarterMinutes: [15, 30, 45] as const,
  snapMinutes: 15,
  gutterWidth: 68,
  rowHorizontalInset: 12,
  eventGap: 8,
  hourLabelWidth: 60,
  hourLabelLineHeight: 16,
  quarterTickWidth: 8,
  quarterTickHeight: 1,
  nowMarkerSize: 24,
  nowLineThickness: 1.5,
  dayTransitionHeight: 0,
  laneHeaderHeight: 0,
} as const;
const BOTTOM_TRAY_OVERLAY_HEIGHT = 92;
const TIMELINE_PAPER_VARIANT: TimelinePaperVariant = 'A';

function timelineOffsetForMinutes(minutes: number): number {
  return (minutes / 60) * TIMELINE_METRICS.hourHeight;
}

function timelineMinutesForPixels(pixels: number): number {
  return (pixels / TIMELINE_METRICS.hourHeight) * 60;
}

type AccentKey = 'blue' | 'green' | 'orange' | 'purple' | 'red';
type TimelineLaneId = 'health' | 'focus' | 'study' | 'personal' | 'habits' | 'other';

const TIMELINE_LANES: ReadonlyArray<{
  id: TimelineLaneId;
  label: string;
  accent: AccentKey;
}> = [
  { id: 'health', label: 'Health', accent: 'red' },
  { id: 'focus', label: 'Focus', accent: 'blue' },
  { id: 'study', label: 'Study', accent: 'green' },
  { id: 'personal', label: 'Personal', accent: 'orange' },
  { id: 'habits', label: 'Habits', accent: 'purple' },
  { id: 'other', label: 'Other', accent: 'purple' },
] as const;

function parseEntryMetadata(entry: TimelineEntry): Record<string, unknown> {
  const itemMetadata = entry.item.metadata ? JSON.parse(entry.item.metadata) as Record<string, unknown> : {};
  const instanceMetadata = entry.instance?.instanceMetadata
    ? JSON.parse(entry.instance.instanceMetadata) as Record<string, unknown>
    : {};
  return { ...itemMetadata, ...instanceMetadata };
}

function getTimelineLane(entry: TimelineEntry): TimelineLaneId {
  try {
    const metadata = parseEntryMetadata(entry);
    const requestedLane = metadata.timelineLane ?? metadata.lane ?? metadata.category;
    if (typeof requestedLane === 'string') {
      const normalized = requestedLane.toLowerCase();
      const explicit = TIMELINE_LANES.find((lane) => lane.id === normalized);
      if (explicit) return explicit.id;
      if (normalized === 'work' || normalized === 'deep-work') return 'focus';
      if (normalized === 'learning') return 'study';
      if (normalized === 'flexible') return 'other';
    }
  } catch {
    // Malformed optional metadata should never prevent the timeline from rendering.
  }

  switch (entry.item.type) {
    case 'medication':
    case 'workout-template':
    case 'workout-block':
    case 'exercise':
      return 'health';
    case 'project':
      return 'focus';
    case 'area':
      return 'study';
    case 'task':
    case 'meal':
      return 'personal';
    case 'habit':
      return 'habits';
    default:
      return 'other';
  }
}

interface PositionedTimelineEntry {
  entry: TimelineEntry;
  collisionSlot: number;
}

function positionTimelineEntries(entries: TimelineEntry[]): PositionedTimelineEntry[] {
  const slotEnds = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  return [...entries]
    .filter((entry) => getEntryMinutes(entry) != null)
    .sort((left, right) => (getEntryMinutes(left) ?? 0) - (getEntryMinutes(right) ?? 0))
    .map((entry) => {
      const start = getEntryMinutes(entry) ?? 0;
      const end = start + Math.max(15, entry.durationMinutes);
      const freeSlot = slotEnds.findIndex((slotEnd) => slotEnd <= start);
      const collisionSlot = freeSlot >= 0 ? freeSlot : 0;
      slotEnds[collisionSlot] = end;
      return { entry, collisionSlot };
    });
}

const TYPE_OPTIONS: Array<{
  value: ItemType;
  label: string;
  accent: AccentKey;
  icon: 'task' | 'project' | 'habit' | 'medication' | 'workout' | 'meal' | 'area';
}> = [
  { value: 'task', label: 'Task', accent: 'blue', icon: 'task' },
  { value: 'project', label: 'Mission', accent: 'purple', icon: 'project' },
  { value: 'area', label: 'Domain', accent: 'blue', icon: 'area' },
  { value: 'habit', label: 'Habit', accent: 'green', icon: 'habit' },
  { value: 'medication', label: 'Medication', accent: 'orange', icon: 'medication' },
  { value: 'workout-template', label: 'Workout', accent: 'red', icon: 'workout' },
  { value: 'meal', label: 'Meal', accent: 'orange', icon: 'meal' },
];

function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

function capitalizeType(type: string): string {
  return type
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function getAccentColor(palette: ReturnType<typeof getThemeColors>, accent: AccentKey): string {
  switch (accent) {
    case 'green':
      return palette.green;
    case 'orange':
      return palette.orange;
    case 'purple':
      return palette.purple;
    case 'red':
      return palette.red;
    case 'blue':
    default:
      return palette.blue;
  }
}

function getAccentSoftColor(palette: ReturnType<typeof getThemeColors>, accent: AccentKey): string {
  switch (accent) {
    case 'green':
      return palette.greenSoft;
    case 'orange':
      return palette.orangeSoft;
    case 'purple':
      return palette.purpleSoft;
    case 'red':
      return palette.redSoft;
    case 'blue':
    default:
      return palette.blueSoft;
  }
}

function getTypeMeta(type: ItemType): { label: string; accent: AccentKey } {
  const option = TYPE_OPTIONS.find((entry) => entry.value === type);
  if (option) return { label: option.label, accent: option.accent };
  return { label: capitalizeType(type), accent: 'blue' };
}

function renderTypeIcon(type: ItemType, color: string, size = 14) {
  switch (type) {
    case 'project':
      return <ProjectPortfolioIcon size={Math.max(size + 8, 22)} />;
    case 'area':
      return <AreaBonsaiIcon size={Math.max(size + 8, 22)} />;
    case 'habit':
      return <HabitRitualIcon size={size + 5} color={color} />;
    case 'medication':
      return <MedicationBottleIcon size={size} color={color} />;
    case 'workout-template':
      return <WorkoutTrainingIcon size={size + 5} color={color} />;
    case 'meal':
      return <Clock size={size} color={color} strokeWidth={1.8} />;
    case 'task':
    default:
      return <ClipboardList size={size} color={color} strokeWidth={1.7} />;
  }
}

function getDefaultTime(isToday: boolean): string {
  const now = new Date();
  if (!isToday) return '09:00';
  const roundedMinutes = Math.round(now.getMinutes() / TIMELINE_METRICS.snapMinutes) * TIMELINE_METRICS.snapMinutes;
  const nextHour = roundedMinutes >= 60 ? (now.getHours() + 1) % 24 : now.getHours();
  const nextMinute = roundedMinutes >= 60 ? 0 : roundedMinutes;
  return formatTimeLabel(snapMinutesToStep(nextHour * 60 + nextMinute, TIMELINE_METRICS.snapMinutes));
}

function getEntryMinutes(entry: TimelineEntry): number | null {
  if (entry.minutes != null) return entry.minutes;
  const parsed = normalizeTimeInput(entry.time);
  return parsed ? Number(parsed.split(':')[0]) * 60 + Number(parsed.split(':')[1]) : null;
}

function getDraggedMinutes(baseMinutes: number, deltaY: number): number {
  return snapMinutesToStep(baseMinutes + timelineMinutesForPixels(deltaY), TIMELINE_METRICS.snapMinutes);
}

interface MonthGridProps {
  monthDate: Date;
  selected: Date;
  isDark: boolean;
  onSelectDay: (d: Date) => void;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function MonthGrid({ monthDate, selected, isDark, onSelectDay }: MonthGridProps) {
  const palette = getThemeColors(isDark);
  const monthStart = startOfMonth(monthDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridDays = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const gridStartStr = formatDate(gridDays[0]);
  const gridEndStr = formatDate(gridDays[gridDays.length - 1]);
  const { counts } = useMonthItemCounts(gridStartStr, gridEndStr);
  const today = formatDate(new Date());
  const selectedStr = formatDate(selected);

  const weeks = Array.from({ length: 6 }, (_, weekIndex) => gridDays.slice(weekIndex * 7, weekIndex * 7 + 7));

  return (
    <RNView style={s.monthGrid}>
      <RNView style={s.monthGridWeekdayRow}>
        {DAYS.map((day) => (
          <RNText key={day} style={[s.monthGridWeekdayLabel, { color: palette.textTertiary }]}>
            {day[0]}
          </RNText>
        ))}
      </RNView>
      <RNView style={s.monthGridBody}>
        {weeks.map((week, weekIndex) => (
          <RNView key={weekIndex} style={s.monthGridWeekRow}>
            {week.map((day) => {
              const dayStr = formatDate(day);
              const isCurrentMonth = day.getMonth() === monthDate.getMonth();
              const isToday = dayStr === today;
              const isSelected = dayStr === selectedStr;
              const count = counts[dayStr] ?? 0;
              return (
                <TouchableOpacity
                  key={dayStr}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDay(day);
                  }}
                  style={s.monthGridCell}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  accessibilityState={{ selected: isSelected }}
                >
                  <RNView
                    style={[
                      s.monthGridDayCircle,
                      isSelected && { backgroundColor: CALENDAR_GOLD },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: palette.blue },
                    ]}
                  >
                    <RNText
                      style={[
                        s.monthGridDayNumber,
                        {
                          color: isSelected
                            ? '#1a1204'
                            : isCurrentMonth
                              ? palette.text
                              : palette.textTertiary,
                          opacity: isCurrentMonth ? 1 : 0.4,
                        },
                      ]}
                    >
                      {day.getDate()}
                    </RNText>
                  </RNView>
                  <RNView
                    style={[
                      s.monthGridDot,
                      { backgroundColor: count > 0 ? (isSelected ? CALENDAR_GOLD : palette.blue) : 'transparent' },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </RNView>
        ))}
      </RNView>
    </RNView>
  );
}

interface CalendarAgendaPreviewProps {
  date: Date;
  entries: TimelineEntry[];
  palette: ReturnType<typeof getThemeColors>;
  onOpenTimeline: () => void;
}

function CalendarAgendaPreview({ date, entries, palette, onOpenTimeline }: CalendarAgendaPreviewProps) {
  const plannedEntries = [...entries]
    .filter((entry) => getEntryMinutes(entry) != null)
    .sort((left, right) => (getEntryMinutes(left) ?? 0) - (getEntryMinutes(right) ?? 0))
    .slice(0, 2);

  return (
    <RNView style={[s.calendarAgenda, { borderTopColor: palette.separator }]}>
      <RNView style={s.calendarAgendaHeader}>
        <RNText style={[s.calendarAgendaTitle, { color: palette.text }]}>
          {date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </RNText>
        <TouchableOpacity onPress={onOpenTimeline} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open day timeline">
          <RNText style={s.calendarAgendaAction}>View timeline</RNText>
        </TouchableOpacity>
      </RNView>
      {plannedEntries.length === 0 ? (
        <TouchableOpacity onPress={onOpenTimeline} style={s.calendarAgendaEmpty} activeOpacity={0.75}>
          <RNText style={[s.calendarAgendaEmptyTitle, { color: palette.text }]}>Your day is open</RNText>
          <RNText style={[s.calendarAgendaEmptyCopy, { color: palette.textTertiary }]}>Choose something worth making space for.</RNText>
        </TouchableOpacity>
      ) : (
        plannedEntries.map((entry) => {
          const typeMeta = getTypeMeta(entry.item.type);
          const accent = getAccentColor(palette, typeMeta.accent);
          const minutes = getEntryMinutes(entry) ?? 0;
          return (
            <TouchableOpacity key={entry.instance?.id ?? entry.item.id} onPress={onOpenTimeline} style={s.calendarAgendaRow} activeOpacity={0.75}>
              <RNView style={[s.calendarAgendaAccent, { backgroundColor: accent }]} />
              <RNText style={[s.calendarAgendaTime, { color: palette.textSecondary }]}>{formatTimeLabel(minutes)}</RNText>
              <RNText style={[s.calendarAgendaRowTitle, { color: palette.text }]} numberOfLines={1}>{entry.item.title}</RNText>
            </TouchableOpacity>
          );
        })
      )}
    </RNView>
  );
}

interface TimelineEntryCardProps {
  entry: TimelineEntry;
  palette: ReturnType<typeof getThemeColors>;
  isDark: boolean;
  isToday: boolean;
  onOpen: (entry: TimelineEntry) => void;
  onComplete: (entry: TimelineEntry) => void;
  onMove: (entry: TimelineEntry, minutesDelta: number) => void;
  onMoveToNow: (entry: TimelineEntry) => void;
  onDelete: (entry: TimelineEntry) => void;
  onReschedule: (entry: TimelineEntry, nextTime: string) => void;
}

function TimelineEntryCard({
  entry,
  palette,
  isDark,
  onOpen,
  onReschedule,
}: TimelineEntryCardProps) {
  const typeMeta = getTypeMeta(entry.item.type);
  const accentColor = getAccentColor(palette, typeMeta.accent);
  const accentSoft = getAccentSoftColor(palette, typeMeta.accent);
  const completed = entry.instance?.status === 'completed' || entry.item.status === 'completed';
  const baseMinutes = getEntryMinutes(entry);
  const density = getTimelineItemDensity(entry.durationMinutes);
  const cardHeight = density === 'short'
    ? 44
    : density === 'standard'
      ? Math.max(74, Math.min(88, timelineOffsetForMinutes(entry.durationMinutes)))
      : Math.max(96, Math.min(132, timelineOffsetForMinutes(entry.durationMinutes)));
  const [isDragging, setIsDragging] = useState(false);
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const dragInProgressRef = useRef(false);
  const lastPreviewMinutesRef = useRef<number | null>(null);
  const displayMinutes = previewMinutes ?? baseMinutes;
  const timeLabel = displayMinutes != null
    ? formatTimelineTimeRange(displayMinutes, entry.durationMinutes)
    : 'Anytime';
  const statusLabel = completed
    ? 'Done'
    : entry.minutes == null
      ? 'Flexible'
      : entry.instance?.status === 'pending'
        ? 'Planned'
        : 'Scheduled';

  const beginDrag = () => {
    setIsDragging(true);
    dragInProgressRef.current = true;
    lastPreviewMinutesRef.current = baseMinutes;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateDrag = (translationY: number) => {
    if (baseMinutes == null) return;
    translateY.setValue(translationY);
    const nextMinutes = getDraggedMinutes(baseMinutes, translationY);
    setPreviewMinutes(nextMinutes);
    if (lastPreviewMinutesRef.current != null && nextMinutes !== lastPreviewMinutesRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    lastPreviewMinutesRef.current = nextMinutes;
  };

  const finishDrag = (translationY: number, commit: boolean) => {
    if (!dragInProgressRef.current || baseMinutes == null) return;
    const nextMinutes = getDraggedMinutes(baseMinutes, translationY);
    dragInProgressRef.current = false;
    lastPreviewMinutesRef.current = null;
    setIsDragging(false);
    setPreviewMinutes(null);
    Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();

    if (commit && nextMinutes !== baseMinutes) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onReschedule(entry, formatTimeLabel(nextMinutes));
    }
  };

  const cardGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(280)
      .onEnd((_, success) => {
        if (success) onOpen(entry);
      });

    if (baseMinutes == null) return tap;

    // Keep long-press activation and movement in one native recognizer. Splitting them
    // between a TouchableOpacity and nested PanResponder disarmed the drag as ownership changed.
    const drag = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(300)
      .onStart(beginDrag)
      .onUpdate((event) => updateDrag(event.translationY))
      .onEnd((event, success) => finishDrag(event.translationY, success))
      .onFinalize((event, success) => {
        if (!success) finishDrag(event.translationY, false);
      });

    return Gesture.Exclusive(drag, tap);
  }, [baseMinutes, entry, onOpen, onReschedule, translateY]);

  return (
    <GestureDetector gesture={cardGesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${entry.item.title}, ${timeLabel}`}
        accessibilityHint="Tap to edit. Touch and hold, then drag to reschedule."
        onAccessibilityTap={() => onOpen(entry)}
        style={[
          s.entryOuter,
          {
            zIndex: isDragging ? 20 : 1,
            elevation: isDragging ? 8 : 0,
            transform: [
              { translateY },
              { scale: isDragging ? 1.012 : 1 },
            ],
            opacity: completed ? 0.82 : 1,
            height: cardHeight,
          },
        ]}
      >
        <RNView
          style={[
            s.entryCard,
            {
              backgroundColor: palette.surface,
              borderColor: completed ? palette.separator : accentSoft,
              shadowColor: accentColor,
            },
            isDragging && s.entryCardDragging,
          ]}
        >
          <RNView style={[s.entryAccent, { backgroundColor: accentColor }]} />
          <RNView style={[s.entryBody, density === 'short' ? s.entryBodyShort : density === 'long' ? s.entryBodyLong : null]}>
            {density === 'short' ? (
              <RNView style={s.shortEntryRow}>
                <RNView style={s.shortTitleRow}>
                  {renderTypeIcon(entry.item.type, accentColor, 12)}
                  <RNText
                    style={[s.shortEntryTitle, { color: palette.text, textDecorationLine: completed ? 'line-through' : 'none' }]}
                    numberOfLines={1}
                  >
                    {entry.item.title}
                  </RNText>
                </RNView>
                <RNText style={[s.shortEntryTime, { color: palette.textSecondary }]} numberOfLines={1}>
                  {displayMinutes != null ? formatTimeLabel(displayMinutes) : 'Anytime'}
                </RNText>
              </RNView>
            ) : (
              <>
                <RNView style={s.entryTopRow}>
                  <RNText style={[s.entryTimeRange, { color: palette.textSecondary }]} numberOfLines={1}>
                    {timeLabel}
                  </RNText>
                  <RNText style={[s.statusLabel, { color: completed ? palette.green : palette.textSecondary }]} numberOfLines={1}>
                    {statusLabel}
                  </RNText>
                </RNView>

                <RNText
                  style={[
                    s.entryTitle,
                    { color: palette.text, textDecorationLine: completed ? 'line-through' : 'none' },
                  ]}
                  numberOfLines={density === 'long' ? 2 : 1}
                >
                  {entry.item.title}
                </RNText>

                <RNView style={s.entryMetaRow}>
                  {renderTypeIcon(entry.item.type, palette.textSecondary, 12)}
                  <RNText style={[s.entryMetaText, { color: palette.textSecondary }]} numberOfLines={1}>
                    {typeMeta.label} · {timeOfDayLabel(entry.preferredTimeBucket)}
                  </RNText>
                </RNView>

                {density === 'long' && entry.item.notes ? (
                  <RNText style={[s.entryNotes, { color: palette.textTertiary }]} numberOfLines={1}>
                    {entry.item.notes}
                  </RNText>
                ) : null}
              </>
            )}

            {isDragging && previewMinutes != null && baseMinutes != null ? (
              <RNView style={[s.dragPreview, { backgroundColor: accentSoft, borderColor: accentColor }]}>
                <Clock size={12} color={accentColor} strokeWidth={1.8} />
                <RNText style={[s.dragPreviewTime, { color: accentColor }]}>
                  {formatTimelineTimeRange(previewMinutes, entry.durationMinutes)}
                </RNText>
              </RNView>
            ) : null}
          </RNView>
        </RNView>
      </Animated.View>
    </GestureDetector>
  );
}

interface TrayCardProps {
  id: string;
  title: string;
  type: ItemType;
  timeLabel: string;
  palette: ReturnType<typeof getThemeColors>;
  onPress: () => void;
  onDragUpdate: (absoluteY: number) => void;
  onDragEnd: (absoluteY: number, committed: boolean) => void;
}

function TrayCard({ title, type, timeLabel, palette, onPress, onDragUpdate, onDragEnd }: TrayCardProps) {
  const typeMeta = getTypeMeta(type);
  const accentColor = getAccentColor(palette, typeMeta.accent);
  const detailLabel = timeLabel === 'No date' ? `${typeMeta.label} · Unplanned` : `${typeMeta.label} · ${timeLabel}`;
  const [isDragging, setIsDragging] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const cardGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(280)
      .onEnd((_, success) => {
        if (success) onPress();
      });

    const drag = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(300)
      .onStart(() => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((event) => {
        translateY.setValue(event.translationY);
        onDragUpdate(event.absoluteY);
      })
      .onEnd((event, success) => {
        setIsDragging(false);
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        onDragEnd(event.absoluteY, success);
      })
      .onFinalize((event, success) => {
        if (!success) {
          setIsDragging(false);
          Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        }
      });

    return Gesture.Exclusive(drag, tap);
  }, [onDragEnd, onDragUpdate, onPress, translateY]);

  return (
    <GestureDetector gesture={cardGesture}>
      <Animated.View
        style={[
          s.trayCard,
          {
            backgroundColor: isDragging ? palette.surface : 'transparent',
            borderColor: isDragging ? accentColor : palette.separator,
            borderWidth: isDragging ? 1 : 0,
            borderBottomWidth: isDragging ? 1 : StyleSheet.hairlineWidth,
            transform: [{ translateY }, { scale: isDragging ? 1.03 : 1 }],
            zIndex: isDragging ? 20 : 1,
            elevation: isDragging ? 6 : 0,
          },
        ]}
      >
        <RNView style={[s.trayCardAccent, { backgroundColor: accentColor }]} />
        <RNView style={[s.trayCardIcon, { backgroundColor: `${accentColor}18` }]}>
          {renderTypeIcon(type, accentColor, 13)}
        </RNView>
        <RNView style={s.trayCardCopy}>
          <RNText style={[s.trayCardTitle, { color: palette.text }]} numberOfLines={2}>
            {title}
          </RNText>
          <RNText style={[s.trayCardDetail, { color: palette.textTertiary }]} numberOfLines={1}>
            {detailLabel}
          </RNText>
        </RNView>
        <RNView style={s.trayCardGrip} pointerEvents="none">
          {[0, 1, 2].map((row) => (
            <RNView key={row} style={s.trayCardGripRow}>
              <RNView style={[s.trayCardGripDot, { backgroundColor: palette.textTertiary }]} />
              <RNView style={[s.trayCardGripDot, { backgroundColor: palette.textTertiary }]} />
            </RNView>
          ))}
        </RNView>
      </Animated.View>
    </GestureDetector>
  );
}

interface DayTimelineProps {
  dateStr: string;
  entries: TimelineEntry[];
  palette: ReturnType<typeof getThemeColors>;
  isDark: boolean;
  isThisDayToday: boolean;
  liveNow: Date;
  currentHour: number;
  currentMinute: number;
  onSectionLayout: (y: number) => void;
  onOpenCreate: (time?: string, durationMinutes?: number) => void;
  onOpenPreview: (entry: TimelineEntry) => void;
  onOpenEdit: (entry: TimelineEntry) => void;
  dragHighlightMinutes: number | null | undefined;
  showEmptyState?: boolean;
  busyEvents?: DeviceCalendarEvent[];
}

function DayTimeline({
  dateStr,
  entries,
  palette,
  isDark,
  isThisDayToday,
  liveNow,
  currentHour,
  currentMinute,
  onSectionLayout,
  onOpenCreate,
  onOpenPreview,
  onOpenEdit,
  dragHighlightMinutes,
  showEmptyState = false,
  busyEvents = [],
}: DayTimelineProps) {
  const currentLineTop = isThisDayToday
    ? timelineOffsetForMinutes(currentHour * 60 + currentMinute)
    : null;
  const positionedEntries = useMemo(() => positionTimelineEntries(entries), [entries]);
  const [createRange, setCreateRange] = useState<{ startMinutes: number; endMinutes: number } | null>(null);
  const createRangeRef = useRef<{ startMinutes: number; endMinutes: number } | null>(null);
  const lastCreateSnapRef = useRef<number | null>(null);

  const beginCreate = (startMinutes: number) => {
    const next = { startMinutes, endMinutes: startMinutes + TIMELINE_METRICS.snapMinutes };
    createRangeRef.current = next;
    lastCreateSnapRef.current = startMinutes;
    setCreateRange(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateCreate = (rawEndMinutes: number) => {
    const current = createRangeRef.current;
    if (!current) return;
    const clampedToDay = Math.max(0, Math.min(24 * 60, rawEndMinutes));
    const endMinutes = clampedToDay >= current.startMinutes
      ? Math.max(clampedToDay, current.startMinutes + TIMELINE_METRICS.snapMinutes)
      : Math.min(clampedToDay, current.startMinutes - TIMELINE_METRICS.snapMinutes);
    if (lastCreateSnapRef.current != null && endMinutes !== lastCreateSnapRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    lastCreateSnapRef.current = endMinutes;
    const next = { ...current, endMinutes };
    createRangeRef.current = next;
    setCreateRange(next);
  };

  // Read + clear the ref before calling onOpenCreate (rather than doing this inside a
  // setState updater) — updater functions can run more than once for a single commit
  // (React replays them), and firing openCapture from inside one caused it to open twice
  // in quick succession, which stomped the in-progress typing in the capture sheet.
  const commitCreate = () => {
    const current = createRangeRef.current;
    createRangeRef.current = null;
    lastCreateSnapRef.current = null;
    setCreateRange(null);
    if (!current) return;
    const start = Math.min(current.startMinutes, current.endMinutes);
    const end = Math.max(current.startMinutes, current.endMinutes);
    onOpenCreate(formatTimeLabel(start), Math.max(TIMELINE_METRICS.snapMinutes, end - start));
  };

  const createGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(300)
        .onStart((e) => {
          const start = snapMinutesToStep(timelineMinutesForPixels(e.y), TIMELINE_METRICS.snapMinutes);
          beginCreate(start);
        })
        .onUpdate((e) => {
          const end = snapMinutesToStep(timelineMinutesForPixels(e.y), TIMELINE_METRICS.snapMinutes);
          updateCreate(end);
        })
        .onEnd(() => {
          commitCreate();
        }),
    [onOpenCreate],
  );
  const paper = getTimelinePaperPalette(TIMELINE_PAPER_VARIANT, isDark ? 'dark' : 'light');
  const atmosphereColors = isDark
    ? [
        'rgba(109,109,214,0.026)',
        'rgba(109,109,214,0.014)',
        'rgba(212,176,120,0.046)',
        'rgba(212,176,120,0.018)',
        'rgba(217,130,104,0.042)',
        'rgba(217,130,104,0.016)',
        'rgba(109,109,214,0.050)',
        'rgba(109,109,214,0.026)',
      ] as const
    : [
        'rgba(109,109,214,0.016)',
        'rgba(109,109,214,0.008)',
        'rgba(212,176,120,0.030)',
        'rgba(212,176,120,0.012)',
        'rgba(217,130,104,0.026)',
        'rgba(217,130,104,0.010)',
        'rgba(109,109,214,0.030)',
        'rgba(109,109,214,0.016)',
      ] as const;

  return (
    <RNView
      style={[s.section, s.daySection]}
      onLayout={(event) => onSectionLayout(event.nativeEvent.layout.y)}
    >
      <RNView style={s.timelineWrap}>
        <GestureDetector gesture={createGesture}>
        <RNView style={[s.timelineContent, { height: TIMELINE_METRICS.hourHeight * 24 }]}>
          {typeof dragHighlightMinutes === 'number' && (
            <RNView
              pointerEvents="none"
              style={[
                s.dropHighlightRow,
                { top: timelineOffsetForMinutes(dragHighlightMinutes), borderColor: CALENDAR_GOLD },
              ]}
            />
          )}
          <ExpoLinearGradient
            pointerEvents="none"
            colors={atmosphereColors}
            locations={[0, 0.18, 0.31, 0.48, 0.63, 0.74, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
          {currentLineTop != null ? (
            <RNView pointerEvents="none" style={[s.currentLine, { top: currentLineTop }]}>
              <RNView style={[s.nowMarker, { borderColor: palette.blue, backgroundColor: paper.base }]}>
                <MiniTimeIcon period="afternoon" kind="sun" size={13} color={palette.blue} />
              </RNView>
              <RNView style={[s.currentLineTrack, { backgroundColor: palette.blue }]} />
              <StatusChip
                status="now"
                compact
                label={`Now ${liveNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                style={s.currentStatusChip}
              />
              <RNView style={[s.currentLineTrack, { backgroundColor: palette.blue }]} />
            </RNView>
          ) : null}

          {HOURS.map((hour) => {
            const isCurrentHour = isThisDayToday && hour === currentHour;
            return (
              <RNView
                key={hour}
                style={[
                  s.hourRow,
                  {
                    height: TIMELINE_METRICS.hourHeight,
                    borderBottomColor: paper.ruleStrong,
                    backgroundColor: 'transparent',
                  },
                ]}
              >
                <RNView pointerEvents="none" style={s.quarterGrid}>
                  {TIMELINE_METRICS.quarterMinutes.map((minute) => (
                    <RNView
                      key={minute}
                      style={[
                        s.quarterGridLine,
                        {
                          top: timelineOffsetForMinutes(minute),
                          borderColor: isCurrentHour ? `${palette.blue}30` : paper.rule,
                        },
                      ]}
                    />
                  ))}
                </RNView>
                <RNView
                  style={[
                    s.hourRail,
                    {
                      backgroundColor: 'transparent',
                      borderRightColor: isCurrentHour ? palette.blue : paper.rule,
                    },
                  ]}
                >
                  <RNView style={[s.hourDivider, { backgroundColor: isCurrentHour ? palette.blue : paper.ruleStrong }]} />
                  <RNText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={[
                      s.hourLabel,
                      hour === 0 && s.firstHourLabel,
                      {
                        color: isCurrentHour ? palette.blue : paper.primaryInk,
                        opacity: isCurrentHour ? 1 : 0.82,
                      },
                    ]}
                  >
                    {formatHourLabel(hour)}
                  </RNText>
                  <RNView style={s.quarterMarks}>
                    {TIMELINE_METRICS.quarterMinutes.map((minute) => (
                      <RNView
                        key={minute}
                        style={[
                          s.quarterMark,
                          {
                            top: timelineOffsetForMinutes(minute) - TIMELINE_METRICS.quarterTickHeight / 2,
                          },
                        ]}
                      >
                        <RNView
                          style={[
                            s.quarterTick,
                            {
                              backgroundColor: isCurrentHour ? palette.blue : paper.ruleStrong,
                            },
                          ]}
                        />
                      </RNView>
                    ))}
                  </RNView>
                </RNView>

                <RNView style={s.hourBody} />
              </RNView>
            );
          })}

          <RNText pointerEvents="none" style={[s.endOfDayLabel, { color: paper.primaryInk }]}>23:59</RNText>

          {createRange ? (
            <RNView
              pointerEvents="none"
              style={[
                s.createRangeOverlay,
                {
                  top: timelineOffsetForMinutes(Math.min(createRange.startMinutes, createRange.endMinutes)),
                  height: Math.max(
                    1,
                    timelineOffsetForMinutes(Math.max(createRange.startMinutes, createRange.endMinutes)) -
                      timelineOffsetForMinutes(Math.min(createRange.startMinutes, createRange.endMinutes)),
                  ),
                  borderColor: palette.blue,
                  backgroundColor: `${palette.blue}22`,
                },
              ]}
            >
              <RNView style={[s.createRangeLabel, { backgroundColor: palette.blue }]}>
                <RNText style={s.createRangeLabelText}>
                  {formatTimelineTimeRange(
                    Math.min(createRange.startMinutes, createRange.endMinutes),
                    Math.abs(createRange.endMinutes - createRange.startMinutes),
                  )}
                </RNText>
              </RNView>
            </RNView>
          ) : null}

          {busyEvents.length > 0 ? (
            <RNView pointerEvents="box-none" style={s.markerLayer}>
              {busyEvents.map((busyEvent) => (
                <RNView
                  key={`busy-${busyEvent.id}`}
                  pointerEvents="none"
                  accessibilityLabel={`Busy: ${busyEvent.title}, ${formatTimelineTimeRange(busyEvent.startMinutes, busyEvent.durationMinutes)}`}
                  style={[
                    s.busyBlock,
                    {
                      top: timelineOffsetForMinutes(busyEvent.startMinutes),
                      height: Math.max(18, timelineOffsetForMinutes(busyEvent.durationMinutes)),
                      borderColor: paper.ruleStrong,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    },
                  ]}
                >
                  <RNText numberOfLines={1} style={[s.busyBlockText, { color: paper.primaryInk }]}>
                    {busyEvent.title} · {formatTimelineTimeRange(busyEvent.startMinutes, busyEvent.durationMinutes)}
                  </RNText>
                </RNView>
              ))}
            </RNView>
          ) : null}

          <RNView pointerEvents="box-none" style={s.markerLayer}>
            {positionedEntries.map(({ entry, collisionSlot }) => {
              const lane = TIMELINE_LANES.find((candidate) => candidate.id === getTimelineLane(entry)) ?? TIMELINE_LANES[0];
              const accentColor = getAccentColor(palette, lane.accent);
              const accentSoftColor = getAccentSoftColor(palette, lane.accent);
              const entryMinutes = getEntryMinutes(entry) ?? 0;
              const completed = entry.instance?.status === 'completed' || entry.item.status === 'completed';
              return (
                <TimelineMarker
                  key={entry.instance?.id ?? entry.item.id}
                  top={timelineOffsetForMinutes(entryMinutes)}
                  left="0%"
                  width="100%"
                  durationHeight={timelineOffsetForMinutes(entry.durationMinutes)}
                  accentColor={accentColor}
                  accentSoftColor={accentSoftColor}
                  completed={completed}
                  collisionSlot={collisionSlot}
                  icon={renderTypeIcon(entry.item.type, accentColor, 12)}
                  title={entry.item.title}
                  timeLabel={formatTimelineTimeRange(entryMinutes, entry.durationMinutes)}
                  textColor={palette.text}
                  accessibilityLabel={`${entry.item.title}, ${formatTimelineTimeRange(entryMinutes, entry.durationMinutes)}, ${lane.label}`}
                  onPreview={() => onOpenPreview(entry)}
                  onEdit={() => onOpenEdit(entry)}
                />
              );
            })}
          </RNView>
          {showEmptyState ? (
            <TouchableOpacity
              onPress={() => onOpenCreate(getDefaultTime(isThisDayToday))}
              activeOpacity={0.8}
              style={[s.timelineEmptyState, { top: timelineOffsetForMinutes(10 * 60), backgroundColor: paper.base, borderColor: `${CALENDAR_GOLD}66` }]}
              accessibilityRole="button"
              accessibilityLabel="Plan a block"
            >
              <ProjectPortfolioIcon size={34} />
              <RNText style={[s.timelineEmptyTitle, { color: palette.text }]}>Your day is open</RNText>
              <RNText style={[s.timelineEmptyCopy, { color: palette.textTertiary }]}>Choose something worth making space for.</RNText>
              <RNText style={s.timelineEmptyAction}>Plan a block</RNText>
            </TouchableOpacity>
          ) : null}
        </RNView>
        </GestureDetector>
      </RNView>
    </RNView>
  );
}

export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openCapture, revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const navigation = useNavigation<any>();
  const [selected, setSelected] = useState(new Date());
  const [nowTick, setNowTick] = useState(Date.now());
  const [daySectionLayouts, setDaySectionLayouts] = useState<Record<string, { y: number }>>({});
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [showJumpToNow, setShowJumpToNow] = useState(false);
  const [preview, setPreview] = useState<{ entry: TimelineEntry; dateStr: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef<string | null>(null);
  const lastHourTickRef = useRef<number | null>(null);
  const scrollYRef = useRef(0);
  const scrollViewAbsoluteYRef = useRef(0);
  const [dragTarget, setDragTarget] = useState<{ dateStr: string; minutes: number | null } | null>(null);
  const [activeView, setActiveView] = useState<'timeline' | 'calendar'>('timeline');

  const dateStr = formatDate(selected);
  const todayStr = formatDate(new Date());
  const isToday = dateStr === todayStr;
  const liveNow = new Date(nowTick);
  const currentHour = liveNow.getHours();
  const currentMinute = liveNow.getMinutes();

  const { timelineEntries, refresh } = useCalendar(dateStr);
  const refreshAll = refresh;

  useEffect(() => {
    refresh();
  }, [composerRevision, refresh]);

  const [busyEvents, setBusyEvents] = useState<DeviceCalendarEvent[]>([]);

  // Read-only device-calendar overlay — fixed "busy" blocks you schedule around, never
  // editable/completable/draggable here since RKA never writes back to the device calendar.
  useEffect(() => {
    let cancelled = false;
    getDeviceEventsForDate(selected)
      .then((events) => {
        if (!cancelled) setBusyEvents(events);
      })
      .catch(() => {
        if (!cancelled) setBusyEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dateStr]);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // "Now" is available when the selected day is today; both entry points use
  // the same target so the selected-day timeline stays spatially predictable.
  const getNowTargetY = (): number | null => {
    const sectionY = daySectionLayouts[todayStr]?.y;
    if (sectionY == null || !scrollViewportHeight) return null;
    const nowY = sectionY
      + TIMELINE_METRICS.dayTransitionHeight
      + TIMELINE_METRICS.laneHeaderHeight
      + timelineOffsetForMinutes(currentHour * 60 + currentMinute);
    const visibleTimelineHeight = Math.max(
      TIMELINE_METRICS.hourHeight * 3,
      scrollViewportHeight - BOTTOM_TRAY_OVERLAY_HEIGHT,
    );
    return Math.max(0, nowY - visibleTimelineHeight / 2);
  };

  // Selection always drives scroll (never the reverse): jumping to a new day
  // re-centers on "now" if that day is today, or scrolls to that day's top
  // section otherwise. The target derives from the same fixed minute scale as
  // markers and grid lines, so event density cannot move it.
  useEffect(() => {
    if (autoScrollRef.current === dateStr) return;
    const sectionY = daySectionLayouts[dateStr]?.y;
    if (sectionY == null) return;

    let targetY = Math.max(0, sectionY);

    if (isToday) {
      const nowTargetY = getNowTargetY();
      if (nowTargetY == null) return;
      targetY = nowTargetY;
    }

    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
    });

    autoScrollRef.current = dateStr;
    return () => cancelAnimationFrame(frame);
  }, [currentHour, currentMinute, dateStr, daySectionLayouts, isToday, scrollViewportHeight]);

  const jumpToNow = () => {
    const targetY = getNowTargetY();
    if (targetY == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  const handleVerticalScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    const nowTargetY = getNowTargetY();
    setShowJumpToNow(nowTargetY != null && Math.abs(y - nowTargetY) > TIMELINE_METRICS.hourHeight * 1.5);

    const quarterHeight = timelineOffsetForMinutes(TIMELINE_METRICS.snapMinutes);

    // Fine quarter-hour ticks (light) plus a stronger thump every full hour
    // (4th tick) — a finer ratchet than a flat per-hour tick.
    const quarterTick = Math.round(y / quarterHeight);
    if (lastHourTickRef.current !== quarterTick) {
      lastHourTickRef.current = quarterTick;
      if (quarterTick % 4 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.selectionAsync();
      }
    }

  };

  const unscheduledEntries = useMemo(
    () => timelineEntries.filter((entry) => entry.minutes == null),
    [timelineEntries],
  );

  const [trayExpanded, setTrayExpanded] = useState(false);
  const [isDraggingFromTray, setIsDraggingFromTray] = useState(false);
  const trayOverlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(trayOverlayOpacity, {
      toValue: isDraggingFromTray ? 0 : 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [isDraggingFromTray, trayOverlayOpacity]);
  const { unscheduledItems, refresh: refreshUnscheduled } = useUnscheduledItems();

  const [addEventVisible, setAddEventVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Item | undefined>(undefined);

  const openAddEvent = () => {
    setEditingEvent(undefined);
    setAddEventVisible(true);
  };

  const openEditEvent = (item: Item) => {
    setEditingEvent(item);
    setAddEventVisible(true);
  };

  useRegisterFabHoldAction(useCallback(() => {
    setEditingEvent(undefined);
    setAddEventVisible(true);
  }, []));

  const openCreate = (targetDateStr: string, time?: string, durationMinutes?: number) => {
    openCapture({
      context: {
        status: 'active',
        scheduledDate: targetDateStr,
        scheduledTime: time ? normalizeTimeInput(time) ?? time : getDefaultTime(targetDateStr === todayStr),
        lockScheduleDate: true,
        minuteInterval: TIMELINE_METRICS.snapMinutes,
        durationMinutes,
      },
      onComplete: ({ action }) => {
        if (action === 'saved') refreshAll();
      },
    });
  };

  const openEdit = (entry: TimelineEntry, entryDateStr: string) => {
    if (entry.item.type === 'event') {
      openEditEvent(entry.item);
      return;
    }
    const launch = () => openItem({
      item: entry.item,
      context: {
        scheduledDate: entryDateStr,
        scheduledTime: normalizeTimeInput(entry.time) ?? '09:00',
        lockScheduleDate: false,
        minuteInterval: TIMELINE_METRICS.snapMinutes,
      },
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refreshAll();
      },
    });

    // The Preview is a native SwiftUI sheet and the editor is a formSheet
    // Modal — presenting one in the same tick the other dismisses wedges
    // iOS's presentation controller and freezes the app. When Edit comes from
    // the Preview, let the sheet finish dismissing before opening the editor;
    // the direct long-press path (no open sheet) still opens immediately.
    if (preview) {
      setPreview(null);
      setTimeout(launch, 350);
    } else {
      launch();
    }
  };

  const openPreview = (entry: TimelineEntry, entryDateStr: string) => {
    if (entry.item.type === 'event') {
      openEditEvent(entry.item);
      return;
    }
    setPreview({ entry, dateStr: entryDateStr });
  };

  const handleComplete = (entry: TimelineEntry) => {
    if (entry.instance?.status === 'completed' || entry.item.status === 'completed') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry.instance) {
      completeInstance(entry.instance.id);
    }
    updateItemStatus(entry.item.id, 'completed');
    refreshAll();
  };

  const handleMove = (entry: TimelineEntry, minutesDelta: number) => {
    if (entry.minutes == null) return;
    const next = Math.max(0, Math.min(23 * 60 + 59, entry.minutes + minutesDelta));
    const nextTime = formatTimeLabel(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTimelineItemTime(entry.item.id, nextTime, getTimeOfDayFromHour(Math.floor(next / 60)));
    refreshAll();
  };

  const handleReschedule = (entry: TimelineEntry, nextTime: string) => {
    const nextMinutes = snapMinutesToStep(Number(nextTime.split(':')[0]) * 60 + Number(nextTime.split(':')[1]), TIMELINE_METRICS.snapMinutes);
    const snapped = formatTimeLabel(nextMinutes);
    updateTimelineItemTime(entry.item.id, snapped, getTimeOfDayFromHour(Math.floor(nextMinutes / 60)));
    refreshAll();
  };

  const handleTrayDrop = (itemId: string, target: { dateStr: string; minutes: number | null }) => {
    updateTimelineItemSchedule(itemId, target.dateStr, target.minutes != null ? formatTimeLabel(target.minutes) : undefined);
    refreshAll();
    refreshUnscheduled();
  };

  const handleTrayDragUpdate = (absoluteY: number) => {
    setIsDraggingFromTray(true);
    const contentY = absoluteY - scrollViewAbsoluteYRef.current + scrollYRef.current;
    const target = computeDropTarget(daySectionLayouts, contentY, {
      hourHeight: TIMELINE_METRICS.hourHeight,
      dayTransitionHeight: TIMELINE_METRICS.dayTransitionHeight,
      laneHeaderHeight: TIMELINE_METRICS.laneHeaderHeight,
      snapMinutes: TIMELINE_METRICS.snapMinutes,
    });
    setDragTarget(target);
  };

  const handleTrayDragEnd = (itemId: string, absoluteY: number, committed: boolean) => {
    setIsDraggingFromTray(false);
    const contentY = absoluteY - scrollViewAbsoluteYRef.current + scrollYRef.current;
    const target = computeDropTarget(daySectionLayouts, contentY, {
      hourHeight: TIMELINE_METRICS.hourHeight,
      dayTransitionHeight: TIMELINE_METRICS.dayTransitionHeight,
      laneHeaderHeight: TIMELINE_METRICS.laneHeaderHeight,
      snapMinutes: TIMELINE_METRICS.snapMinutes,
    });
    setDragTarget(null);
    if (committed && target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleTrayDrop(itemId, target);
    }
  };

  const handleMoveToNow = (entry: TimelineEntry) => {
    if (!isToday) return;
    const next = snapMinutesToStep(liveNow.getHours() * 60 + liveNow.getMinutes(), TIMELINE_METRICS.snapMinutes);
    const nextTime = formatTimeLabel(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTimelineItemTime(entry.item.id, nextTime, getTimeOfDayFromHour(Math.floor(next / 60)));
    refreshAll();
  };

  const handleDelete = (entry: TimelineEntry, onDeleted?: () => void) => {
    Alert.alert(
      'Delete block',
      `Delete “${entry.item.title}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteItem(entry.item.id);
            refreshAll();
            onDeleted?.();
          },
        },
      ],
    );
  };

  const jumpToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(new Date());
  };

  const previewLane = preview ? TIMELINE_LANES.find((lane) => lane.id === getTimelineLane(preview.entry)) : undefined;
  const previewMinutes = preview ? getEntryMinutes(preview.entry) : null;
  const previewAccent = previewLane ? getAccentColor(palette, previewLane.accent) : palette.blue;
  const previewCompleted = preview
    ? preview.entry.instance?.status === 'completed' || preview.entry.item.status === 'completed'
    : false;
  const pendingToScheduleCount = unscheduledItems.length + unscheduledEntries.length;

  return (
    <RNView style={[s.container, { backgroundColor: palette.bg }]}>
      <RNView
        style={[s.topShell, activeView === 'calendar' && s.topShellFill]}
      >
        <RiverStoneSurface
          variant="header"
          mode={isDark ? 'dark' : 'light'}
          shape="flush"
          style={[
            s.headerStone,
            { minHeight: Math.max(insets.top - 14, 0) + 44 },
          ]}
          contentStyle={[
            s.headerStoneContent,
            { paddingTop: Math.max(insets.top - 14, 0) + 3 },
          ]}
          background={
            <RNView
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? '#2A2118' : '#D8C4A4', opacity: isDark ? 0.42 : 0.24 },
              ]}
            />
          }
        >
          <RNView style={s.headerRow}>
            <TouchableOpacity
              onPress={() => setSelected((prev) => activeView === 'calendar' ? addMonths(prev, -1) : addDays(prev, -1))}
              hitSlop={12}
              style={s.headerNavTouchable}
              activeOpacity={0.78}
            >
              <RiverStoneSurface variant="chip" mode="dark" shape="regular" style={s.navStone} contentStyle={s.navButton}>
                <ChevronLeft size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              </RiverStoneSurface>
            </TouchableOpacity>

            <RNView pointerEvents="none" style={s.headerTitleRow}>
              <RNText style={s.headerSelectedDate}>
                {selected.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </RNText>
            </RNView>

            <RNView style={s.headerActions}>
              <CalendarPill
                compact
                onPress={jumpToToday}
                style={s.headerTodayChip}
              />
              <TouchableOpacity
                onPress={() => setSelected((prev) => activeView === 'calendar' ? addMonths(prev, 1) : addDays(prev, 1))}
                hitSlop={12}
                style={s.headerNavTouchable}
                activeOpacity={0.78}
              >
                <RiverStoneSurface variant="chip" mode="dark" shape="regular" style={s.navStone} contentStyle={s.navButton}>
                  <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                </RiverStoneSurface>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </RiverStoneSurface>

        <RiverStoneSurface
          variant="card"
          mode={isDark ? 'dark' : 'light'}
          shape="flush"
          style={s.weekStone}
          contentStyle={s.weekStoneContent}
        >
          <RNView style={s.viewChipRow}>
            {(['calendar', 'timeline'] as const).map((view) => {
              const isActive = activeView === view;
              return (
                <TouchableOpacity
                  key={view}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveView(view);
                  }}
                  style={[
                    s.viewChip,
                    { borderColor: isActive ? CALENDAR_GOLD : 'transparent' },
                    isActive && { backgroundColor: isDark ? 'rgba(212,176,120,0.18)' : 'rgba(185,145,86,0.14)' },
                  ]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <RNText style={[s.viewChipLabel, { color: isActive ? CALENDAR_GOLD : palette.textSecondary }]}>
                    {view === 'calendar' ? 'Calendar' : 'Timeline'}
                  </RNText>
                </TouchableOpacity>
              );
            })}
            {([
              { route: 'Upcoming', label: 'Upcoming' },
              { route: 'PlanBackwards', label: 'Plan Backwards' },
            ] as const).map(({ route, label }) => (
              <TouchableOpacity
                key={route}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('Menu', { screen: route });
                }}
                style={[s.viewChip, { borderColor: 'transparent' }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <RNText style={[s.viewChipLabel, { color: palette.textSecondary }]}>{label}</RNText>
              </TouchableOpacity>
            ))}
          </RNView>
        </RiverStoneSurface>

        {activeView === 'calendar' ? (
          <RiverStoneSurface
            variant="card"
            mode={isDark ? 'dark' : 'light'}
            shape="flush"
            style={s.monthStone}
            contentStyle={s.monthStoneContent}
          >
            <MonthGrid
              monthDate={selected}
              selected={selected}
              isDark={isDark}
              onSelectDay={(day) => {
                setSelected(day);
              }}
            />
            <CalendarAgendaPreview
              date={selected}
              entries={timelineEntries}
              palette={palette}
              onOpenTimeline={() => setActiveView('timeline')}
            />
          </RiverStoneSurface>
        ) : null}
      </RNView>

      {activeView === 'timeline' && trayExpanded ? (
        <Animated.View
          pointerEvents={isDraggingFromTray ? 'none' : 'auto'}
          style={[s.trayOverlayLayer, { opacity: trayOverlayOpacity }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTrayExpanded(false);
            }}
          >
            <RNView style={[StyleSheet.absoluteFill, s.trayOverlayBackdrop]} />
          </TouchableOpacity>

          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            style={[s.trayOverlayPanelStone, { bottom: Math.max(insets.bottom, 12) + BOTTOM_TRAY_OVERLAY_HEIGHT }]}
            contentStyle={s.trayOverlayPanel}
          >
            <RNView style={[s.drawerHandle, { backgroundColor: palette.textTertiary }]} />
            <RNView style={s.drawerHeader}>
              <RNView style={s.drawerTitleRow}>
                <ProjectPortfolioIcon size={28} />
                <RNView>
                  <RNText style={[s.drawerTitle, { color: palette.text }]}>Plan your day</RNText>
                  <RNText style={[s.drawerHint, { color: palette.textTertiary }]}>{pendingToScheduleCount} to schedule · drag onto a time</RNText>
                </RNView>
              </RNView>
              <TouchableOpacity
                onPress={() => setTrayExpanded(false)}
                style={[s.drawerCollapseButton, { borderColor: CALENDAR_GOLD }]}
                accessibilityRole="button"
                accessibilityLabel="Collapse planning drawer"
              >
                <ChevronRight size={17} color={CALENDAR_GOLD} strokeWidth={2} style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </RNView>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <RNText style={[s.traySectionLabel, { color: palette.textTertiary }]}>UNSCHEDULED</RNText>
              {unscheduledItems.length === 0 ? (
                <RNText style={[s.trayEmptyText, { color: palette.textTertiary }]}>Nothing unscheduled.</RNText>
              ) : (
                unscheduledItems.map((item) => (
                  <TrayCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    type={item.type}
                    timeLabel="No date"
                    palette={palette}
                    onPress={() => openItem({ item })}
                    onDragUpdate={handleTrayDragUpdate}
                    onDragEnd={(absoluteY, committed) => handleTrayDragEnd(item.id, absoluteY, committed)}
                  />
                ))
              )}

              <RNText style={[s.traySectionLabel, { color: palette.textTertiary, marginTop: 12 }]}>TODAY</RNText>
              {unscheduledEntries.length === 0 ? (
                <RNText style={[s.trayEmptyText, { color: palette.textTertiary }]}>Nothing flexible today.</RNText>
              ) : (
                unscheduledEntries.map((entry) => (
                  <TrayCard
                    key={entry.instance?.id ?? entry.item.id}
                    id={entry.item.id}
                    title={entry.item.title}
                    type={entry.item.type}
                    timeLabel="Anytime today"
                    palette={palette}
                    onPress={() => openEdit(entry, dateStr)}
                    onDragUpdate={handleTrayDragUpdate}
                    onDragEnd={(absoluteY, committed) => handleTrayDragEnd(entry.item.id, absoluteY, committed)}
                  />
                ))
              )}
            </ScrollView>
          </RiverStoneSurface>
        </Animated.View>
      ) : null}

      {activeView === 'timeline' && !trayExpanded ? (
        <RiverStoneSurface
          variant="tray"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={[s.collapsedDrawerStone, { bottom: Math.max(insets.bottom, 12) + BOTTOM_TRAY_OVERLAY_HEIGHT }]}
          contentStyle={s.collapsedDrawer}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTrayExpanded(true);
            }}
            style={s.collapsedDrawerMain}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`Plan your day, ${pendingToScheduleCount} tasks to schedule`}
          >
            <ProjectPortfolioIcon size={30} />
            <RNView style={s.collapsedDrawerCopy}>
              <RNText style={[s.collapsedDrawerTitle, { color: palette.text }]}>Plan your day</RNText>
              <RNText style={[s.collapsedDrawerHint, { color: palette.textTertiary }]}>{pendingToScheduleCount} unscheduled</RNText>
            </RNView>
            <ChevronRight size={18} color={CALENDAR_GOLD} strokeWidth={2} style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openCreate(dateStr)}
            style={[s.drawerAddButton, { backgroundColor: palette.red }]}
            accessibilityRole="button"
            accessibilityLabel="Add time block"
          >
            <Plus size={18} color="#fff8ef" strokeWidth={2.4} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openAddEvent}
            style={[s.drawerAddButton, { backgroundColor: palette.blue }]}
            accessibilityRole="button"
            accessibilityLabel="Add event"
          >
            <CalendarIcon size={18} color="#fff8ef" strokeWidth={2.4} />
          </TouchableOpacity>
        </RiverStoneSurface>
      ) : null}

      {activeView === 'timeline' ? (
      <>
      <RNView
        pointerEvents="none"
        style={[s.timelineLeadIn, { backgroundColor: palette.bg }]}
      >
        <RNView
          style={[
            s.timelineLeadInLine,
            { backgroundColor: isDark ? CALENDAR_GOLD : CALENDAR_GOLD_EDGE },
          ]}
        />
      </RNView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => {
          setScrollViewportHeight(event.nativeEvent.layout.height);
          event.target.measureInWindow((_x, y) => {
            scrollViewAbsoluteYRef.current = y;
          });
        }}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
        decelerationRate={0.7}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 176 },
        ]}
      >
        <TimelinePaper
          variant={TIMELINE_PAPER_VARIANT}
          mode={isDark ? 'dark' : 'light'}
          seed={dateStr}
        />

        <DayTimeline
          dateStr={dateStr}
          entries={timelineEntries}
          palette={palette}
          isDark={isDark}
          isThisDayToday={isToday}
          liveNow={liveNow}
          currentHour={currentHour}
          currentMinute={currentMinute}
          onSectionLayout={(y) => setDaySectionLayouts((current) => ({ ...current, [dateStr]: { y } }))}
          onOpenCreate={(time, durationMinutes) => openCreate(dateStr, time, durationMinutes)}
          onOpenPreview={(entry) => openPreview(entry, dateStr)}
          onOpenEdit={(entry) => openEdit(entry, dateStr)}
          dragHighlightMinutes={dragTarget?.dateStr === dateStr ? dragTarget.minutes : undefined}
          showEmptyState={timelineEntries.every((entry) => getEntryMinutes(entry) == null)}
          busyEvents={busyEvents}
        />

      </ScrollView>

      {showJumpToNow ? (
        <StatusChip
          status="now"
          label="Now"
          onPress={jumpToNow}
          style={[s.jumpToNowChip, { bottom: Math.max(insets.bottom, 16) + 88 }]}
        />
      ) : null}
      </>
      ) : null}

      {preview && previewLane && previewMinutes != null ? (
        <TimelinePreviewSheet
          visible
          isDark={isDark}
          title={preview.entry.item.title}
          notes={preview.entry.item.notes}
          timeRange={formatTimelineTimeRange(previewMinutes, preview.entry.durationMinutes)}
          categoryLabel={previewLane.label}
          accentColor={previewAccent}
          icon={renderTypeIcon(preview.entry.item.type, previewAccent, 18)}
          completed={previewCompleted}
          onClose={() => setPreview(null)}
          onEdit={() => openEdit(preview.entry, preview.dateStr)}
          onComplete={() => {
            handleComplete(preview.entry);
            setPreview(null);
          }}
          onDelete={() => handleDelete(preview.entry, () => setPreview(null))}
        />
      ) : null}

      <AddEventSheet
        visible={addEventVisible}
        initialItem={editingEvent}
        initialDate={dateStr}
        onClose={() => setAddEventVisible(false)}
        onSaved={() => refreshAll()}
        onDeleted={() => refreshAll()}
      />

    </RNView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  trayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trayCardAccent: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  trayCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayCardCopy: {
    flex: 1,
    gap: 2,
    paddingVertical: 2,
  },
  trayCardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  trayCardDetail: {
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  trayCardGrip: {
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  trayCardGripRow: {
    flexDirection: 'row',
    gap: 3,
  },
  trayCardGripDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.55,
  },
  trayOverlayLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  trayOverlayBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  trayOverlayPanelStone: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: '48%',
  },
  trayOverlayPanel: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 12,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    opacity: 0.55,
    marginBottom: 8,
  },
  drawerHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    marginBottom: 8,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  drawerHint: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  drawerCollapseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traySectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  trayEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    marginBottom: 8,
  },
  dropHighlightRow: {
    position: 'absolute',
    left: TIMELINE_METRICS.gutterWidth,
    right: 0,
    height: TIMELINE_METRICS.hourHeight / 4,
    borderWidth: 2,
    borderRadius: 6,
  },
  topShell: {
    gap: spacing[1],
  },
  topShellFill: {
    flex: 1,
  },
  headerStone: {
    minHeight: 44,
  },
  headerStoneContent: {
    paddingBottom: 3,
  },
  weekStone: {
    minHeight: 62,
  },
  weekStoneContent: {
    paddingVertical: 2,
  },
  monthStone: {
    flex: 1,
  },
  monthStoneContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing[2],
  },
  viewChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing[2],
    paddingVertical: 8,
  },
  viewChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewChipLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  monthGrid: {
    height: 288,
    paddingHorizontal: 2,
  },
  monthGridWeekdayRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  monthGridWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  monthGridBody: {
    flexDirection: 'column',
  },
  monthGridWeekRow: {
    height: 40,
    flexDirection: 'row',
  },
  monthGridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthGridDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridDayNumber: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  monthGridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  calendarAgenda: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  calendarAgendaHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  calendarAgendaTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  calendarAgendaAction: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: CALENDAR_GOLD,
  },
  calendarAgendaEmpty: {
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[2],
  },
  calendarAgendaEmptyTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  calendarAgendaEmptyCopy: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  calendarAgendaRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing[1],
  },
  calendarAgendaAccent: {
    width: 3,
    height: 20,
    borderRadius: 999,
  },
  calendarAgendaTime: {
    width: 42,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  calendarAgendaRowTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
    minHeight: 38,
  },
  headerNavTouchable: {
    zIndex: 1,
  },
  navStone: {
    width: 32,
    height: 32,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
  },
  headerSelectedDate: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.15,
    color: CALENDAR_GOLD,
  },
  headerTodayChip: {
    width: 82,
  },
  statsRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  statValueRow: {
    minHeight: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    opacity: 0.5,
  },
  statsRowText: {
    fontSize: 8.5,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  statsRowValue: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  sectionBarStone: {
    height: 94,
    marginHorizontal: spacing[3],
  },
  sectionBar: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
  },
  sectionBarHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  sectionBarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionBarLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  sectionBarHint: {
    fontSize: 9.5,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  sectionBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  fabButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedDrawerStone: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    minHeight: 64,
    zIndex: 25,
  },
  collapsedDrawer: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing[3],
    paddingRight: 7,
    gap: 8,
  },
  collapsedDrawerMain: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  collapsedDrawerCopy: {
    flex: 1,
    gap: 1,
  },
  collapsedDrawerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  collapsedDrawerHint: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  drawerAddButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLeadIn: {
    height: 12,
    paddingHorizontal: spacing[3],
    justifyContent: 'center',
  },
  timelineLeadInLine: {
    height: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    opacity: 0.22,
  },
  scrollContent: {
    position: 'relative',
    paddingTop: spacing[1],
    gap: spacing[1],
  },
  jumpToNowChip: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 20,
  },
  section: {
    gap: spacing[1],
  },
  daySection: {
    gap: 0,
  },
  flexList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  timelineWrap: {
    width: '100%',
  },
  timelineContent: {
    position: 'relative',
    overflow: 'hidden',
  },
  markerLayer: {
    position: 'absolute',
    top: 0,
    right: TIMELINE_METRICS.rowHorizontalInset,
    bottom: 0,
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
  },
  busyBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  busyBlockText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
  },
  timelineEmptyState: {
    position: 'absolute',
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap + spacing[3],
    right: TIMELINE_METRICS.rowHorizontalInset + spacing[3],
    minHeight: 154,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  timelineEmptyTitle: {
    marginTop: 7,
    fontSize: 18,
    fontFamily: 'Georgia',
  },
  timelineEmptyCopy: {
    marginTop: 5,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  timelineEmptyAction: {
    marginTop: 13,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: CALENDAR_GOLD,
  },
  createRangeOverlay: {
    position: 'absolute',
    right: TIMELINE_METRICS.rowHorizontalInset,
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
    borderWidth: 1.5,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  createRangeLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  createRangeLabelText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#fff',
  },
  currentLine: {
    position: 'absolute',
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap - TIMELINE_METRICS.nowMarkerSize / 2,
    right: TIMELINE_METRICS.rowHorizontalInset,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    transform: [{ translateY: -TIMELINE_METRICS.nowMarkerSize / 2 }],
  },
  nowMarker: {
    width: TIMELINE_METRICS.nowMarkerSize,
    height: TIMELINE_METRICS.nowMarkerSize,
    borderRadius: TIMELINE_METRICS.nowMarkerSize / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStatusChip: {
    marginHorizontal: 4,
  },
  currentLineTrack: {
    flex: 1,
    height: TIMELINE_METRICS.nowLineThickness,
    borderRadius: 999,
    opacity: 0.8,
  },
  hourRow: {
    flexDirection: 'row',
    paddingHorizontal: TIMELINE_METRICS.rowHorizontalInset,
    paddingTop: TIMELINE_METRICS.eventGap,
    paddingBottom: TIMELINE_METRICS.baseUnit,
    gap: TIMELINE_METRICS.eventGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0)',
    position: 'relative',
  },
  hourRail: {
    width: TIMELINE_METRICS.gutterWidth,
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
    marginLeft: -TIMELINE_METRICS.rowHorizontalInset,
    marginTop: -TIMELINE_METRICS.eventGap,
    marginBottom: -TIMELINE_METRICS.baseUnit,
    paddingLeft: TIMELINE_METRICS.rowHorizontalInset,
    paddingTop: TIMELINE_METRICS.eventGap,
    paddingBottom: TIMELINE_METRICS.baseUnit,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  hourDivider: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TIMELINE_METRICS.gutterWidth,
    height: StyleSheet.hairlineWidth,
  },
  hourLabel: {
    position: 'absolute',
    top: -TIMELINE_METRICS.hourLabelLineHeight / 2,
    left: 0,
    width: TIMELINE_METRICS.hourLabelWidth,
    height: TIMELINE_METRICS.hourLabelLineHeight,
    fontSize: 12,
    lineHeight: TIMELINE_METRICS.hourLabelLineHeight,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    includeFontPadding: false,
  },
  firstHourLabel: {
    top: 1,
  },
  endOfDayLabel: {
    position: 'absolute',
    right: TIMELINE_METRICS.rowHorizontalInset + 4,
    bottom: 2,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    opacity: 0.7,
  },
  hourBody: {
    flex: 1,
    gap: TIMELINE_METRICS.baseUnit,
  },
  hourEntryList: {
    gap: TIMELINE_METRICS.eventGap,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
    marginVertical: spacing[2],
  },
  entryOuter: {
    marginVertical: 1,
  },
  entryCard: {
    height: '100%',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  entryCardDragging: {
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  entryAccent: {
    width: 4,
  },
  entryBody: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 4,
  },
  entryBodyShort: {
    paddingHorizontal: 10,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  entryBodyLong: {
    paddingVertical: 10,
    gap: 6,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  entryTimeRange: {
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.15,
  },
  statusLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  shortEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  shortTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortEntryTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  shortEntryTime: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
  },
  quarterMarks: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  quarterMark: {
    position: 'absolute',
    right: TIMELINE_METRICS.eventGap,
    width: TIMELINE_METRICS.quarterTickWidth,
    height: TIMELINE_METRICS.quarterTickHeight,
  },
  quarterTick: {
    width: TIMELINE_METRICS.quarterTickWidth,
    height: TIMELINE_METRICS.quarterTickHeight,
    borderRadius: 999,
    opacity: 0.5,
  },
  quarterGrid: {
    position: 'absolute',
    top: 0,
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
    right: TIMELINE_METRICS.rowHorizontalInset,
    height: TIMELINE_METRICS.hourHeight,
  },
  quarterGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  dragPreview: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dragPreviewTime: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  entryNotes: {
    fontSize: 12,
    lineHeight: 16,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  entryMetaText: {
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
});
