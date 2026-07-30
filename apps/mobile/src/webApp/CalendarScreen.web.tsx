import { useState } from 'react';
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

function hourOf(entry: TimelineEntry): number | null {
  if (!entry.time) return null;
  const hour = Number(entry.time.split(':')[0]);
  if (Number.isNaN(hour)) return null;
  return Math.max(6, Math.min(23, hour));
}

// RNW's View/Pressable forward unrecognized props straight to the DOM node,
// so native HTML5 drag-and-drop works via a type-cast past ViewProps — there's
// no first-class RN drag API, and this is a .web.tsx-only file anyway.
const dragProps = (itemId: string) =>
  ({
    draggable: true,
    onDragStart: (event: any) => {
      event.dataTransfer.setData('text/plain', itemId);
      event.dataTransfer.effectAllowed = 'move';
    },
  }) as any;

export function CalendarScreen() {
  const [viewedDate, setViewedDate] = useState(() => formatDate(new Date()));
  const { timelineEntries, refresh } = useCalendar(viewedDate);
  const { items: inboxItems, refresh: refreshInbox } = useInbox();
  const { tasks, refresh: refreshTasks } = useTasks();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

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

  const dropOnHour = (event: any, hour: number | null) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData('text/plain');
    setDragOverKey(null);
    if (!itemId) return;
    const time = hour === null ? undefined : `${String(hour).padStart(2, '0')}:00`;
    updateTimelineItemSchedule(itemId, viewedDate, time);
    refreshAll();
  };

  const dropOnUnscheduled = (event: any) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData('text/plain');
    setDragOverKey(null);
    if (!itemId) return;
    updateTimelineItemSchedule(itemId, undefined, undefined);
    refreshAll();
  };

  const dropTargetProps = (key: string, onDrop: (event: any) => void) =>
    ({
      onDragOver: (event: any) => {
        event.preventDefault();
        if (dragOverKey !== key) setDragOverKey(key);
      },
      onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
      onDrop,
    }) as any;

  const renderCard = (item: Item) => {
    const completed = item.status === 'completed';
    return (
      <Pressable
        key={item.id}
        style={styles.card}
        onPress={() => setSelectedId(item.id)}
        {...dragProps(item.id)}
      >
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            toggleComplete(item);
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
  };

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
        <View
          style={[styles.unscheduledPane, dragOverKey === 'unscheduled' && styles.dropTargetActive]}
          {...dropTargetProps('unscheduled', dropOnUnscheduled)}
        >
          <Text style={styles.paneTitle}>Unscheduled</Text>
          <ScrollView contentContainerStyle={styles.paneScrollContent}>
            {unscheduledInbox.length === 0 && unscheduledTasks.length === 0 ? (
              <Text style={styles.empty}>Nothing unscheduled.</Text>
            ) : (
              <>
                {unscheduledInbox.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>INBOX</Text>
                    {unscheduledInbox.map(renderCard)}
                  </View>
                ) : null}
                {unscheduledTasks.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>TASKS</Text>
                    {unscheduledTasks.map(renderCard)}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>

        <ScrollView style={styles.timelinePane} contentContainerStyle={styles.timelineContent}>
          <View
            style={[styles.hourRow, dragOverKey === 'anytime' && styles.dropTargetActive]}
            {...dropTargetProps('anytime', (event: any) => dropOnHour(event, null))}
          >
            <Text style={styles.hourLabel}>Anytime</Text>
            <View style={styles.hourCards}>{anytimeEntries.map((e) => renderCard(e.item))}</View>
          </View>

          {HOURS.map((hour) => {
            const key = `hour-${hour}`;
            return (
              <View
                key={hour}
                style={[styles.hourRow, dragOverKey === key && styles.dropTargetActive]}
                {...dropTargetProps(key, (event: any) => dropOnHour(event, hour))}
              >
                <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
                <View style={styles.hourCards}>{(entriesByHour.get(hour) ?? []).map((e) => renderCard(e.item))}</View>
              </View>
            );
          })}
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
    cursor: 'grab',
  } as any,
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
