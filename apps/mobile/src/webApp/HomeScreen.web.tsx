import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Plus } from 'lucide-react-native';
import { useHomeData, useCompletedItems } from '../hooks/useDb';
import { updateItemStatus, createItem, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { WeatherWidget } from './WeatherWidget';
import { MedicationQuickLogWidget } from './MedicationQuickLogWidget';
import { PlanBackwardsCountdownWidget } from './PlanBackwardsCountdownWidget';
import { HabitsQuickLogWidget } from './HabitsQuickLogWidget';
import { PotentialRing, computeDomains, readFocus } from './PotentialOverview';
import { webColors, webSpacing, webRadius, webFontSize, webSunset, webDepth } from '../theme/webTheme';
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
  const [overall, setOverall] = useState(0);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);

  useEffect(() => {
    const { overall: nextOverall } = computeDomains();
    setOverall(nextOverall);
    setFocusLabel(readFocus()?.label ?? null);
  }, []);

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

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={[webSunset.skyTop, webSunset.skyMid, webSunset.rose, webSunset.shell]}
          locations={[0, 0.45, 0.75, 1]}
          style={styles.hero}
        >
          <View style={styles.sun} />
          {/* Rive sunset scene mounts here — this stage is sized/toned to host it. */}
          <View style={styles.heroText}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.heroDate}>{dateLabel}</Text>
          </View>
        </LinearGradient>

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

        <View style={[styles.progressionStrip, webDepth.list]}>
          <PotentialRing value={overall} size={44} valueFontSize={12} labelFontSize={0} />
          <View style={styles.progressionCopy}>
            <Text style={styles.progressionEyebrow}>OVERALL POTENTIAL</Text>
            <Text style={styles.progressionFocus} numberOfLines={1}>
              {focusLabel ? `Current focus: ${focusLabel}` : 'No focus set'}
            </Text>
          </View>
        </View>

        <View style={styles.widgetRow}>
          <MedicationQuickLogWidget />
          <WeatherWidget />
          <HabitsQuickLogWidget />
          <PlanBackwardsCountdownWidget />
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
  hero: {
    height: 260,
    borderRadius: webRadius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: webSpacing[5],
  },
  sun: {
    position: 'absolute',
    top: 28,
    left: 40,
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: webSunset.sun,
    opacity: 0.9,
  },
  heroText: {
    gap: 2,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FBF3E6',
    textShadowColor: 'rgba(40,20,10,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroDate: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: 'rgba(251,243,230,0.82)',
    textShadowColor: 'rgba(40,20,10,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: webColors.card,
    padding: webSpacing[4],
    ...webDepth.card,
    borderRadius: webRadius.lg,
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
  progressionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    padding: webSpacing[3],
  },
  progressionCopy: {
    flex: 1,
    gap: 2,
  },
  progressionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: webColors.mutedForeground,
  },
  progressionFocus: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  widgetRow: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  section: {
    gap: webSpacing[3],
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
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[4],
    ...webDepth.list,
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
