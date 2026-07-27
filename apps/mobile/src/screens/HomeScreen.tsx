import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Alert, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { getThemeColors, getUsableContentHeight } from '../theme';
import { updateItemStatus, deleteItem, getBlockingTask } from '../db/database';
import { getRoninStatus } from '../utils/roninMood';
import { getTimeOfDay } from '../domain/ronin/roninScenes';
import { getRoninGreetingWord } from '../domain/ronin/roninGreeting';
import { findNextUpItem } from '../utils/nextUpItem';
import { NATURAL_ROW_HEIGHT, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, TIMELINE_ROW_COUNT } from '../components/TimelineSection';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import type { Item } from '../db/types';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openCapture, revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems, refresh } = useHomeData();

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
  const { mood: roninMood, statusLine } = getRoninStatus({
    isTimerRunning: timers.length > 0,
    overdueCount,
    inboxCount,
    completedJustNow,
    hour,
  });
  const timeOfDay = getTimeOfDay(hour);
  const completedToday = todayItems.filter((item) => item.status === 'completed').length;

  const activeTimerItemIds = timers.map((t) => t.med.id);
  const nextUp = findNextUpItem(todayItems, activeTimerItemIds, hour);

  // Fit the whole page (hero, cards, collapsed timeline) into the space
  // between the header and the floating tab tray on any device — growing
  // the timeline's 4 rows (and their icons) to use leftover space when the
  // natural layout is shorter than the screen, or shrinking them when it
  // overflows. The hero card's height isn't computable up front (its
  // content — greeting text, mood glow — varies), so this measures the ONE
  // natural render once and distributes the difference across the 4 rows.
  // Only the first onLayout call is used (measuredHeight stays fixed after
  // that) so this settles in a single adjustment rather than oscillating
  // as the rows themselves change size.
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const usableHeight = getUsableContentHeight(screenHeight, insets.top, insets.bottom);
  const [measuredContentHeight, setMeasuredContentHeight] = useState<number | null>(null);
  const onContentLayout = (e: LayoutChangeEvent) => {
    // Read the height synchronously — RN reuses/nullifies the synthetic
    // event after this handler returns, so it can't be read lazily inside
    // the setState updater callback below (that ran fine on the JS thread
    // during development but throws "Cannot read property 'layout' of
    // null" once the event has actually been released by the time React
    // invokes the updater).
    const height = e.nativeEvent.layout.height;
    setMeasuredContentHeight((prev) => (prev === null ? height : prev));
  };

  let rowHeight: number | undefined;
  if (measuredContentHeight !== null) {
    // Positive = spare room to grow into, negative = overflow to shrink out of.
    const diff = usableHeight - measuredContentHeight;
    if (Math.abs(diff) > 1) {
      rowHeight = Math.min(
        MAX_ROW_HEIGHT,
        Math.max(MIN_ROW_HEIGHT, NATURAL_ROW_HEIGHT + diff / TIMELINE_ROW_COUNT)
      );
    }
  }

  // Stable identities are load-bearing, not a micro-optimisation: these are
  // passed down to the memoised timeline rows, and usePersistentTimerState
  // re-renders this screen once a second (unconditionally, even with no active
  // timer). Recreated inline, they broke every row's memo on every tick —
  // which meant rows re-rendered and re-measured mid-drag, and that is what
  // made reordering on Home feel unsteady.
  const handleItemTap = useCallback((item: Item) => {
    openItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  }, [openItem, refresh]);

  const handleItemComplete = useCallback((id: string) => {
    const blocker = getBlockingTask(id);
    if (blocker) {
      Alert.alert('Blocked', `Complete "${blocker.title}" first.`, [{ text: 'OK' }]);
      return;
    }
    updateItemStatus(id, 'completed');
    refresh();
  }, [refresh]);

  const handleItemActivate = useCallback((id: string) => {
    updateItemStatus(id, 'active');
    refresh();
  }, [refresh]);

  const handleItemArchive = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateItemStatus(id, 'archived');
    refresh();
  }, [refresh]);

  const handleItemDelete = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteItem(id);
    refresh();
  }, [refresh]);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onProfilePress={onHeroPress}
        onSettingsPress={onSettingsPress}
      />

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View onLayout={onContentLayout}>

        {/* Ronin hero — greeting + mood, tappable through to Profile for now.
            No borderRadius/overflow here — RiverStoneSurface (inside
            RoninGreetingCard) owns its own shape and needs its outer shadow
            to render past the card bounds, not get clipped by this wrapper. */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <RoninHero
            mood={roninMood}
            timeOfDay={timeOfDay}
            greetingWord={getRoninGreetingWord(timeOfDay)}
            name="Rahul"
            statusLine={statusLine}
            completedCount={completedToday}
            totalCount={todayItems.length}
            inboxCount={inboxCount}
            focusActive={timers.length > 0}
            onPress={onHeroPress}
          />
        </View>

        {/* Next Up + Inbox — side by side, both square, splitting the row */}
        <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 12, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <NextUpCard
              result={nextUp}
              isDark={isDark}
              timeOfDay={timeOfDay}
              onAction={(result) => {
                const item = todayItems.find((candidate) => candidate.id === result.id);
                if (!item) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openItem({
                  item,
                  onComplete: ({ action }) => {
                    if (action !== 'cancelled') refresh();
                  },
                });
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <InboxScrollCard
              inboxCount={inboxCount}
              onPress={onInboxPress}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Today timeline */}
        <YStack marginTop="$2">
          <TimelineSection
            todayItems={todayItems}
            anytime={anytime}
            morning={morningItems}
            afternoon={afternoonItems}
            evening={eveningItems}
            rowHeight={rowHeight}
            onItemTap={handleItemTap}
            onItemComplete={handleItemComplete}
            onItemActivate={handleItemActivate}
            onItemArchive={handleItemArchive}
            onItemDelete={handleItemDelete}
            onDependencyChanged={refresh}
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
              } else if (action === 'quickAdd' || action === 'addItem') {
                openCapture({
                  context: { status: 'active', preferredTimeBucket: block },
                  onComplete: ({ action: completionAction }) => {
                    if (completionAction === 'saved') refresh();
                  },
                });
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
              }
            }}
          />
        </YStack>

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
