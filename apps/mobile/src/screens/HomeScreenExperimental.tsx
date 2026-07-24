import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { useHomeData } from '../hooks/useDb';
import { useItemComposer } from '../components/item-composer';
import type { Item } from '../db/types';

const HOUR_HEIGHT = 60;
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 23;

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

// Deliberately not using the app's theme tokens (getThemeColors), custom fonts, or
// component library (RiverStoneSurface etc.) — true visual reset, built up from workflow
// rather than inheriting the existing app's design language. Only dark/light background
// awareness is kept, everything else is plain system defaults.
export function HomeScreenExperimental() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { todayItems, refresh } = useHomeData();
  const { openEditorForItem } = useItemComposer();

  const bg = isDark ? '#000000' : '#ffffff';
  const fg = isDark ? '#ffffff' : '#000000';
  const dim = isDark ? '#888888' : '#666666';
  const line = isDark ? '#333333' : '#dddddd';

  const openItem = (item: Item) => {
    openEditorForItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  };

  const needsDoing = todayItems.filter(isNeedsDoing);
  const timelineItems = todayItems
    .map((item) => ({ item, minutes: scheduledMinutes(item) }))
    .filter((entry): entry is { item: Item; minutes: number } => entry.minutes != null);

  const hours = [];
  for (let hour = TIMELINE_START_HOUR; hour <= TIMELINE_END_HOUR; hour++) {
    hours.push(hour);
  }
  const timelineHeight = hours.length * HOUR_HEIGHT;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionLabel, { color: dim }]}>NEEDS DOING</Text>
        {needsDoing.length === 0 ? (
          <Text style={[styles.emptyText, { color: dim }]}>Nothing urgent.</Text>
        ) : (
          needsDoing.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.needsRow, { borderBottomColor: line }]}
              onPress={() => openItem(item)}
            >
              <Text style={[styles.needsTitle, { color: fg }]} numberOfLines={1}>
                {item.title}
              </Text>
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
          {timelineItems.map(({ item, minutes }) => {
            const offsetMinutes = minutes - TIMELINE_START_HOUR * 60;
            const top = (offsetMinutes / 60) * HOUR_HEIGHT;
            if (top < 0 || top > timelineHeight) return null;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.timelineItem, { top, backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}
                onPress={() => openItem(item)}
              >
                <Text style={[styles.timelineItemText, { color: fg }]} numberOfLines={1}>
                  {item.title}
                </Text>
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
  needsRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  needsTitle: {
    fontSize: 16,
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
  timelineItem: {
    position: 'absolute',
    left: 8,
    right: 8,
    minHeight: 28,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timelineItemText: {
    fontSize: 13,
  },
});
