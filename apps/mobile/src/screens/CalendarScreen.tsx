import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Keyboard,
  PanResponder,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
  Text as RNText,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCalendar } from '../hooks/useDb';
import {
  completeInstance,
  createTimedItem,
  deleteItem,
  formatDate,
  updateItem,
  updateItemStatus,
  updateTimelineItemTime,
} from '../db/database';
import type { ItemType } from '../db/types';
import type { TimelineEntry } from '../db/database';
import { BottomSheet } from '../components/ui/BottomSheet';
import { DragHandle } from '../components/ui/DragHandle';
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, radius, spacing, fontSize, shadows } from '../theme';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  FolderKanban,
  Pencil,
  Pill,
  Plus,
  Sparkles,
  Trash2,
} from '../icons';
import {
  formatHourLabel,
  formatTimeLabel,
  getTimeOfDayFromHour,
  normalizeTimeInput,
  snapMinutesToStep,
  timeOfDayLabel,
} from '../utils/time';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_SLOT_HEIGHT = 72;
const DRAG_MINUTES_PER_PIXEL = 60 / HOUR_SLOT_HEIGHT;
const TIMELINE_SNAP_STEP = 15;

type AccentKey = 'blue' | 'green' | 'orange' | 'maroon' | 'red';
type DraftMode = 'create' | 'edit';

interface DraftState {
  mode: DraftMode;
  entry?: TimelineEntry;
  title: string;
  notes: string;
  type: ItemType;
  time: string;
}

const TYPE_OPTIONS: Array<{
  value: ItemType;
  label: string;
  accent: AccentKey;
  icon: 'task' | 'project' | 'habit' | 'medication' | 'workout' | 'meal' | 'area';
}> = [
  { value: 'task', label: 'Task', accent: 'blue', icon: 'task' },
  { value: 'project', label: 'Project', accent: 'maroon', icon: 'project' },
  { value: 'area', label: 'Area', accent: 'blue', icon: 'area' },
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
    case 'maroon':
      return palette.maroon;
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
    case 'maroon':
      return palette.maroonSoft;
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
      return <FolderKanban size={size} color={color} strokeWidth={1.8} />;
    case 'area':
      return <Calendar size={size} color={color} strokeWidth={1.8} />;
    case 'habit':
      return <Sparkles size={size} color={color} strokeWidth={1.8} />;
    case 'medication':
      return <Pill size={size} color={color} strokeWidth={1.8} />;
    case 'workout-template':
      return <Dumbbell size={size} color={color} strokeWidth={1.8} />;
    case 'meal':
      return <Clock size={size} color={color} strokeWidth={1.8} />;
    case 'task':
    default:
      return <Check size={size} color={color} strokeWidth={1.8} />;
  }
}

function parseHourMinuteTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getDefaultTime(isToday: boolean): string {
  const now = new Date();
  if (!isToday) return '09:00';
  const roundedMinutes = Math.round(now.getMinutes() / 15) * 15;
  const nextHour = roundedMinutes >= 60 ? (now.getHours() + 1) % 24 : now.getHours();
  const nextMinute = roundedMinutes >= 60 ? 0 : roundedMinutes;
  return formatTimeLabel(snapMinutesToStep(nextHour * 60 + nextMinute, TIMELINE_SNAP_STEP));
}

function getEntryMinutes(entry: TimelineEntry): number | null {
  if (entry.minutes != null) return entry.minutes;
  const parsed = normalizeTimeInput(entry.time);
  return parsed ? Number(parsed.split(':')[0]) * 60 + Number(parsed.split(':')[1]) : null;
}

function getDraggedMinutes(baseMinutes: number, deltaY: number): number {
  return snapMinutesToStep(baseMinutes + deltaY * DRAG_MINUTES_PER_PIXEL, TIMELINE_SNAP_STEP);
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
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(startOfWeek, index);
        const isSelected = formatDate(day) === formatDate(selected);
        const isToday = formatDate(day) === today;

        return (
          <TouchableOpacity
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(day);
            }}
            style={s.weekDay}
            activeOpacity={0.72}
          >
            <RNText style={[s.dayLabel, { color: palette.textTertiary }]}>
              {DAYS[day.getDay()]}
            </RNText>
            <RNView
              style={[
                s.dayCircle,
                {
                  backgroundColor: isSelected ? palette.text : 'transparent',
                  borderColor: isToday && !isSelected ? palette.blue : 'transparent',
                },
              ]}
            >
              <RNText
                style={[
                  s.dayNumber,
                  {
                    color: isSelected ? palette.bg : isToday ? palette.blue : palette.text,
                    fontWeight: isToday ? '800' : '500',
                  },
                ]}
              >
                {day.getDate()}
              </RNText>
            </RNView>
            {isToday && !isSelected ? <RNView style={s.todayDot} /> : <RNView style={s.todayDotSpacer} />}
          </TouchableOpacity>
        );
      })}
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
  isToday,
  onOpen,
  onComplete,
  onMove,
  onMoveToNow,
  onDelete,
  onReschedule,
}: TimelineEntryCardProps) {
  const typeMeta = getTypeMeta(entry.item.type);
  const accentColor = getAccentColor(palette, typeMeta.accent);
  const accentSoft = getAccentSoftColor(palette, typeMeta.accent);
  const completed = entry.instance?.status === 'completed' || entry.item.status === 'completed';
  const baseMinutes = getEntryMinutes(entry);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const timeLabel = previewMinutes != null
    ? formatTimeLabel(previewMinutes)
    : entry.time ? entry.time : 'Anytime';
  const statusLabel = completed
    ? 'Done'
    : entry.minutes == null
      ? 'Flexible'
      : entry.instance?.status === 'pending'
        ? 'Planned'
        : 'Scheduled';

  const menuItems: ContextMenuItem[] = [
    { label: 'Edit block', icon: <Pencil size={14} color={palette.textSecondary} strokeWidth={1.8} />, onPress: () => onOpen(entry) },
    ...(!completed
      ? [{ label: 'Mark complete', icon: <Check size={14} color={palette.green} strokeWidth={2} />, onPress: () => onComplete(entry) }]
      : []),
    ...(entry.minutes != null
      ? [
        { label: 'Move 30 min earlier', icon: <Clock size={14} color={palette.textSecondary} strokeWidth={1.8} />, onPress: () => onMove(entry, -30) },
        { label: 'Move 30 min later', icon: <Clock size={14} color={palette.textSecondary} strokeWidth={1.8} />, onPress: () => onMove(entry, 30) },
      ]
      : []),
    ...(isToday && entry.minutes != null
      ? [{ label: 'Move to now', icon: <Clock size={14} color={palette.blue} strokeWidth={1.8} />, onPress: () => onMoveToNow(entry) }]
      : []),
    { label: 'Delete block', icon: <Trash2 size={14} color={palette.red} strokeWidth={1.8} />, destructive: true, onPress: () => onDelete(entry) },
  ];

  const dragResponder = useMemo(() => {
    if (baseMinutes == null) return null;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.7,
      onPanResponderGrant: () => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(gesture.dy);
        setPreviewMinutes(getDraggedMinutes(baseMinutes, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const nextMinutes = getDraggedMinutes(baseMinutes, gesture.dy);
        setIsDragging(false);
        setPreviewMinutes(null);
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();

        if (nextMinutes !== baseMinutes) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onReschedule(entry, formatTimeLabel(nextMinutes));
        }
      },
      onPanResponderTerminate: (_, gesture) => {
        const nextMinutes = getDraggedMinutes(baseMinutes, gesture.dy);
        setIsDragging(false);
        setPreviewMinutes(null);
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();

        if (nextMinutes !== baseMinutes) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onReschedule(entry, formatTimeLabel(nextMinutes));
        }
      },
    });
  }, [baseMinutes, entry, onReschedule, translateY]);

  return (
    <ContextMenu items={menuItems} onPress={() => onOpen(entry)}>
      <Animated.View
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
          <RNView style={s.entryBody}>
            <RNView style={s.entryTopRow}>
              <RNView style={s.entryTopLeft}>
                {baseMinutes != null ? (
                  <RNView
                    {...(dragResponder?.panHandlers ?? {})}
                    style={[s.dragGripWrap, { backgroundColor: accentSoft }]}
                  >
                    <DragHandle isDark={isDark} width={24} />
                    <RNText style={[s.dragHint, { color: accentColor }]}>Drag</RNText>
                  </RNView>
                ) : null}
                <RNView style={[s.timePill, { backgroundColor: accentSoft }]}>
                  <Clock size={11} color={accentColor} strokeWidth={1.8} />
                  <RNText style={[s.timePillText, { color: accentColor }]}>{timeLabel}</RNText>
                </RNView>
              </RNView>
              <RNView style={[s.statusPill, { backgroundColor: completed ? palette.greenSoft : palette.fill }]}>
                <RNText style={[s.statusPillText, { color: completed ? palette.green : palette.textSecondary }]}>
                  {statusLabel}
                </RNText>
              </RNView>
            </RNView>

            {isDragging && previewMinutes != null && baseMinutes != null ? (
              <RNView style={[s.dragPreview, { backgroundColor: accentSoft, borderColor: accentColor }]}>
                <RNView style={s.dragPreviewTop}>
                  <Clock size={12} color={accentColor} strokeWidth={1.8} />
                  <RNText style={[s.dragPreviewTime, { color: accentColor }]}>
                    Drop at {formatTimeLabel(previewMinutes)}
                  </RNText>
                </RNView>
                <RNText style={[s.dragPreviewSub, { color: palette.textSecondary }]}>
                  {previewMinutes > baseMinutes ? `+${previewMinutes - baseMinutes}m later` : `${baseMinutes - previewMinutes}m earlier`}
                </RNText>
              </RNView>
            ) : null}

            <RNText
              style={[
                s.entryTitle,
                { color: palette.text, textDecorationLine: completed ? 'line-through' : 'none' },
              ]}
              numberOfLines={2}
            >
              {entry.item.title}
            </RNText>

            {entry.item.notes ? (
              <RNText style={[s.entryNotes, { color: palette.textSecondary }]} numberOfLines={1}>
                {entry.item.notes}
              </RNText>
            ) : null}

            <RNView style={s.entryMetaRow}>
              <RNView style={[s.typePill, { backgroundColor: accentSoft }]}>
                {renderTypeIcon(entry.item.type, accentColor, 12)}
                <RNText style={[s.typePillText, { color: accentColor }]}>
                  {typeMeta.label}
                </RNText>
              </RNView>
              <RNView style={[s.typePill, { backgroundColor: palette.fill }]}>
                <RNText style={[s.typePillText, { color: palette.textSecondary }]}>
                  {timeOfDayLabel(entry.timeOfDay)}
                </RNText>
              </RNView>
            </RNView>
          </RNView>
        </RNView>
      </Animated.View>
    </ContextMenu>
  );
}

function createDraftFromEntry(entry: TimelineEntry): DraftState {
  return {
    mode: 'edit',
    entry,
    title: entry.item.title,
    notes: entry.item.notes ?? '',
    type: entry.item.type,
    time: normalizeTimeInput(entry.time) ?? '09:00',
  };
}

export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [selected, setSelected] = useState(new Date());
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [hourLayouts, setHourLayouts] = useState<Record<number, { y: number; height: number }>>({});
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef<string | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const hourInputRef = useRef<TextInput>(null);
  const minuteInputRef = useRef<TextInput>(null);

  const dateStr = formatDate(selected);
  const todayStr = formatDate(new Date());
  const isToday = dateStr === todayStr;
  const liveNow = new Date(nowTick);
  const currentHour = liveNow.getHours();
  const currentMinute = liveNow.getMinutes();

  const { timelineEntries, refresh } = useCalendar(dateStr);

  const draftOpen = Boolean(draft);
  useEffect(() => {
    if (!draftOpen) return;
    const t = setTimeout(() => titleInputRef.current?.focus(), 0); // one tick after hook mount
    return () => clearTimeout(t);
  }, [draftOpen]);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isToday) {
      autoScrollRef.current = null;
      return;
    }

    if (autoScrollRef.current === dateStr) return;
    const layout = hourLayouts[currentHour];
    if (!layout) return;

    const targetY = Math.max(0, layout.y + (currentMinute / 60) * layout.height - 160);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
    });

    autoScrollRef.current = dateStr;
    return () => cancelAnimationFrame(frame);
  }, [currentHour, currentMinute, dateStr, hourLayouts, isToday]);

  const unscheduledEntries = useMemo(
    () => timelineEntries.filter((entry) => entry.minutes == null),
    [timelineEntries],
  );

  const hourlyEntries = useMemo(
    () => HOURS.map((hour) => timelineEntries.filter((entry) => entry.minutes != null && Math.floor(entry.minutes / 60) === hour)),
    [timelineEntries],
  );

  const doneCount = useMemo(
    () => timelineEntries.filter((entry) => entry.instance?.status === 'completed' || entry.item.status === 'completed').length,
    [timelineEntries],
  );

  const openCreate = (time?: string) => {
    Keyboard.dismiss();
    setDraft({
      mode: 'create',
      title: '',
      notes: '',
      type: 'task',
      time: time ? normalizeTimeInput(time) ?? time : getDefaultTime(isToday),
    });
  };

  const openEdit = (entry: TimelineEntry) => {
    Keyboard.dismiss();
    setDraft(createDraftFromEntry(entry));
  };

  const closeEditor = () => {
    setDraft(null);
  };

  const updateDraft = (updates: Partial<DraftState>) => {
    setDraft((current) => (current ? { ...current, ...updates } : current));
  };

  const saveDraft = () => {
    if (!draft) return;
    const title = draft.title.trim();
    const notes = draft.notes.trim();
    const time = parseHourMinuteTime(draft.time);

    if (!title || !time) {
      Alert.alert('Missing details', 'Add a title and a valid time to save the block.');
      return;
    }

    const snappedTime = formatTimeLabel(snapMinutesToStep(Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]), TIMELINE_SNAP_STEP));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (draft.mode === 'create') {
      createTimedItem(draft.type, title, dateStr, snappedTime, notes || undefined);
    } else if (draft.entry) {
      updateItem(draft.entry.item.id, {
        title,
        notes,
        type: draft.type,
      });
      updateTimelineItemTime(draft.entry.item.id, snappedTime, getTimeOfDayFromHour(Number(snappedTime.split(':')[0])));
    }

    refresh();
    closeEditor();
  };

  const handleComplete = (entry: TimelineEntry) => {
    if (entry.instance?.status === 'completed' || entry.item.status === 'completed') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry.instance) {
      completeInstance(entry.instance.id);
    }
    updateItemStatus(entry.item.id, 'completed');
    refresh();
  };

  const handleMove = (entry: TimelineEntry, minutesDelta: number) => {
    if (entry.minutes == null) return;
    const next = Math.max(0, Math.min(23 * 60 + 59, entry.minutes + minutesDelta));
    const nextTime = formatTimeLabel(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTimelineItemTime(entry.item.id, nextTime, getTimeOfDayFromHour(Math.floor(next / 60)));
    refresh();
  };

  const handleReschedule = (entry: TimelineEntry, nextTime: string) => {
    const nextMinutes = snapMinutesToStep(Number(nextTime.split(':')[0]) * 60 + Number(nextTime.split(':')[1]), TIMELINE_SNAP_STEP);
    const snapped = formatTimeLabel(nextMinutes);
    updateTimelineItemTime(entry.item.id, snapped, getTimeOfDayFromHour(Math.floor(nextMinutes / 60)));
    refresh();
  };

  const handleMoveToNow = (entry: TimelineEntry) => {
    if (!isToday) return;
    const next = snapMinutesToStep(liveNow.getHours() * 60 + liveNow.getMinutes(), TIMELINE_SNAP_STEP);
    const nextTime = formatTimeLabel(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTimelineItemTime(entry.item.id, nextTime, getTimeOfDayFromHour(Math.floor(next / 60)));
    refresh();
  };

  const handleDelete = (entry: TimelineEntry, onDeleted?: () => void) => {
    Alert.alert(
      'Delete block',
      `Delete “${entry.item.title}” from ${isToday ? 'this timeline' : dateStr}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteItem(entry.item.id);
            refresh();
            onDeleted?.();
          },
        },
      ],
    );
  };

  const currentLayout = isToday ? hourLayouts[currentHour] : undefined;
  const currentLineTop = currentLayout
    ? currentLayout.y + (currentMinute / 60) * currentLayout.height
    : null;

  const selectedLabel = selected.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const summaryLabel = isToday ? 'Live timeline · 15m snap' : 'Planning view · 15m snap';
  const blocksCount = timelineEntries.length;

  return (
    <RNView style={[s.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <RNView style={s.topShell}>
        <RNView style={s.monthNav}>
          <TouchableOpacity onPress={() => setSelected((prev) => addDays(prev, -7))} hitSlop={12} style={s.navButton}>
            <ChevronLeft size={18} color={palette.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          <RNView style={s.monthCenter}>
            <RNText style={[s.monthTitle, { color: palette.text }]}>
              {MONTHS[selected.getMonth()]}
            </RNText>
            <RNText style={[s.monthSub, { color: isToday ? palette.blue : palette.textTertiary }]}>
              {isToday ? 'Today' : String(selected.getFullYear())}
            </RNText>
          </RNView>

          <TouchableOpacity onPress={() => setSelected((prev) => addDays(prev, 7))} hitSlop={12} style={s.navButton}>
            <ChevronRight size={18} color={palette.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </RNView>

        <WeekStrip selected={selected} onSelect={setSelected} isDark={isDark} />

        <RNView style={[s.summaryCard, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
          <RNView style={s.summaryTopRow}>
            <RNView style={s.summaryTitleWrap}>
              <RNText style={[s.summaryEyebrow, { color: palette.textTertiary }]}>TIMEBLOCKING</RNText>
              <RNText style={[s.summaryTitle, { color: palette.text }]}>{selectedLabel}</RNText>
              <RNText style={[s.summarySub, { color: palette.textSecondary }]}>{summaryLabel}</RNText>
            </RNView>

            <RNView style={s.summaryActions}>
              {!isToday ? (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelected(new Date());
                  }}
                  style={[s.todayButton, { backgroundColor: palette.fill }]}
                  hitSlop={8}
                >
                  <RNText style={[s.todayButtonText, { color: palette.textSecondary }]}>Today</RNText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openCreate();
                }}
                style={[s.fabButton, { backgroundColor: palette.text }]}
                hitSlop={10}
              >
                <Plus size={18} color={palette.bg} strokeWidth={2.5} />
              </TouchableOpacity>
            </RNView>
          </RNView>

          <RNView style={s.summaryStats}>
            <RNView style={[s.statChip, { backgroundColor: palette.fill }]}>
              <RNText style={[s.statValue, { color: palette.text }]}>{blocksCount}</RNText>
              <RNText style={[s.statLabel, { color: palette.textSecondary }]}>blocks</RNText>
            </RNView>
            <RNView style={[s.statChip, { backgroundColor: palette.fill }]}>
              <RNText style={[s.statValue, { color: palette.text }]}>{doneCount}</RNText>
              <RNText style={[s.statLabel, { color: palette.textSecondary }]}>done</RNText>
            </RNView>
            <RNView style={[s.statChip, { backgroundColor: palette.fill }]}>
              <RNText style={[s.statValue, { color: palette.text }]}>{unscheduledEntries.length}</RNText>
              <RNText style={[s.statLabel, { color: palette.textSecondary }]}>flexible</RNText>
            </RNView>
          </RNView>

          <RNView style={s.summaryHintRow}>
            <Clock size={12} color={palette.textMuted} strokeWidth={1.8} />
            <RNText style={[s.summaryHint, { color: palette.textSecondary }]}>
              Drag blocks by the grip. Time snaps to quarter hours.
            </RNText>
          </RNView>
        </RNView>
      </RNView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 96 },
        ]}
      >
        {unscheduledEntries.length > 0 ? (
          <RNView style={s.section}>
            <RNView style={s.sectionHeader}>
              <RNView style={s.sectionHeaderLeft}>
                <Calendar size={14} color={palette.textMuted} strokeWidth={1.8} />
                <RNText style={[s.sectionTitle, { color: palette.textSecondary }]}>
                  FLEXIBLE ({unscheduledEntries.length})
                </RNText>
              </RNView>
              <TouchableOpacity onPress={() => openCreate()} hitSlop={8}>
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
                    onOpen={openEdit}
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

        <RNView style={s.section}>
          <RNView style={s.sectionHeader}>
            <RNView style={s.sectionHeaderLeft}>
              <Clock size={14} color={palette.textMuted} strokeWidth={1.8} />
              <RNText style={[s.sectionTitle, { color: palette.textSecondary }]}>24-HOUR TIMELINE</RNText>
            </RNView>
            <TouchableOpacity onPress={() => openCreate()} hitSlop={8}>
              <RNText style={[s.sectionAction, { color: palette.blue }]}>Block now</RNText>
            </TouchableOpacity>
          </RNView>

          <RNView style={[s.timelineWrap, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
            {currentLineTop != null ? (
              <RNView pointerEvents="none" style={[s.currentLine, { top: currentLineTop }]}>
                <RNView style={[s.currentPill, { backgroundColor: palette.blue }]}>
                  <RNText style={s.currentPillText}>
                    Now {liveNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </RNText>
                </RNView>
                <RNView style={[s.currentLineTrack, { backgroundColor: palette.blue }]} />
              </RNView>
            ) : null}

            {HOURS.map((hour) => {
              const entries = hourlyEntries[hour];
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <RNView
                  key={hour}
                  onLayout={(event) => {
                    const layout = event.nativeEvent.layout;
                    setHourLayouts((current) => {
                      const previous = current[hour];
                      if (previous && previous.y === layout.y && previous.height === layout.height) return current;
                      return {
                        ...current,
                        [hour]: { y: layout.y, height: layout.height },
                      };
                    });
                  }}
                  style={[
                    s.hourRow,
                    {
                      minHeight: HOUR_SLOT_HEIGHT,
                      borderBottomColor: palette.separator,
                      backgroundColor: isCurrentHour ? palette.fill : 'transparent',
                    },
                  ]}
                >
            <RNView style={s.hourRail}>
              <RNText style={[s.hourLabel, { color: isCurrentHour ? palette.blue : palette.textSecondary }]}>
                {formatHourLabel(hour)}
              </RNText>
              <RNView style={[s.hourChip, { backgroundColor: isCurrentHour ? palette.blueSoft : palette.fill }]}>
                <RNText style={[s.hourChipText, { color: isCurrentHour ? palette.blue : palette.textMuted }]}>
                  {timeOfDayLabel(getTimeOfDayFromHour(hour))}
                </RNText>
              </RNView>
              <RNView style={s.quarterMarks}>
                {[15, 30, 45].map((minute) => (
                  <RNView key={minute} style={s.quarterMark}>
                    <RNView
                      style={[
                        s.quarterTick,
                        {
                          backgroundColor: isCurrentHour ? palette.blue : palette.separatorStrong,
                        },
                      ]}
                    />
                    <RNText style={[s.quarterMarkLabel, { color: palette.textTertiary }]}>
                      {String(minute).padStart(2, '0')}
                    </RNText>
                  </RNView>
                ))}
              </RNView>
            </RNView>

                  <RNView style={s.hourBody}>
                    <TouchableOpacity
                      onPress={() => openCreate(`${String(hour).padStart(2, '0')}:00`)}
                      style={[s.addSlotButton, { borderColor: palette.separator }]}
                      hitSlop={8}
                    >
                      <Plus size={14} color={palette.textSecondary} strokeWidth={2.2} />
                      <RNText style={[s.addSlotText, { color: palette.textSecondary }]}>Add</RNText>
                    </TouchableOpacity>

                    {entries.length > 0 ? (
                      <RNView style={s.hourEntryList}>
                        {entries.map((entry, index) => (
                          <RNView key={entry.instance?.id ?? entry.item.id}>
                            <TimelineEntryCard
                              entry={entry}
                              palette={palette}
                              isDark={isDark}
                              isToday={isToday}
                              onOpen={openEdit}
                              onComplete={handleComplete}
                              onMove={handleMove}
                              onMoveToNow={handleMoveToNow}
                              onDelete={handleDelete}
                              onReschedule={handleReschedule}
                            />
                            {index < entries.length - 1 ? (
                              <RNView style={[s.itemDivider, { backgroundColor: palette.separator }]} />
                            ) : null}
                          </RNView>
                        ))}
                      </RNView>
                    ) : (
                      <RNView style={s.emptyHourHint}>
                        <RNText style={[s.emptyHourText, { color: palette.textTertiary }]}>
                          Tap add to block this hour.
                        </RNText>
                      </RNView>
                    )}
                  </RNView>
                </RNView>
              );
            })}
          </RNView>
        </RNView>
      </ScrollView>

      <BottomSheet
        visible={Boolean(draft)}
        onClose={closeEditor}
        isDark={isDark}
        scrollable
        title={draft?.mode === 'edit' ? 'Edit block' : 'New block'}
        subtitle={draft?.mode === 'edit' ? selectedLabel : dateStr}
        headerLeft={
          <TouchableOpacity onPress={closeEditor} hitSlop={12}>
            <RNText style={[s.sheetAction, { color: palette.textSecondary }]}>Cancel</RNText>
          </TouchableOpacity>
        }
        headerRight={
          <TouchableOpacity onPress={saveDraft} hitSlop={12} disabled={!draft?.title.trim()}>
            <RNText
              style={[
                s.sheetAction,
                s.sheetSave,
                {
                  color: palette.blue,
                  opacity: draft?.title.trim() ? 1 : 0.32,
                },
              ]}
            >
              Save
            </RNText>
          </TouchableOpacity>
        }
        contentContainerStyle={s.sheetContent}
      >
        {draft ? (
          <RNView style={s.sheetBody}>
            <RNView style={[s.fieldGroup, { borderColor: palette.separator, backgroundColor: palette.fill }]}>
              <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Title</RNText>
              <TextInput
                ref={titleInputRef}
                value={draft.title}
                onChangeText={(value) => updateDraft({ title: value })}
                placeholder="Block title"
                placeholderTextColor={palette.textMuted}
                style={[s.titleInput, { color: palette.text }]}
                autoCorrect={false}
                returnKeyType="next"
                selectTextOnFocus
                blurOnSubmit={false}
                onSubmitEditing={() => notesInputRef.current?.focus()}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
            </RNView>

            <RNView style={[s.fieldGroup, { borderColor: palette.separator, backgroundColor: palette.fill }]}>
              <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Notes</RNText>
              <TextInput
                ref={notesInputRef}
                value={draft.notes}
                onChangeText={(value) => updateDraft({ notes: value })}
                placeholder="Optional details"
                placeholderTextColor={palette.textMuted}
                style={[s.notesInput, { color: palette.text }]}
                multiline
                autoCorrect={false}
                selectTextOnFocus
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
            </RNView>

            <RNView style={s.timeBlock}>
              <RNView style={s.timeHeader}>
                <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Time</RNText>
                <RNView style={[s.timeMetaChip, { backgroundColor: palette.fill }]}>
                  <Clock size={12} color={palette.textMuted} strokeWidth={1.8} />
                  <RNText style={[s.timeMetaText, { color: palette.textSecondary }]}>
                    24-hour block
                  </RNText>
                </RNView>
              </RNView>

              <RNView style={s.timeInputs}>
                <TextInput
                  ref={hourInputRef}
                  value={draft.time.split(':')[0] ?? ''}
                  onChangeText={(value) => {
                    const nextHour = value.replace(/[^\d]/g, '').slice(0, 2);
                    const minute = draft.time.split(':')[1] ?? '00';
                    updateDraft({ time: `${nextHour}${minute ? `:${minute}` : ''}` });
                  }}
                  placeholder="09"
                  placeholderTextColor={palette.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[s.timeInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]}
                  selectTextOnFocus
                  blurOnSubmit={false}
                  returnKeyType="next"
                  onSubmitEditing={() => minuteInputRef.current?.focus()}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
                <RNText style={[s.timeSeparator, { color: palette.textSecondary }]}>:</RNText>
                <TextInput
                  ref={minuteInputRef}
                  value={draft.time.split(':')[1] || '00'}
                  onChangeText={(value) => {
                    const nextMinute = value.replace(/[^\d]/g, '').slice(0, 2);
                    const hour = draft.time.split(':')[0] || '09';
                    updateDraft({ time: `${hour}:${nextMinute}` });
                  }}
                  placeholder="30"
                  placeholderTextColor={palette.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[s.timeInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]}
                  selectTextOnFocus
                  blurOnSubmit={false}
                  returnKeyType="done"
                  onSubmitEditing={saveDraft}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
                <TouchableOpacity
                  onPress={() => {
                    const now = new Date();
                    const next = isToday ? formatTimeLabel(now.getHours() * 60 + now.getMinutes()) : '09:00';
                    updateDraft({ time: next });
                  }}
                  style={[s.timeQuickButton, { backgroundColor: palette.text }]}
                  hitSlop={8}
                >
                  <RNText style={[s.timeQuickText, { color: palette.bg }]}>Now</RNText>
                </TouchableOpacity>
              </RNView>
            </RNView>

            <RNView style={s.typeSection}>
              <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Type</RNText>
              <RNView style={s.typeGrid}>
                {TYPE_OPTIONS.map((option) => {
                  const selectedType = draft.type === option.value;
                  const accent = getAccentColor(palette, option.accent);
                  const soft = getAccentSoftColor(palette, option.accent);
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => updateDraft({ type: option.value })}
                      activeOpacity={0.8}
                      style={[
                        s.typeChip,
                        {
                          backgroundColor: selectedType ? soft : palette.fill,
                          borderColor: selectedType ? accent : palette.separator,
                        },
                      ]}
                    >
                      {renderTypeIcon(option.value, selectedType ? accent : palette.iconMuted, 12)}
                      <RNText style={[s.typeChipText, { color: selectedType ? accent : palette.textSecondary }]}>
                        {option.label}
                      </RNText>
                    </TouchableOpacity>
                  );
                })}
                {!TYPE_OPTIONS.some((option) => option.value === draft.type) ? (
                  <TouchableOpacity
                    onPress={() => updateDraft({ type: draft.type })}
                    activeOpacity={0.8}
                    style={[
                      s.typeChip,
                      {
                        backgroundColor: palette.blueSoft,
                        borderColor: palette.blue,
                      },
                    ]}
                  >
                    <Check size={12} color={palette.blue} strokeWidth={2} />
                    <RNText style={[s.typeChipText, { color: palette.blue }]}>
                      {capitalizeType(draft.type)}
                    </RNText>
                  </TouchableOpacity>
                ) : null}
              </RNView>
            </RNView>

            {draft.mode === 'edit' ? (
              <TouchableOpacity
                onPress={() => {
                  if (!draft.entry) return;
                  handleDelete(draft.entry, closeEditor);
                }}
                style={[s.deleteButton, { borderColor: palette.redSoft, backgroundColor: palette.redSoft }]}
                hitSlop={8}
              >
                <Trash2 size={14} color={palette.red} strokeWidth={1.8} />
                <RNText style={[s.deleteButtonText, { color: palette.red }]}>Delete block</RNText>
              </TouchableOpacity>
            ) : null}
          </RNView>
        ) : null}
      </BottomSheet>
    </RNView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topShell: {
    gap: spacing[3],
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  monthSub: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    gap: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
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
    borderWidth: 1,
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
  todayDotSpacer: {
    width: 4,
    height: 4,
  },
  summaryCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[2],
    ...shadows.soft,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  summaryTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  summarySub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryHint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  statChip: {
    flex: 1,
    borderRadius: radius.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  section: {
    gap: spacing[1],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  flexList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  timelineWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  currentLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10,
  },
  currentPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  currentPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  currentLineTrack: {
    height: 2,
    borderRadius: 999,
    opacity: 0.8,
  },
  hourRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0)',
  },
  hourRail: {
    width: 82,
    flexShrink: 0,
    alignItems: 'flex-start',
    gap: 4,
    paddingTop: 2,
  },
  hourLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  hourChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hourChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hourBody: {
    flex: 1,
    gap: spacing[1],
  },
  addSlotButton: {
    minHeight: 36,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addSlotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hourEntryList: {
    gap: spacing[2],
  },
  emptyHourHint: {
    minHeight: 20,
    justifyContent: 'center',
  },
  emptyHourText: {
    fontSize: 12,
    fontWeight: '500',
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
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    gap: 5,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  entryTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  dragGripWrap: {
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  dragHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quarterMarks: {
    width: '100%',
    gap: 2,
    marginTop: 2,
  },
  quarterMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quarterTick: {
    width: 8,
    height: 1.5,
    borderRadius: 999,
    opacity: 0.9,
  },
  quarterMarkLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dragPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  dragPreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dragPreviewTime: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dragPreviewSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 22,
  },
  timePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 22,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  entryNotes: {
    fontSize: 12,
    lineHeight: 16,
  },
  entryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sheetAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  sheetSave: {
    fontWeight: '800',
  },
  sheetContent: {
    paddingBottom: spacing[5],
  },
  sheetBody: {
    gap: spacing[3],
  },
  fieldGroup: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    minHeight: 46,
    paddingVertical: 0,
  },
  notesInput: {
    fontSize: fontSize.base,
    fontWeight: '400',
    minHeight: 72,
    paddingVertical: 0,
    lineHeight: 22,
  },
  timeBlock: {
    gap: spacing[2],
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  timeMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeMetaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 74,
    minHeight: 46,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    width: 12,
    textAlign: 'center',
  },
  timeQuickButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeQuickText: {
    fontSize: 13,
    fontWeight: '800',
  },
  typeSection: {
    gap: spacing[2],
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  deleteButton: {
    minHeight: 46,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
