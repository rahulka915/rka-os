import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { TimelineSection } from '../components/TimelineSection';
import { RoninHero } from '../components/home/RoninHero';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { NextUpCard } from '../components/home/NextUpCard';
import { useHomeData, completeAllInTimeBlock } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { usePersistentTimerState } from '../hooks/usePersistentTimerState';
import { getThemeColors } from '../theme';
import { updateItemStatus, deleteItem } from '../db/database';
import { getRoninMood } from '../utils/roninMood';
import { getTimeOfDay } from '../domain/ronin/roninScenes';
import { findNextUpItem } from '../utils/nextUpItem';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning, Rahul';
  if (hour < 17) return 'Good afternoon, Rahul';
  return 'Good evening, Rahul';
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems, refresh } = useHomeData();

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) refresh();
  }, [inboxOpen, refresh]);

  const { timers } = usePersistentTimerState();
  const [completedJustNow, setCompletedJustNow] = useState(false);
  const completedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCompletedJustNow = () => {
    setCompletedJustNow(true);
    if (completedResetTimer.current) clearTimeout(completedResetTimer.current);
    completedResetTimer.current = setTimeout(() => setCompletedJustNow(false), 4000);
  };

  const overdueCount = todayItems.filter((item) => item.status === 'overdue').length;
  const hour = new Date().getHours();
  const roninMood = getRoninMood({
    isTimerRunning: timers.length > 0,
    overdueCount,
    inboxCount,
    completedJustNow,
    hour,
  });

  const activeTimerItemIds = timers.map((t) => t.med.id);
  const nextUp = findNextUpItem(todayItems, activeTimerItemIds, hour);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Ronin hero — greeting + mood, tappable through to Profile for now */}
        <View style={{ marginHorizontal: 12, marginTop: 8, borderRadius: 16, overflow: 'hidden' }}>
          <RoninHero
            mood={roninMood}
            timeOfDay={getTimeOfDay(hour)}
            greeting={greetingForHour(hour)}
            onPress={onHeroPress}
          />
        </View>

        {/* Next Up — single nearest pending item, or a calm empty state */}
        <View style={{ marginHorizontal: 12, marginTop: 12 }}>
          <NextUpCard
            result={nextUp}
            isDark={isDark}
            timeOfDay={getTimeOfDay(hour)}
            onAction={(result) => {
              console.log('Next Up action for:', result.id, result.actionLabel);
            }}
          />
        </View>

        {/* Contextual unattended-matters status */}
        <View style={{ marginHorizontal: 12, marginTop: 12 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today timeline */}
        <YStack marginTop="$5">
          <TimelineSection
            todayItems={todayItems}
            anytime={anytime}
            morning={morningItems}
            afternoon={afternoonItems}
            evening={eveningItems}
            onItemTap={(item) => {
              console.log('Navigate to item:', item.id);
            }}
            onItemComplete={(id) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateItemStatus(id, 'active');
              refresh();
            }}
            onItemArchive={(id) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateItemStatus(id, 'archived');
              refresh();
            }}
            onItemDelete={(id) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteItem(id);
              refresh();
            }}
            onTimeBlockAction={(block, action) => {
              if (action === 'completeAll') {
                const blockName = block.charAt(0).toUpperCase() + block.slice(1);
                Alert.alert(
                  'Complete All',
                  `Complete all items in ${blockName}?`,
                  [
                    { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                    {
                      text: 'Complete',
                      onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        completeAllInTimeBlock(block as 'anytime' | 'morning' | 'afternoon' | 'evening');
                        flashCompletedJustNow();
                        refresh();
                      },
                    },
                  ]
                );
              } else if (action === 'quickAdd') {
                console.log('Quick add for:', block);
              } else if (action === 'addItem') {
                console.log('Add item to:', block);
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
              }
            }}
          />
        </YStack>

      </ScrollView>
    </YStack>
  );
}

