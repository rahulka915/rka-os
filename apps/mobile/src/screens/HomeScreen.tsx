import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
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
import { getBlockingTask, updateItemStatus } from '../db/database';
import { LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import type { Item } from '../db/types';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
  onViewUpcoming: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress, onViewUpcoming }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const { habits: todayHabits, refresh: refreshHabits } = useTodayHabits();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
      refreshHabits();
    }
  }, [inboxOpen, refresh, refreshUpcoming, refreshHabits]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
    refreshHabits();
  }, [composerRevision, refresh, refreshUpcoming, refreshHabits]);

  // Belt-and-suspenders: some write paths (e.g. HabitsScreen's own
  // quick-create) don't go through the shared item-composer flow, so they
  // never bump composerRevision — refreshing on every return to this tab
  // catches those instead of leaving Home showing stale data.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshUpcoming();
      refreshHabits();
    }, [refresh, refreshUpcoming, refreshHabits]),
  );

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

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onProfilePress={onHeroPress}
        onSettingsPress={onSettingsPress}
      />

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View>

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

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
