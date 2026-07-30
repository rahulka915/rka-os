import { useCallback, useEffect, useState } from 'react';
import { View, Alert, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { TimelineSection } from '../components/TimelineSection';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { useHomeData, completeAllInTimeBlock } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getUsableContentHeight } from '../theme';
import { updateItemStatus, deleteItem, getBlockingTask } from '../db/database';
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

  // Fit the whole page (cards, collapsed timeline) into the space
  // between the header and the floating tab tray on any device — growing
  // the timeline's 4 rows (and their icons) to use leftover space when the
  // natural layout is shorter than the screen, or shrinking them when it
  // overflows. This measures the ONE natural render once and distributes
  // the difference across the 4 rows. Only the first onLayout call is used
  // (measuredHeight stays fixed after that) so this settles in a single
  // adjustment rather than oscillating as the rows themselves change size.
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
  // passed down to the memoised timeline rows. Recreated inline, they broke
  // every row's memo on every tick — which meant rows re-rendered and
  // re-measured mid-drag, and that is what made reordering on Home feel
  // unsteady.
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

        {/* Inbox preview */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
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
