import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { TodayCard } from '../components/home/TodayCard';
import { useHomeData } from '../hooks/useDb';
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
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) refresh();
  }, [inboxOpen, refresh]);

  useEffect(() => {
    refresh();
  }, [composerRevision, refresh]);

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

        {/* Inbox preview */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today */}
        <TodayCard
          items={todayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          isDark={isDark}
        />

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
