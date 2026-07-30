import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCalendar, useInbox, useTasks } from '../hooks/useDb';
import { createItem, updateItemStatus, updateTimelineItemSchedule, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';
import type { TimelineEntry } from '../db/database';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM – 11 PM

function addDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabelFor(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function hourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${period}`;
}

function weekdayShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
}

function dayOfMonth(dateStr: string): number {
  return Number(dateStr.split('-')[2]);
}

function hourOf(entry: TimelineEntry): number | null {
  if (!entry.time) return null;
  const hour = Number(entry.time.split(':')[0]);
  if (Number.isNaN(hour)) return null;
  return Math.max(6, Math.min(23, hour));
}

// RNW's Pressable/View don't forward unrecognized props (draggable,
// onDragStart, ...) to the underlying DOM node — there's no first-class RN
// drag API — so drag source/target behavior is wired directly onto the real
// DOM element via a ref instead, in a plain useEffect.
function useDraggableRef(itemId: string) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.draggable = true;
    node.style.cursor = 'grab';
    const onDragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('text/plain', itemId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };
    node.addEventListener('dragstart', onDragStart);
    return () => node.removeEventListener('dragstart', onDragStart);
  }, [itemId]);
  return ref;
}

function useDropZoneRef(onDropItemId: (id: string) => void, onHoverChange: (hovering: boolean) => void) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(true);
    };
    const onDragLeave = () => onHoverChange(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(false);
      const id = event.dataTransfer?.getData('text/plain');
      if (id) onDropItemId(id);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

interface CardProps {
  item: Item;
  onOpen: (id: string) => void;
  onToggleComplete: (item: Item) => void;
}

function CalendarCard({ item, onOpen, onToggleComplete }: CardProps) {
  const ref = useDraggableRef(item.id);
  const completed = item.status === 'completed';
  return (
    <Pressable ref={ref} style={styles.card} onPress={() => onOpen(item.id)}>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onToggleComplete(item);
        }}
        style={[styles.checkbox, completed && styles.checkboxDone]}
      >
        {completed ? <Check size={12} color={webColors.card} strokeWidth={2.5} /> : null}
      </Pressable>
      <Text style={[styles.cardTitle, completed && styles.cardTitleDone]} numberOfLines={1}>
        {item.title}
      </Text>
    </Pressable>
  );
}

interface RowProps extends CardProps {
  label: string;
  items: Item[];
  onDropItem: (id: string) => void;
}

function DropRow({ label, items, onOpen, onToggleComplete, onDropItem }: Omit<RowProps, 'item'>) {
  const [hovering, setHovering] = useState(false);
  const ref = useDropZoneRef(onDropItem, setHovering);
  return (
    <View ref={ref} style={[styles.hourRow, hovering && styles.dropTargetActive]}>
      <Text style={styles.hourLabel}>{label}</Text>
      <View style={styles.hourCards}>
        {items.map((item) => (
          <CalendarCard key={item.id} item={item} onOpen={onOpen} onToggleComplete={onToggleComplete} />
        ))}
      </View>
    </View>
  );
}

interface UnscheduledPaneProps {
  sections: Array<{ label: string; items: Item[] }>;
  onOpen: (id: string) => void;
  onToggleComplete: (item: Item) => void;
  onDropItem: (id: string) => void;
}

function UnscheduledPane({ sections, onOpen, onToggleComplete, onDropItem }: UnscheduledPaneProps) {
  const [hovering, setHovering] = useState(false);
  const ref = useDropZoneRef(onDropItem, setHovering);
  const isEmpty = sections.every((s) => s.items.length === 0);
  return (
    <View ref={ref} style={[styles.unscheduledPane, hovering && styles.dropTargetActive]}>
      <Text style={styles.paneTitle}>Unscheduled</Text>
      <ScrollView contentContainerStyle={styles.paneScrollContent}>
        {isEmpty ? (
          <Text style={styles.empty}>Nothing unscheduled.</Text>
        ) : (
          sections.map((section) =>
            section.items.length > 0 ? (
              <View key={section.label} style={styles.section}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {section.items.map((item) => (
                  <CalendarCard key={item.id} item={item} onOpen={onOpen} onToggleComplete={onToggleComplete} />
                ))}
              </View>
            ) : null
          )
        )}
      </ScrollView>
    </View>
  );
}

interface WeekDayChipProps {
  date: string;
  active: boolean;
  isToday: boolean;
  onSelect: (date: string) => void;
  onDropItem: (date: string, itemId: string) => void;
}

function WeekDayChip({ date, active, isToday, onSelect, onDropItem }: WeekDayChipProps) {
  const [hovering, setHovering] = useState(false);
  const ref = useDropZoneRef((id) => onDropItem(date, id), setHovering);
  return (
    <Pressable
      ref={ref}
      onPress={() => onSelect(date)}
      style={[styles.weekChip, active && styles.weekChipActive, hovering && styles.dropTargetActive]}
    >
      <Text style={[styles.weekChipDay, active && styles.weekChipTextActive]}>{weekdayShort(date)}</Text>
      <Text style={[styles.weekChipDate, active && styles.weekChipTextActive, isToday && !active && styles.weekChipToday]}>
        {dayOfMonth(date)}
      </Text>
    </Pressable>
  );
}

export function CalendarScreen() {
  const [viewedDate, setViewedDate] = useState(() => formatDate(new Date()));
  const { timelineEntries, refresh } = useCalendar(viewedDate);
  const { items: inboxItems, refresh: refreshInbox } = useInbox();
  const { tasks, refresh: refreshTasks } = useTasks();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = formatDate(new Date());
  const isToday = viewedDate === today;
  const allEntryItems = timelineEntries.map((e) => e.item);
  const selectedItem =
    allEntryItems.find((i) => i.id === selectedId) ??
    inboxItems.find((i) => i.id === selectedId) ??
    tasks.find((i) => i.id === selectedId) ??
    null;

  const refreshAll = () => {
    refresh();
    refreshInbox();
    refreshTasks();
  };

  const unscheduledInbox = inboxItems.filter((i) => !i.scheduledDate);
  const unscheduledTasks = tasks.filter((i) => !i.scheduledDate);

  const anytimeEntries = timelineEntries.filter((e) => hourOf(e) === null);
  const entriesByHour = new Map<number, TimelineEntry[]>();
  for (const hour of HOURS) entriesByHour.set(hour, []);
  for (const entry of timelineEntries) {
    const hour = hourOf(entry);
    if (hour !== null) entriesByHour.get(hour)?.push(entry);
  }

  const submitCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('task', trimmed, 'active', viewedDate);
    setCaptureText('');
    refreshAll();
  };

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refreshAll();
  };

  const scheduleAt = (itemId: string, hour: number | null) => {
    const time = hour === null ? undefined : `${String(hour).padStart(2, '0')}:00`;
    updateTimelineItemSchedule(itemId, viewedDate, time);
    refreshAll();
  };

  const unschedule = (itemId: string) => {
    updateTimelineItemSchedule(itemId, undefined, undefined);
    refreshAll();
  };

  // Coarse date-only assignment (dropped on a week-strip day, not an hour
  // row) — clears any existing time since the target day's timeline hasn't
  // been chosen yet, and jumps the view there so the time can be refined by
  // dragging within that day right after.
  const scheduleDate = (date: string, itemId: string) => {
    updateTimelineItemSchedule(itemId, date, undefined);
    setViewedDate(date);
    refreshAll();
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setViewedDate((d) => addDays(d, -1))} style={styles.navButton}>
          <ChevronLeft size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{dateLabelFor(viewedDate)}</Text>
          {!isToday ? (
            <Pressable onPress={() => setViewedDate(today)}>
              <Text style={styles.todayLink}>Today</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => setViewedDate((d) => addDays(d, 1))} style={styles.navButton}>
          <ChevronRight size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View style={styles.weekStrip}>
        {weekDays.map((date) => (
          <WeekDayChip
            key={date}
            date={date}
            active={date === viewedDate}
            isToday={date === today}
            onSelect={setViewedDate}
            onDropItem={scheduleDate}
          />
        ))}
      </View>

      <View style={styles.captureRow}>
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submitCapture}
          placeholder={`Quick add for ${dateLabelFor(viewedDate)}...`}
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      <View style={styles.panes}>
        <UnscheduledPane
          sections={[
            { label: 'INBOX', items: unscheduledInbox },
            { label: 'TASKS', items: unscheduledTasks },
          ]}
          onOpen={setSelectedId}
          onToggleComplete={toggleComplete}
          onDropItem={unschedule}
        />

        <ScrollView style={styles.timelinePane} contentContainerStyle={styles.timelineContent}>
          <DropRow
            label="Anytime"
            items={anytimeEntries.map((e) => e.item)}
            onOpen={setSelectedId}
            onToggleComplete={toggleComplete}
            onDropItem={(id) => scheduleAt(id, null)}
          />
          {HOURS.map((hour) => (
            <DropRow
              key={hour}
              label={hourLabel(hour)}
              items={(entriesByHour.get(hour) ?? []).map((e) => e.item)}
              onOpen={setSelectedId}
              onToggleComplete={toggleComplete}
              onDropItem={(id) => scheduleAt(id, hour)}
            />
          ))}
        </ScrollView>
      </View>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Item">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={refreshAll}
            onDeleted={() => {
              setSelectedId(null);
              refreshAll();
            }}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  todayLink: {
    fontSize: webFontSize.sm,
    color: webColors.accent,
    fontWeight: '600',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginHorizontal: webSpacing[6],
    marginTop: webSpacing[4],
  },
  weekChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.card,
    borderWidth: 1,
    borderColor: webColors.border,
  },
  weekChipActive: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  weekChipDay: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    fontWeight: '600',
  },
  weekChipDate: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    fontWeight: '700',
  },
  weekChipTextActive: {
    color: webColors.card,
  },
  weekChipToday: {
    color: webColors.accent,
  },
  captureRow: {
    marginHorizontal: webSpacing[6],
    marginTop: webSpacing[4],
    marginBottom: webSpacing[2],
  },
  captureInput: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  panes: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[4],
  },
  unscheduledPane: {
    width: 260,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[3],
  },
  paneTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
    marginBottom: webSpacing[2],
    paddingHorizontal: webSpacing[1],
  },
  paneScrollContent: {
    gap: webSpacing[3],
  },
  section: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
    paddingHorizontal: webSpacing[1],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    padding: webSpacing[2],
  },
  timelinePane: {
    flex: 1,
  },
  timelineContent: {
    gap: 2,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: webSpacing[3],
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  dropTargetActive: {
    backgroundColor: `${webColors.accent}1A`,
  },
  hourLabel: {
    width: 56,
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    paddingTop: webSpacing[2],
  },
  hourCards: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  cardTitle: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    maxWidth: 200,
  },
  cardTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
