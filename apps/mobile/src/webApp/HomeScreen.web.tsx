import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useHomeData, useCompletedItems } from '../hooks/useDb';
import { updateItemStatus, createItem, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

const BUCKETS: Array<{ key: 'morningItems' | 'afternoonItems' | 'eveningItems' | 'anytime'; label: string }> = [
  { key: 'morningItems', label: 'MORNING' },
  { key: 'afternoonItems', label: 'AFTERNOON' },
  { key: 'eveningItems', label: 'EVENING' },
  { key: 'anytime', label: 'ANYTIME' },
];

function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HomeScreen() {
  const { anytime, morningItems, afternoonItems, eveningItems, inboxCount, upcomingCount, refresh } = useHomeData();
  const { items: completedItems, refresh: refreshCompleted } = useCompletedItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');

  const buckets = { morningItems, afternoonItems, eveningItems, anytime };
  const todayCount = morningItems.length + afternoonItems.length + eveningItems.length + anytime.length;
  const today = formatDate(new Date());
  const completedTodayCount = completedItems.filter(
    (item) => item.completedAt != null && formatDate(new Date(item.completedAt)) === today
  ).length;

  const allTodayItems = [...morningItems, ...afternoonItems, ...eveningItems, ...anytime];
  const selectedItem = allTodayItems.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
    refreshCompleted();
  };

  const submitCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('task', trimmed);
    setCaptureText('');
    refresh();
  };

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Inbox" value={inboxCount} />
          <StatCard label="Today" value={todayCount} />
          <StatCard label="Upcoming" value={upcomingCount} />
          <StatCard label="Completed today" value={completedTodayCount} />
        </View>

        <View style={styles.captureRow}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
          <TextInput
            value={captureText}
            onChangeText={setCaptureText}
            onSubmitEditing={submitCapture}
            placeholder="Add to inbox..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInput}
          />
        </View>

        {todayCount === 0 ? (
          <Text style={styles.empty}>Nothing scheduled for today.</Text>
        ) : (
          BUCKETS.map(({ key, label }) => {
            const bucketItems = buckets[key];
            if (bucketItems.length === 0) return null;
            return (
              <View key={key} style={styles.section}>
                <Text style={styles.sectionLabel}>{label}</Text>
                {bucketItems.map((item) => {
                  const completed = item.status === 'completed';
                  return (
                    <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleComplete(item);
                        }}
                        style={[styles.checkbox, completed && styles.checkboxDone]}
                      >
                        {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                      </Pressable>
                      <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}

        {completedItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENTLY COMPLETED</Text>
            {completedItems.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.completedRow}>
                <Check size={13} color={webColors.accent} strokeWidth={2.5} />
                <Text style={styles.completedTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.completedTime}>
                  {item.completedAt != null ? relativeTime(item.completedAt) : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Task">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={() => {
              refresh();
              refreshCompleted();
            }}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
              refreshCompleted();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    paddingBottom: webSpacing[8],
    gap: webSpacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  dateLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  statsRow: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[4],
  },
  statValue: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  statLabel: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginTop: webSpacing[1],
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  section: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
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
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  completedTitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    flex: 1,
  },
  completedTime: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
});
