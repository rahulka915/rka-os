import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { MedicationQuickLogWidget } from '../components/home/MedicationQuickLogWidget';
import { TodayCard } from '../components/home/TodayCard';
import { HabitsWidget } from '../components/home/HabitsWidget';
import { useHomeData, useUpcomingPreview, useTodayHabits } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import { getBlockingTask, updateItemStatus, getUpcomingItems, getItemsByStatus, getCompletedItems, formatDate } from '../db/database';
import { LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onSettingsPress: () => void;
  onViewUpcoming: () => void;
}

type HomeView = 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

const VIEW_CHIPS: Array<{ key: HomeView; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'anytime', label: 'Anytime' },
  { key: 'someday', label: 'Someday' },
  { key: 'logbook', label: 'Logbook' },
];

function formatRelativeDate(dateStr: string): string {
  const today = formatDate(new Date());
  if (dateStr === today) return 'Today';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function HomeScreen({ onInboxPress, inboxOpen, onSettingsPress, onViewUpcoming }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const { habits: todayHabits, refresh: refreshHabits } = useTodayHabits();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<HomeView>('today');
  const [upcomingItems, setUpcomingItems] = useState<Item[]>([]);
  const [anytimeItems, setAnytimeItems] = useState<Item[]>([]);
  const [somedayItems, setSomedayItems] = useState<Item[]>([]);
  const [logbookItems, setLogbookItems] = useState<Item[]>([]);

  const refreshViewLists = useCallback(() => {
    setUpcomingItems(getUpcomingItems(formatDate(new Date())));
    setAnytimeItems(getItemsByStatus('active').filter((item) => !item.scheduledDate));
    setSomedayItems(getItemsByStatus('someday'));
    setLogbookItems(getCompletedItems());
  }, []);

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
      refreshHabits();
      refreshViewLists();
    }
  }, [inboxOpen, refresh, refreshUpcoming, refreshHabits, refreshViewLists]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
    refreshHabits();
    refreshViewLists();
  }, [composerRevision, refresh, refreshUpcoming, refreshHabits, refreshViewLists]);

  // Belt-and-suspenders: some write paths (e.g. HabitsScreen's own
  // quick-create) don't go through the shared item-composer flow, so they
  // never bump composerRevision — refreshing on every return to this tab
  // catches those instead of leaving Home showing stale data.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshUpcoming();
      refreshHabits();
      refreshViewLists();
    }, [refresh, refreshUpcoming, refreshHabits, refreshViewLists]),
  );

  // Each of the 4 new lists is otherwise only refetched on save/focus (above) —
  // also refetch when the switcher lands on one, so a tab you haven't visited
  // since the last change doesn't show stale data.
  useEffect(() => {
    refreshViewLists();
  }, [activeView, refreshViewLists]);

  const handleItemComplete = useCallback((item: Item) => {
    if (completingIds.has(item.id)) return;
    const blocker = getBlockingTask(item.id);
    if (blocker) {
      Alert.alert('Blocked', `Complete "${blocker.title}" first.`, [{ text: 'OK' }]);
      return;
    }
    setCompletingIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'completed');
      refresh();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  }, [completingIds, refresh]);

  const handleItemTap = useCallback((item: Item) => {
    openItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  }, [openItem, refresh]);

  const renderSimpleRow = (item: Item, subtitle: string) => (
    <TouchableOpacity
      key={item.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.surface,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
      }}
      onPress={() => handleItemTap(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
          {item.title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const chipActiveBg = isDark ? '#2c2c2e' : '#e5e5ea';

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onSettingsPress={onSettingsPress}
        onInboxPress={onInboxPress}
        inboxCount={inboxCount}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 }}
      >
        {VIEW_CHIPS.map((chip) => {
          const isActive = activeView === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={{
                flexShrink: 0,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: isActive ? chipActiveBg : 'transparent',
              }}
              onPress={() => setActiveView(chip.key)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? palette.text : palette.textSecondary }}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View>

        {activeView === 'today' && (
        <>
        {/* Quick actions: Inbox + Medication logging */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <InboxScrollCard
              inboxCount={inboxCount}
              onPress={onInboxPress}
              isDark={isDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MedicationQuickLogWidget isDark={isDark} />
          </View>
        </View>

        {/* Habits */}
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        {/* Today */}
        <TodayCard
          items={todayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          upcomingGroups={upcomingGroups}
          onViewUpcoming={onViewUpcoming}
          isDark={isDark}
        />
        </>
        )}

        {activeView !== 'today' && (
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          {activeView === 'upcoming' && (
            upcomingItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing upcoming.</Text>
            ) : (
              upcomingItems.map((item) => renderSimpleRow(item, item.scheduledDate ? formatRelativeDate(item.scheduledDate) : ''))
            )
          )}

          {activeView === 'anytime' && (
            anytimeItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing here.</Text>
            ) : (
              anytimeItems.map((item) => renderSimpleRow(item, item.type))
            )
          )}

          {activeView === 'someday' && (
            somedayItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing filed for someday.</Text>
            ) : (
              somedayItems.map((item) => renderSimpleRow(item, item.type))
            )
          )}

          {activeView === 'logbook' && (
            logbookItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing completed yet.</Text>
            ) : (
              logbookItems.map((item) => renderSimpleRow(item, item.completedAt ? new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''))
            )
          )}
        </View>
        )}

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
