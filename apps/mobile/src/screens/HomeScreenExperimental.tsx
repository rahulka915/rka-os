import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { useHomeData } from '../hooks/useDb';
import { useItemComposer } from '../components/item-composer';
import { getTimelineDurationMinutes } from '../utils/timelineItem';
import { getTodayDeviceEvents, type DeviceCalendarEvent } from '../services/deviceCalendar';
import type { Item, ItemType } from '../db/types';

const HOUR_HEIGHT = 60;
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 23;
const MIN_GAP_MINUTES_TO_LABEL = 20;

// A small, plain-but-distinct palette chosen fresh for this screen — not the app's
// branded theme colors — so each item type reads as a different color at a glance,
// per the Mobbin comparison (Tiimo/Things 3 both use color/icon as the primary
// at-a-glance signal instead of relying purely on text).
const TYPE_COLORS: Record<ItemType, string> = {
  task: '#3B82F6',
  habit: '#22C55E',
  medication: '#F97316',
  project: '#A855F7',
  area: '#0EA5E9',
  'workout-template': '#EF4444',
  'workout-block': '#EF4444',
  exercise: '#EF4444',
  meal: '#EAB308',
  object: '#EC4899',
};

function typeColor(type: ItemType): string {
  return TYPE_COLORS[type] ?? '#6B7280';
}

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isNeedsDoing(item: Item): boolean {
  if (item.status === 'overdue' || item.status === 'due-today') return true;
  return parseMetadata(item).priority === 'high';
}

function scheduledMinutes(item: Item): number | null {
  const time = parseMetadata(item).time;
  if (typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

type TimelineRow =
  | { kind: 'task'; key: string; minutes: number; duration: number; item: Item }
  | { kind: 'event'; key: string; minutes: number; duration: number; event: DeviceCalendarEvent };

interface GapLabel {
  key: string;
  top: number;
  minutes: number;
}

// Tiimo-style: label the free time between items instead of leaving blank grid space,
// so "how full is my day" reads at a glance rather than requiring the hour lines to be
// mentally added up. Runs across tasks AND device calendar events together — a gap
// between a task and a real meeting is still a gap.
function computeGaps(rows: TimelineRow[]): GapLabel[] {
  const gaps: GapLabel[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const currentEnd = rows[i].minutes + rows[i].duration;
    const nextStart = rows[i + 1].minutes;
    const gapMinutes = nextStart - currentEnd;
    if (gapMinutes >= MIN_GAP_MINUTES_TO_LABEL) {
      const midpoint = currentEnd + gapMinutes / 2;
      gaps.push({
        key: `gap-${rows[i].key}`,
        top: ((midpoint - TIMELINE_START_HOUR * 60) / 60) * HOUR_HEIGHT,
        minutes: gapMinutes,
      });
    }
  }
  return gaps;
}

// Deliberately not using the app's theme tokens (getThemeColors), custom fonts, or
// component library (RiverStoneSurface etc.) — true visual reset, built up from workflow
// rather than inheriting the existing app's design language. Only dark/light background
// awareness is kept, everything else is plain system defaults (plus the fresh TYPE_COLORS
// accent palette above, added deliberately per the Mobbin comparison, not inherited).
interface HomeScreenExperimentalProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
}

export function HomeScreenExperimental({ onInboxPress, inboxOpen }: HomeScreenExperimentalProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { todayItems, inboxCount, refresh } = useHomeData();
  const { openEditorForItem, revision: composerRevision } = useItemComposer();

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a
  // child of this screen, so triaging there never triggers a refetch here on its own.
  // Same two triggers the old HomeScreen uses: refetch when the Inbox modal closes, and
  // refetch on any save anywhere in the app (composerRevision bumps on every save,
  // including a fresh FAB capture that never touches the Inbox modal at all).
  useEffect(() => {
    if (!inboxOpen) refresh();
  }, [inboxOpen, refresh]);

  useEffect(() => {
    refresh();
  }, [composerRevision, refresh]);
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const refetchEvents = () => {
      getTodayDeviceEvents().then(setDeviceEvents).catch((error) => {
        console.log('[deviceCalendar] fetch failed:', error);
        setDeviceEvents([]);
      });
    };

    refetchEvents();

    // expo-calendar has no live change-subscription API (unlike our own SQLite data,
    // which the rest of the app refreshes reactively) — refetching on foreground is the
    // practical middle ground: covers "I added an event, switched back to check," not
    // "I'm staring at this screen while adding an event in another app."
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refetchEvents();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const bg = isDark ? '#000000' : '#f5f5f5';
  const fg = isDark ? '#ffffff' : '#000000';
  const dim = isDark ? '#888888' : '#666666';
  const line = isDark ? '#333333' : '#dddddd';
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const eventCardBg = isDark ? '#141414' : '#e8e8e8';

  const openItem = (item: Item) => {
    openEditorForItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  };

  const needsDoing = todayItems.filter(isNeedsDoing);

  const taskRows: TimelineRow[] = todayItems
    .map((item) => {
      const minutes = scheduledMinutes(item);
      if (minutes == null) return null;
      return { kind: 'task' as const, key: `task-${item.id}`, item, minutes, duration: getTimelineDurationMinutes(item) };
    })
    .filter((row): row is Extract<TimelineRow, { kind: 'task' }> => row != null);

  const eventRows: TimelineRow[] = deviceEvents.map((event) => ({
    kind: 'event' as const,
    key: `event-${event.id}`,
    event,
    minutes: event.startMinutes,
    duration: event.durationMinutes,
  }));

  const timelineRows = [...taskRows, ...eventRows].sort((a, b) => a.minutes - b.minutes);
  const gaps = computeGaps(timelineRows);

  const hours = [];
  for (let hour = TIMELINE_START_HOUR; hour <= TIMELINE_END_HOUR; hour++) {
    hours.push(hour);
  }
  const timelineHeight = hours.length * HOUR_HEIGHT;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[styles.card, styles.inboxCard, { backgroundColor: cardBg, borderColor: line }]}
          onPress={onInboxPress}
        >
          <View style={styles.cardBody}>
            <Text style={[styles.inboxTitle, { color: fg }]}>Inbox</Text>
            <Text style={[styles.cardSub, { color: dim }]}>
              {inboxCount === 0 ? 'Nothing to action' : `${inboxCount} to action`}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: dim }]}>NEEDS DOING ({needsDoing.length})</Text>
        {needsDoing.length === 0 ? (
          <Text style={[styles.emptyText, { color: dim }]}>Nothing urgent.</Text>
        ) : (
          needsDoing.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, styles.needsCard, { backgroundColor: cardBg, borderColor: line }]}
              onPress={() => openItem(item)}
            >
              <View style={[styles.accentBar, { backgroundColor: typeColor(item.type) }]} />
              <View style={styles.cardBody}>
                <Text style={[styles.needsTitle, { color: fg }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSub, { color: dim }]}>
                  {formatDuration(getTimelineDurationMinutes(item))}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionLabel, { color: dim, marginTop: 24 }]}>TODAY</Text>
        <View style={[styles.timeline, { height: timelineHeight, borderColor: line }]}>
          {hours.map((hour, index) => (
            <View
              key={hour}
              style={[styles.hourRow, { top: index * HOUR_HEIGHT, borderTopColor: line }]}
            >
              <Text style={[styles.hourLabel, { color: dim }]}>{formatHour(hour)}</Text>
            </View>
          ))}
          {gaps.map((gap) => (
            <Text key={gap.key} style={[styles.gapLabel, { top: gap.top, color: dim }]}>
              {formatDuration(gap.minutes)} free
            </Text>
          ))}
          {timelineRows.map((row) => {
            const offsetMinutes = row.minutes - TIMELINE_START_HOUR * 60;
            const top = (offsetMinutes / 60) * HOUR_HEIGHT;
            const height = Math.max(28, (row.duration / 60) * HOUR_HEIGHT);
            if (top < 0 || top > timelineHeight) return null;

            // Device calendar events get a distinct muted card — no color accent, dashed
            // border — so they read as background context you're planning around, never
            // confused with your own colored task cards (matches Things 3's treatment).
            if (row.kind === 'event') {
              return (
                <View
                  key={row.key}
                  style={[
                    styles.card,
                    styles.timelineItem,
                    styles.eventCard,
                    { top, minHeight: height, backgroundColor: eventCardBg, borderColor: line },
                  ]}
                >
                  <View style={styles.cardBody}>
                    <Text style={[styles.timelineItemText, { color: dim }]} numberOfLines={1}>
                      {row.event.title}
                    </Text>
                    <Text style={[styles.cardSub, { color: dim }]}>{formatDuration(row.duration)}</Text>
                  </View>
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.card,
                  styles.timelineItem,
                  { top, minHeight: height, backgroundColor: cardBg, borderColor: line },
                ]}
                onPress={() => openItem(row.item)}
              >
                <View style={[styles.accentBar, { backgroundColor: typeColor(row.item.type) }]} />
                <View style={styles.cardBody}>
                  <Text style={[styles.timelineItemText, { color: fg }]} numberOfLines={1}>
                    {row.item.title}
                  </Text>
                  <Text style={[styles.cardSub, { color: dim }]}>{formatDuration(row.duration)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  card: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  needsCard: {
    marginBottom: 8,
  },
  inboxCard: {
    marginBottom: 20,
  },
  inboxTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventCard: {
    borderStyle: 'dashed',
  },
  accentBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  needsTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  timeline: {
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  hourRow: {
    position: 'absolute',
    left: -52,
    width: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hourLabel: {
    fontSize: 11,
    paddingTop: 2,
  },
  gapLabel: {
    position: 'absolute',
    left: 8,
    fontSize: 11,
    fontStyle: 'italic',
  },
  timelineItem: {
    position: 'absolute',
    left: 8,
    right: 8,
  },
  timelineItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
