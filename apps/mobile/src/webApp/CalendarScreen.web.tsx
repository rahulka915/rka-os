import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, Check, ChevronLeft, ChevronRight, ListTree, Navigation, Rows3 } from 'lucide-react-native';
import { useCalendar, useInbox, useTasks } from '../hooks/useDb';
import { createItem, updateItemStatus, updateTimelineItemSchedule, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { PlanBackwardsScreen } from './PlanBackwardsScreen.web';
import { UpcomingScreen } from './UpcomingScreen.web';
import { useDraggableRef, useDropZoneRef } from './hooks/useDomDragAndDrop';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';
import type { TimelineEntry } from '../db/database';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM – 11 PM
const SNAP_MINUTES = 15;
const QUARTERS = [0, 15, 30, 45];

// Web has no free-drag pixel position (DOM drag-and-drop only fires
// discrete dragover/drop targets), so 15-min snapping is expressed as one
// drop target per quarter-hour instead of rounding a continuous pixel
// offset the way native's timelineMinutesForPixels/snapMinutesToStep do.
function snapTimeString(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m;
  const snapped = Math.round(total / SNAP_MINUTES) * SNAP_MINUTES;
  const hh = Math.floor(snapped / 60);
  const mm = snapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

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

// Minutes-of-day snapped to the nearest quarter hour, used to bucket an
// entry into its quarter-hour drop target within an hour row.
function quarterOf(entry: TimelineEntry): number | null {
  if (!entry.time) return null;
  const [h, m] = entry.time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const snapped = Math.round(m / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped === 60 ? 0 : snapped;
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

interface QuarterCellProps {
  minute: number;
  items: Item[];
  onOpen: (id: string) => void;
  onToggleComplete: (item: Item) => void;
  onDropItem: (id: string) => void;
}

function QuarterCell({ minute, items, onOpen, onToggleComplete, onDropItem }: QuarterCellProps) {
  const [hovering, setHovering] = useState(false);
  const ref = useDropZoneRef(onDropItem, setHovering);
  return (
    <View ref={ref} style={[styles.quarterCell, hovering && styles.dropTargetActive]}>
      <Text style={styles.quarterLabel}>:{String(minute).padStart(2, '0')}</Text>
      <View style={styles.hourCards}>
        {items.map((item) => (
          <CalendarCard key={item.id} item={item} onOpen={onOpen} onToggleComplete={onToggleComplete} />
        ))}
      </View>
    </View>
  );
}

interface HourBlockProps {
  hour: number;
  entriesByQuarter: Map<number, Item[]>;
  onOpen: (id: string) => void;
  onToggleComplete: (item: Item) => void;
  onDropItem: (hour: number, minute: number, id: string) => void;
}

// 15-minute snapping: an hour row is split into four quarter-hour drop
// targets rather than a single hour-wide one — dropping a card snaps it
// to whichever quarter cell it lands on.
function HourBlock({ hour, entriesByQuarter, onOpen, onToggleComplete, onDropItem }: HourBlockProps) {
  return (
    <View style={styles.hourBlock}>
      <Text style={styles.hourBlockLabel}>{hourLabel(hour)}</Text>
      <View style={styles.hourBlockQuarters}>
        {QUARTERS.map((minute) => (
          <QuarterCell
            key={minute}
            minute={minute}
            items={entriesByQuarter.get(minute) ?? []}
            onOpen={onOpen}
            onToggleComplete={onToggleComplete}
            onDropItem={(id) => onDropItem(hour, minute, id)}
          />
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
  const [dayView, setDayView] = useState<'timeline' | 'agenda' | 'planbackwards' | 'upcoming'>('timeline');
  const [planOpen, setPlanOpen] = useState(false);
  const [planTimeById, setPlanTimeById] = useState<Record<string, string>>({});

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
  const entriesByHourQuarter = new Map<number, Map<number, TimelineEntry[]>>();
  for (const hour of HOURS) {
    const byQuarter = new Map<number, TimelineEntry[]>();
    for (const minute of QUARTERS) byQuarter.set(minute, []);
    entriesByHourQuarter.set(hour, byQuarter);
  }
  for (const entry of timelineEntries) {
    const hour = hourOf(entry);
    const minute = quarterOf(entry);
    if (hour !== null && minute !== null) entriesByHourQuarter.get(hour)?.get(minute)?.push(entry);
  }

  const agendaEntries = [...timelineEntries].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });

  const planUnscheduled = [...unscheduledInbox, ...unscheduledTasks];

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

  const scheduleAt = (itemId: string, hour: number | null, minute = 0) => {
    const time = hour === null ? undefined : snapTimeString(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    updateTimelineItemSchedule(itemId, viewedDate, time);
    refreshAll();
  };

  // Plan-your-day drawer: assign a typed time (snapped to the nearest
  // quarter hour) to an unscheduled item, v1 stand-in for native's
  // drag-from-drawer-onto-timeline interaction.
  const assignPlanTime = (itemId: string) => {
    const raw = planTimeById[itemId];
    if (!raw) return;
    updateTimelineItemSchedule(itemId, viewedDate, snapTimeString(raw));
    setPlanTimeById((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
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
      {dayView !== 'planbackwards' && dayView !== 'upcoming' ? (
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
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segment, dayView === 'timeline' && styles.segmentActive]}
            onPress={() => setDayView('timeline')}
          >
            <Rows3 size={13} color={dayView === 'timeline' ? webColors.foreground : webColors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.segmentLabel, dayView === 'timeline' && styles.segmentLabelActive]}>Timeline</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, dayView === 'agenda' && styles.segmentActive]}
            onPress={() => setDayView('agenda')}
          >
            <ListTree size={13} color={dayView === 'agenda' ? webColors.foreground : webColors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.segmentLabel, dayView === 'agenda' && styles.segmentLabelActive]}>Agenda</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, dayView === 'planbackwards' && styles.segmentActive]}
            onPress={() => setDayView('planbackwards')}
          >
            <Navigation size={13} color={dayView === 'planbackwards' ? webColors.foreground : webColors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.segmentLabel, dayView === 'planbackwards' && styles.segmentLabelActive]}>Plan Backwards</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, dayView === 'upcoming' && styles.segmentActive]}
            onPress={() => setDayView('upcoming')}
          >
            <CalendarClock size={13} color={dayView === 'upcoming' ? webColors.foreground : webColors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.segmentLabel, dayView === 'upcoming' && styles.segmentLabelActive]}>Upcoming</Text>
          </Pressable>
        </View>

        {dayView !== 'planbackwards' && dayView !== 'upcoming' ? (
          <Pressable style={styles.planButton} onPress={() => setPlanOpen(true)}>
            <Text style={styles.planButtonLabel}>Plan your day · {planUnscheduled.length}</Text>
          </Pressable>
        ) : null}
      </View>

      {dayView === 'planbackwards' ? (
        <PlanBackwardsScreen />
      ) : dayView === 'upcoming' ? (
        <UpcomingScreen />
      ) : (
        <>
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

            {dayView === 'timeline' ? (
              <ScrollView style={styles.timelinePane} contentContainerStyle={styles.timelineContent}>
                <DropRow
                  label="Anytime"
                  items={anytimeEntries.map((e) => e.item)}
                  onOpen={setSelectedId}
                  onToggleComplete={toggleComplete}
                  onDropItem={(id) => scheduleAt(id, null)}
                />
                {HOURS.map((hour) => (
                  <HourBlock
                    key={hour}
                    hour={hour}
                    entriesByQuarter={
                      new Map(
                        QUARTERS.map((minute) => [
                          minute,
                          (entriesByHourQuarter.get(hour)?.get(minute) ?? []).map((e) => e.item),
                        ])
                      )
                    }
                    onOpen={setSelectedId}
                    onToggleComplete={toggleComplete}
                    onDropItem={(hour2, minute2, id) => scheduleAt(id, hour2, minute2)}
                  />
                ))}
              </ScrollView>
            ) : (
              <ScrollView style={styles.timelinePane} contentContainerStyle={styles.agendaContent}>
                {agendaEntries.length === 0 ? (
                  <Text style={styles.empty}>Nothing scheduled for this day.</Text>
                ) : (
                  agendaEntries.map((entry) => (
                    <Pressable key={entry.item.id} style={styles.agendaRow} onPress={() => setSelectedId(entry.item.id)}>
                      <Text style={styles.agendaTime}>{entry.time ? snapTimeString(entry.time) : 'Anytime'}</Text>
                      <View style={styles.agendaCardWrap}>
                        <CalendarCard item={entry.item} onOpen={setSelectedId} onToggleComplete={toggleComplete} />
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </>
      )}

      <DetailPanel visible={planOpen} onClose={() => setPlanOpen(false)} title="Plan your day">
        <View style={styles.planList}>
          {planUnscheduled.length === 0 ? (
            <Text style={styles.empty}>Nothing unscheduled — you're all planned.</Text>
          ) : (
            planUnscheduled.map((item) => (
              <View key={item.id} style={styles.planRow}>
                <Text style={styles.planRowTitle} numberOfLines={1}>{item.title}</Text>
                <TextInput
                  value={planTimeById[item.id] ?? ''}
                  onChangeText={(text) => setPlanTimeById((current) => ({ ...current, [item.id]: text }))}
                  placeholder="HH:MM"
                  placeholderTextColor={webColors.mutedForeground}
                  style={styles.planTimeInput}
                />
                <Pressable
                  style={styles.planAssignButton}
                  onPress={() => assignPlanTime(item.id)}
                  disabled={!planTimeById[item.id]}
                >
                  <Text style={styles.planAssignLabel}>Add to timeline</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </DetailPanel>

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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[6],
    marginTop: webSpacing[3],
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
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
  planButton: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  planButtonLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.accent,
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
  hourBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: webSpacing[3],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[1],
  },
  hourBlockLabel: {
    width: 56,
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    paddingTop: webSpacing[2],
  },
  hourBlockQuarters: {
    flex: 1,
    gap: 1,
  },
  quarterCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[1],
    paddingVertical: 3,
    minHeight: 20,
  },
  quarterLabel: {
    width: 28,
    fontSize: 10,
    color: webColors.mutedForeground,
  },
  agendaContent: {
    gap: webSpacing[2],
    paddingVertical: webSpacing[2],
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
  },
  agendaTime: {
    width: 84,
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  agendaCardWrap: {
    flex: 1,
  },
  planList: {
    gap: webSpacing[3],
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[2],
  },
  planRowTitle: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  planTimeInput: {
    width: 72,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[1],
  },
  planAssignButton: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  planAssignLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.card,
  },
});
