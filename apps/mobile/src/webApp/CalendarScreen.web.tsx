import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCalendar } from '../hooks/useDb';
import { createTimedItem, updateItemStatus, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return formatDate(date);
}

function dateLabelFor(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function CalendarScreen() {
  const [viewedDate, setViewedDate] = useState(() => formatDate(new Date()));
  const { timelineEntries, refresh } = useCalendar(viewedDate);
  const [titleText, setTitleText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = formatDate(new Date());
  const isToday = viewedDate === today;
  const selectedEntry = timelineEntries.find((e) => e.item.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = titleText.trim();
    if (!trimmed) return;
    createTimedItem('task', trimmed, viewedDate, timeText.trim() || '09:00');
    setTitleText('');
    setTimeText('');
    refresh();
  };

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
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
            value={titleText}
            onChangeText={setTitleText}
            onSubmitEditing={submit}
            placeholder={`Schedule for ${dateLabelFor(viewedDate)}...`}
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureTitleInput}
          />
          <TextInput
            value={timeText}
            onChangeText={setTimeText}
            onSubmitEditing={submit}
            placeholder="09:00"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureTimeInput}
          />
        </View>

        {timelineEntries.length === 0 ? (
          <Text style={styles.empty}>Nothing scheduled for this day.</Text>
        ) : (
          <FlatList
            data={timelineEntries}
            keyExtractor={(entry) => entry.item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: entry }) => {
              const completed = entry.item.status === 'completed';
              return (
                <Pressable style={styles.row} onPress={() => setSelectedId(entry.item.id)}>
                  <Text style={styles.timeLabel}>{entry.time ?? 'Anytime'}</Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleComplete(entry.item);
                    }}
                    style={[styles.checkbox, completed && styles.checkboxDone]}
                  >
                    {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                  </Pressable>
                  <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                    {entry.item.title}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <DetailPanel visible={!!selectedEntry} onClose={() => setSelectedId(null)} title="Item">
        {selectedEntry ? (
          <ItemDetailForm
            item={selectedEntry.item}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
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
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[4],
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  captureTitleInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureTimeInput: {
    width: 90,
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    textAlign: 'center',
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  listContent: {
    gap: webSpacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  timeLabel: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    width: 56,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
