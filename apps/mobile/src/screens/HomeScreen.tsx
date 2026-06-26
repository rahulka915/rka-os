import { ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, View } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { AvatarCompanion } from '../components/AvatarCompanion';
import { TimelineSection } from '../components/TimelineSection';
import { useHomeData, completeAllInTimeBlock } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { updateItemStatus, deleteItem } from '../db/database';
import { ArrowRight, Inbox } from '../icons';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5)  return { word: 'Late Night', name: 'Rahul' };
  if (hour < 12) return { word: 'Good Morning', name: 'Rahul' };
  if (hour < 17) return { word: 'Good Afternoon', name: 'Rahul' };
  return { word: 'Good Evening', name: 'Rahul' };
}

function getCompanionMessage(inboxCount: number, todayCount: number, hour: number): string {
  if (inboxCount === 0 && todayCount === 0) {
    if (hour < 12) return "Morning clear. What are we building today?";
    if (hour < 17) return "Afternoon's yours. Nothing on the schedule.";
    return "Evening is clear. Time to wind down or plan ahead.";
  }
  if (inboxCount > 5) return `${inboxCount} things in your inbox. Let's process them.`;
  if (todayCount > 0 && inboxCount > 0) return `${todayCount} scheduled, ${inboxCount} waiting. Good momentum.`;
  if (todayCount > 0) return `${todayCount} thing${todayCount > 1 ? 's' : ''} on today's plan. Let's go.`;
  return `${inboxCount} item${inboxCount > 1 ? 's' : ''} to process in your inbox.`;
}

export function HomeScreen({ onInboxPress }: { onInboxPress: () => void }) {
  const { isDark } = useThemeContext();
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems, refresh } = useHomeData();
  const hour = new Date().getHours();
  const companionMsg = getCompanionMessage(inboxCount, todayItems.length, hour);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Companion message at top */}
        <XStack
          marginHorizontal="$4" marginTop="$3"
          backgroundColor="$surface" borderRadius="$4"
          padding="$4" alignItems="center" gap="$3"
          shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={1} shadowRadius={8} elevation={1}
          borderWidth={0.5} borderColor="$separator"
        >
          <AvatarCompanion size="md" showRing />

          <YStack flex={1}>
            <Text fontSize="$2" fontWeight="500" color="$text" lineHeight={20}>
              {companionMsg}
            </Text>
            <Text fontSize={11} color="$textTertiary" marginTop={4} fontWeight="500">
              Your personal OS companion
            </Text>
          </YStack>
        </XStack>

        {/* Inbox card */}
        <TouchableOpacity onPress={onInboxPress} activeOpacity={0.7}>
          <XStack
            marginHorizontal="$4" marginTop="$3"
            backgroundColor="$surface" borderRadius="$3" padding="$4"
            alignItems="center" gap="$3"
            borderWidth={1} borderColor={inboxCount > 0 ? '$blueSoft' : '$separator'}
            shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={1} shadowRadius={6} elevation={1}
          >
            <View width={34} height={34} borderRadius="$6" backgroundColor={inboxCount > 0 ? '$blueSoft' : '$bg'} alignItems="center" justifyContent="center">
              <Inbox size={16} color={inboxCount > 0 ? '#007aff' : '$textMuted'} strokeWidth={1.5} />
            </View>
            <YStack flex={1}>
              {inboxCount > 0 ? (
                <>
                  <Text fontSize="$3" fontWeight="700" color="$text">
                    {inboxCount} item{inboxCount > 1 ? 's' : ''} to process
                  </Text>
                  <Text fontSize="$2" color="$textSecondary">Tap to review</Text>
                </>
              ) : (
                <>
                  <Text fontSize="$3" fontWeight="700" color="$text">
                    Inbox zero
                  </Text>
                  <Text fontSize="$2" color="$textSecondary">You're all caught up! 🎉</Text>
                </>
              )}
            </YStack>
            {inboxCount > 0 && <ArrowRight size={14} color="$blue" strokeWidth={2} />}
          </XStack>
        </TouchableOpacity>

        {/* Timeline section */}
        <YStack marginTop="$4">
          <TimelineSection
            todayItems={todayItems}
            anytime={anytime}
            morning={morningItems}
            afternoon={afternoonItems}
            evening={eveningItems}
            onItemTap={(item) => {
              // TODO: Navigate to item detail/edit screen
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
                        refresh();
                      },
                    },
                  ]
                );
              } else if (action === 'quickAdd') {
                console.log('Quick add for:', block);
                // TODO: Open QuickAddScreen with timeOfDay pre-filled
              } else if (action === 'addItem') {
                console.log('Add item to:', block);
                // TODO: Open QuickAddScreen with timeOfDay pre-filled
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
                // TODO: Open move items modal
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
                // TODO: Open sort modal or implement local sorting
              }
            }}
          />
        </YStack>

      </ScrollView>
    </YStack>
  );
}
