import { useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar } from '../hooks/useDb';
import {
  CalendarDayBadge,
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
} from '../db/database';
import type { ItemType } from '../db/types';
import type { TimelineEntry } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, radius, spacing } from '../theme';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  Plus,
  Sparkles,
} from '../icons';
import { MedicationBottleIcon } from '../components/icons/MedicationBottleIcon';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
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
import { useOpenItem } from '../hooks/useOpenItem';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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
  dayTransitionHeight: 56,
  laneHeaderHeight: 34,
  periodDividerHeight: 34,
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

const LANE_WIDTH_PERCENT = 100 / TIMELINE_LANES.length;

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
  laneIndex: number;
  collisionSlot: number;
}

function positionTimelineEntries(entries: TimelineEntry[]): PositionedTimelineEntry[] {
  const laneEnds = TIMELINE_LANES.map(() => [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]);
  return [...entries]
    .filter((entry) => getEntryMinutes(entry) != null)
    .sort((left, right) => (getEntryMinutes(left) ?? 0) - (getEntryMinutes(right) ?? 0))
    .map((entry) => {
      const laneId = getTimelineLane(entry);
      const laneIndex = Math.max(0, TIMELINE_LANES.findIndex((lane) => lane.id === laneId));
      const start = getEntryMinutes(entry) ?? 0;
      const end = start + Math.max(15, entry.durationMinutes);
      const freeSlot = laneEnds[laneIndex].findIndex((slotEnd) => slotEnd <= start);
      const collisionSlot = freeSlot >= 0 ? freeSlot : 0;
      laneEnds[laneIndex][collisionSlot] = end;
      return { entry, laneIndex, collisionSlot };
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
      return <Sparkles size={size} color={color} strokeWidth={1.8} />;
    case 'medication':
      return <MedicationBottleIcon size={size} color={color} />;
    case 'workout-template':
      return <Dumbbell size={size} color={color} strokeWidth={1.8} />;
    case 'meal':
      return <Clock size={size} color={color} strokeWidth={1.8} />;
    case 'task':
    default:
      return <ClipboardList size={size} color={color} strokeWidth={1.7} />;
  }
}

function renderLaneIcon(lane: TimelineLaneId, color: string, size = 13) {
  switch (lane) {
    case 'health':
      return <MedicationBottleIcon size={size + 2} color={color} />;
    case 'focus':
      return <ProjectPortfolioIcon size={size + 7} />;
    case 'study':
      return <AreaBonsaiIcon size={size + 7} />;
    case 'habits':
      return <Sparkles size={size} color={color} strokeWidth={1.8} />;
    case 'other':
      return <Clock size={size} color={color} strokeWidth={1.8} />;
    case 'personal':
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

interface WeekStripProps {
  selected: Date;
  onSelect: (d: Date) => void;
  isDark: boolean;
}

const WEEK_STRIP_DAY_COUNT = 29;
const WEEK_STRIP_CENTER_INDEX = Math.floor(WEEK_STRIP_DAY_COUNT / 2);

function WeekStrip({ selected, onSelect, isDark }: WeekStripProps) {
  const palette = getThemeColors(isDark);
  const scrollRef = useRef<ScrollView>(null);
  const lastDayTickRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const itemWidth = viewportWidth ? viewportWidth / 7 : 48;
  const windowStart = addDays(selected, -WEEK_STRIP_CENTER_INDEX);
  const today = formatDate(new Date());
  const selectedStr = formatDate(selected);

  useEffect(() => {
    if (!viewportWidth) return;
    const targetX = WEEK_STRIP_CENTER_INDEX * itemWidth - viewportWidth / 2 + itemWidth / 2;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: targetX, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [itemWidth, selectedStr, viewportWidth]);

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const tick = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
    if (lastDayTickRef.current === tick) return;
    lastDayTickRef.current = tick;
    Haptics.impactAsync(tick % 7 === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      decelerationRate={0.4}
      snapToInterval={itemWidth}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={s.weekStrip}
    >
      {Array.from({ length: WEEK_STRIP_DAY_COUNT }, (_, index) => {
        const day = addDays(windowStart, index);
        const isSelected = formatDate(day) === formatDate(selected);
        const isToday = formatDate(day) === today;
        const isSunday = day.getDay() === 0;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(day);
            }}
            style={[s.weekDay, { width: itemWidth }]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            accessibilityState={{ selected: isSelected }}
          >
            <CalendarDayBadge
              day={day.getDate()}
              weekday={DAYS[day.getDay()]}
              state={isSelected ? 'selected' : isToday ? 'today' : 'default'}
              isSunday={isSunday}
            />
            <RNView
              style={[
                s.todayDot,
                { backgroundColor: isSelected ? CALENDAR_GOLD : isToday ? palette.blue : 'transparent' },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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

interface DayTimelineProps {
  dayDate: Date;
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
}

function DayTimeline({
  dayDate,
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
  const dividerLabel = dayDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const dayAccentIndex = Math.abs(Math.floor(dayDate.getTime() / 86_400_000)) % 3;
  const dayAccents = isDark
    ? [palette.purple, CALENDAR_GOLD, '#D98268']
    : [CALENDAR_GOLD_EDGE, '#9B79B8', '#B96854'];
  const transitionAccent = dayAccents[dayAccentIndex];
  const transitionInk = `${transitionAccent}${isDark ? 'B8' : 'C7'}`;
  const waveGradientId = `day-wave-${dateStr}`;
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
      <RNView style={s.dayTransition}>
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox={`0 0 390 ${TIMELINE_METRICS.dayTransitionHeight}`}
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLinearGradient id={waveGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor={transitionAccent} stopOpacity={isDark ? 0.1 : 0.07} />
              <Stop offset="0.42" stopColor={transitionAccent} stopOpacity={isDark ? 0.032 : 0.024} />
              <Stop offset="1" stopColor={transitionAccent} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Path
            d={`M0 10 C68 1 126 3 194 11 C263 19 322 3 390 10 L390 ${TIMELINE_METRICS.dayTransitionHeight} L0 ${TIMELINE_METRICS.dayTransitionHeight} Z`}
            fill={`url(#${waveGradientId})`}
          />
          <Path
            d="M0 10 C68 1 126 3 194 11 C263 19 322 3 390 10"
            fill="none"
            stroke={transitionAccent}
            strokeOpacity={isDark ? 0.1 : 0.08}
            strokeWidth="0.45"
          />
        </Svg>
        <RNView style={s.dayTransitionContent}>
          <RNView style={s.sectionHeaderLeft}>
            <Clock size={14} color={transitionInk} strokeWidth={1.8} />
            <RNText style={[s.sectionTitle, { color: transitionInk }]}>
              {isThisDayToday ? 'TODAY' : dividerLabel.toUpperCase()}
            </RNText>
          </RNView>
          <TouchableOpacity onPress={() => onOpenCreate()} hitSlop={8}>
            <RNText style={[s.sectionAction, { color: transitionInk }]}>Block now</RNText>
          </TouchableOpacity>
        </RNView>
      </RNView>

      <RNView style={[s.laneHeader, { borderBottomColor: paper.ruleStrong, backgroundColor: paper.base }]}>
        <RNView style={s.laneHeaderGutter} />
        <RNView style={s.laneHeaderTrack}>
          {TIMELINE_LANES.map((lane) => {
            const laneColor = getAccentColor(palette, lane.accent);
            return (
              <RNView
                key={lane.id}
                accessible
                accessibilityLabel={`${lane.label} timeline lane`}
                style={[s.laneHeaderCell, { borderLeftColor: paper.rule }]}
              >
                {renderLaneIcon(lane.id, laneColor, 12)}
                <RNView style={[s.laneHeaderMark, { backgroundColor: laneColor }]} />
              </RNView>
            );
          })}
        </RNView>
      </RNView>

      <RNView style={s.timelineWrap}>
        <GestureDetector gesture={createGesture}>
        <RNView style={[s.timelineContent, { height: TIMELINE_METRICS.hourHeight * 24 }]}>
          <ExpoLinearGradient
            pointerEvents="none"
            colors={atmosphereColors}
            locations={[0, 0.18, 0.31, 0.48, 0.63, 0.74, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
          <RNView pointerEvents="none" style={s.laneGrid}>
            {TIMELINE_LANES.map((lane) => (
              <RNView key={lane.id} style={[s.laneGridColumn, { borderLeftColor: paper.rule }]} />
            ))}
          </RNView>
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

          <RNView pointerEvents="box-none" style={s.markerLayer}>
            {positionedEntries.map(({ entry, laneIndex, collisionSlot }) => {
              const lane = TIMELINE_LANES[laneIndex];
              const accentColor = getAccentColor(palette, lane.accent);
              const accentSoftColor = getAccentSoftColor(palette, lane.accent);
              const entryMinutes = getEntryMinutes(entry) ?? 0;
              const completed = entry.instance?.status === 'completed' || entry.item.status === 'completed';
              return (
                <TimelineMarker
                  key={entry.instance?.id ?? entry.item.id}
                  top={timelineOffsetForMinutes(entryMinutes)}
                  left={`${laneIndex * LANE_WIDTH_PERCENT}%`}
                  width={`${LANE_WIDTH_PERCENT}%`}
                  durationHeight={timelineOffsetForMinutes(entry.durationMinutes)}
                  accentColor={accentColor}
                  accentSoftColor={accentSoftColor}
                  completed={completed}
                  collisionSlot={collisionSlot}
                  icon={renderTypeIcon(entry.item.type, accentColor, 12)}
                  accessibilityLabel={`${entry.item.title}, ${formatTimelineTimeRange(entryMinutes, entry.durationMinutes)}, ${lane.label}`}
                  onPreview={() => onOpenPreview(entry)}
                  onEdit={() => onOpenEdit(entry)}
                />
              );
            })}
          </RNView>
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
  const [selected, setSelected] = useState(new Date());
  const [nowTick, setNowTick] = useState(Date.now());
  const [daySectionLayouts, setDaySectionLayouts] = useState<Record<string, { y: number }>>({});
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [showJumpToNow, setShowJumpToNow] = useState(false);
  const [preview, setPreview] = useState<{ entry: TimelineEntry; dateStr: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef<string | null>(null);
  const lastHourTickRef = useRef<number | null>(null);
  const lastDaySectionRef = useRef<string | null>(null);

  const dateStr = formatDate(selected);
  const todayStr = formatDate(new Date());
  const isToday = dateStr === todayStr;
  const liveNow = new Date(nowTick);
  const currentHour = liveNow.getHours();
  const currentMinute = liveNow.getMinutes();

  // Continuous 3-day window (yesterday/selected/tomorrow) so the timeline can
  // be scrolled past midnight instead of hard-stopping at 00:00/23:59 — each
  // day keeps its own useCalendar call (stable hook count, only the date arg
  // changes), independent entries, independent refresh.
  const prevDate = addDays(selected, -1);
  const nextDate = addDays(selected, 1);
  const prevDateStr = formatDate(prevDate);
  const nextDateStr = formatDate(nextDate);

  const { timelineEntries: prevEntries, refresh: refreshPrev } = useCalendar(prevDateStr);
  const { timelineEntries, refresh } = useCalendar(dateStr);
  const { timelineEntries: nextEntries, refresh: refreshNext } = useCalendar(nextDateStr);

  const refreshAll = () => {
    refreshPrev();
    refresh();
    refreshNext();
  };

  useEffect(() => {
    refreshPrev();
    refresh();
    refreshNext();
  }, [composerRevision, refresh, refreshNext, refreshPrev]);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // "Now" target within whichever of the 3 loaded days is actually today —
  // shared by the selection-driven auto-scroll effect and the Jump to now
  // button, so both land in exactly the same place.
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

    // Heavier thump when the scroll position crosses from one loaded day's
    // section into another (yesterday -> today -> tomorrow).
    const boundaries = Object.entries(daySectionLayouts).sort((a, b) => a[1].y - b[1].y);
    let activeDay: string | null = null;
    for (const [day, layout] of boundaries) {
      if (y >= layout.y - TIMELINE_METRICS.hourHeight / 2) activeDay = day;
    }
    if (activeDay && lastDaySectionRef.current !== activeDay) {
      if (lastDaySectionRef.current !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      lastDaySectionRef.current = activeDay;
    }
  };

  const unscheduledEntries = useMemo(
    () => timelineEntries.filter((entry) => entry.minutes == null),
    [timelineEntries],
  );

  const doneCount = useMemo(
    () => timelineEntries.filter((entry) => entry.instance?.status === 'completed' || entry.item.status === 'completed').length,
    [timelineEntries],
  );

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
    setPreview(null);
    openItem({
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
  };

  const openPreview = (entry: TimelineEntry, entryDateStr: string) => {
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

  const blocksCount = timelineEntries.length;

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

  return (
    <RNView style={[s.container, { backgroundColor: palette.bg }]}>
      <RNView style={s.topShell}>
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
              onPress={() => setSelected((prev) => addDays(prev, -7))}
              hitSlop={12}
              style={s.headerNavTouchable}
              activeOpacity={0.78}
            >
              <RiverStoneSurface variant="chip" mode="dark" shape="regular" style={s.navStone} contentStyle={s.navButton}>
                <ChevronLeft size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              </RiverStoneSurface>
            </TouchableOpacity>

            <RNView pointerEvents="none" style={s.headerTitleRow}>
              <RNText style={s.headerMonth}>{MONTHS[selected.getMonth()]}</RNText>
              <RNText style={s.headerTitleSeparator}>·</RNText>
              <RNText style={s.headerSelectedDate}>
                {selected.toLocaleDateString([], { weekday: 'long', day: 'numeric' })}
              </RNText>
            </RNView>

            <RNView style={s.headerActions}>
              <CalendarPill
                compact
                onPress={jumpToToday}
                style={s.headerTodayChip}
              />
              <TouchableOpacity
                onPress={() => setSelected((prev) => addDays(prev, 7))}
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
          <WeekStrip selected={selected} onSelect={setSelected} isDark={isDark} />
        </RiverStoneSurface>

        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={s.sectionBarStone}
          contentStyle={s.sectionBar}
        >
          <RNView style={s.sectionBarHeader}>
            <RNView style={s.sectionBarCopy}>
              <RNText style={[s.sectionBarLabel, { color: palette.text }]}>Timeblocking</RNText>
              <RNText style={[s.sectionBarHint, { color: palette.textTertiary }]} numberOfLines={1}>
                Tap to preview · hold to edit
              </RNText>
            </RNView>
            <RNView style={s.sectionBarActions}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openCreate(dateStr);
                }}
                style={[s.fabButton, { borderColor: CALENDAR_GOLD }]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add time block"
              >
                <Plus size={16} color={CALENDAR_GOLD} strokeWidth={2.4} />
              </TouchableOpacity>
            </RNView>
          </RNView>
          <RNView style={[s.sectionCardDivider, { backgroundColor: palette.separatorStrong }]} />
          <RNView style={s.statsRow}>
            <RNView style={s.statItem}>
              <RNView style={s.statValueRow}>
                <Calendar size={13} color={palette.blue} strokeWidth={1.8} />
                <RNText style={[s.statsRowValue, { color: palette.blue }]}>{blocksCount}</RNText>
              </RNView>
              <RNText style={[s.statsRowText, { color: palette.blue }]}>Blocks</RNText>
            </RNView>
            <RNView style={[s.statDivider, { backgroundColor: palette.separatorStrong }]} />
            <RNView style={s.statItem}>
              <RNView style={s.statValueRow}>
                <Check size={13} color={palette.green} strokeWidth={2} />
                <RNText style={[s.statsRowValue, { color: palette.green }]}>{doneCount}</RNText>
              </RNView>
              <RNText style={[s.statsRowText, { color: palette.green }]}>Done</RNText>
            </RNView>
            <RNView style={[s.statDivider, { backgroundColor: palette.separatorStrong }]} />
            <RNView style={s.statItem}>
              <RNView style={s.statValueRow}>
                <Clock size={13} color={CALENDAR_GOLD} strokeWidth={1.8} />
                <RNText style={[s.statsRowValue, { color: CALENDAR_GOLD }]}>{unscheduledEntries.length}</RNText>
              </RNView>
              <RNText style={[s.statsRowText, { color: CALENDAR_GOLD }]}>Flexible</RNText>
            </RNView>
          </RNView>
        </RiverStoneSurface>
      </RNView>

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
        onLayout={(event) => setScrollViewportHeight(event.nativeEvent.layout.height)}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
        decelerationRate={0.7}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 96 },
        ]}
      >
        <TimelinePaper
          variant={TIMELINE_PAPER_VARIANT}
          mode={isDark ? 'dark' : 'light'}
          seed={`${prevDateStr}-${nextDateStr}`}
        />

        {unscheduledEntries.length > 0 ? (
          <RNView style={s.section}>
            <RNView style={s.sectionHeader}>
              <RNView style={s.sectionHeaderLeft}>
                <Calendar size={14} color={palette.textMuted} strokeWidth={1.8} />
                <RNText style={[s.sectionTitle, { color: palette.textSecondary }]}>
                  FLEXIBLE ({unscheduledEntries.length})
                </RNText>
              </RNView>
              <TouchableOpacity onPress={() => openCreate(dateStr)} hitSlop={8}>
                <RNText style={[s.sectionAction, { color: palette.blue }]}>Add</RNText>
              </TouchableOpacity>
            </RNView>

            <RNView style={[s.flexList, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
              {unscheduledEntries.map((entry, index) => (
                <RNView key={entry.instance?.id ?? entry.item.id}>
                  <TimelineEntryCard
                    entry={entry}
                    palette={palette}
                    isDark={isDark}
                    isToday={isToday}
                    onOpen={(e) => openEdit(e, dateStr)}
                    onComplete={handleComplete}
                    onMove={handleMove}
                    onMoveToNow={handleMoveToNow}
                    onDelete={handleDelete}
                    onReschedule={handleReschedule}
                  />
                  {index < unscheduledEntries.length - 1 ? <RNView style={[s.itemDivider, { backgroundColor: palette.separator }]} /> : null}
                </RNView>
              ))}
            </RNView>
          </RNView>
        ) : null}

        <DayTimeline
          dayDate={prevDate}
          dateStr={prevDateStr}
          entries={prevEntries}
          palette={palette}
          isDark={isDark}
          isThisDayToday={prevDateStr === todayStr}
          liveNow={liveNow}
          currentHour={currentHour}
          currentMinute={currentMinute}
          onSectionLayout={(y) => setDaySectionLayouts((current) => ({ ...current, [prevDateStr]: { y } }))}
          onOpenCreate={(time, durationMinutes) => openCreate(prevDateStr, time, durationMinutes)}
          onOpenPreview={(entry) => openPreview(entry, prevDateStr)}
          onOpenEdit={(entry) => openEdit(entry, prevDateStr)}
        />

        <DayTimeline
          dayDate={selected}
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
        />

        <DayTimeline
          dayDate={nextDate}
          dateStr={nextDateStr}
          entries={nextEntries}
          palette={palette}
          isDark={isDark}
          isThisDayToday={nextDateStr === todayStr}
          liveNow={liveNow}
          currentHour={currentHour}
          currentMinute={currentMinute}
          onSectionLayout={(y) => setDaySectionLayouts((current) => ({ ...current, [nextDateStr]: { y } }))}
          onOpenCreate={(time, durationMinutes) => openCreate(nextDateStr, time, durationMinutes)}
          onOpenPreview={(entry) => openPreview(entry, nextDateStr)}
          onOpenEdit={(entry) => openEdit(entry, nextDateStr)}
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

    </RNView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topShell: {
    gap: spacing[1],
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
  headerMonth: {
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: 'Georgia',
    color: 'rgba(255,255,255,0.95)',
  },
  headerTitleSeparator: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
  headerSelectedDate: {
    fontSize: 14,
    fontFamily: 'Georgia',
    color: CALENDAR_GOLD,
  },
  headerTodayChip: {
    width: 82,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingTop: 2,
  },
  weekDay: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
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
  sectionCardDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
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
  dayTransition: {
    height: TIMELINE_METRICS.dayTransitionHeight,
    marginTop: -7,
    position: 'relative',
    justifyContent: 'center',
    zIndex: 2,
  },
  dayTransitionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingTop: 12,
    paddingHorizontal: spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  flexList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  timelineWrap: {
    width: '100%',
  },
  laneHeader: {
    height: TIMELINE_METRICS.laneHeaderHeight,
    flexDirection: 'row',
    paddingRight: TIMELINE_METRICS.rowHorizontalInset,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  laneHeaderGutter: {
    width: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
  },
  laneHeaderTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  laneHeaderCell: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  laneHeaderMark: {
    width: 10,
    height: 1,
    borderRadius: 999,
    opacity: 0.56,
  },
  timelineContent: {
    position: 'relative',
    overflow: 'hidden',
  },
  laneGrid: {
    position: 'absolute',
    top: 0,
    right: TIMELINE_METRICS.rowHorizontalInset,
    bottom: 0,
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
    flexDirection: 'row',
  },
  laneGridColumn: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  markerLayer: {
    position: 'absolute',
    top: 0,
    right: TIMELINE_METRICS.rowHorizontalInset,
    bottom: 0,
    left: TIMELINE_METRICS.gutterWidth + TIMELINE_METRICS.eventGap,
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
  periodDivider: {
    minHeight: TIMELINE_METRICS.periodDividerHeight,
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  periodDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.52,
  },
  periodDividerBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing[2],
  },
  periodDividerBadgeWrap: {
    width: 138,
    height: TIMELINE_METRICS.periodDividerHeight,
  },
  periodDividerLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'Georgia',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
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
