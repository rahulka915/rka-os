import { ScrollView, TouchableOpacity } from 'react-native';
import { YStack, XStack, Text, View } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { AvatarCompanion } from '../components/AvatarCompanion';
import { TimelineSection } from '../components/TimelineSection';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
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
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems } = useHomeData();
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
        {inboxCount > 0 && (
          <TouchableOpacity onPress={onInboxPress} activeOpacity={0.7}>
            <XStack
              marginHorizontal="$4" marginTop="$3"
              backgroundColor="$surface" borderRadius="$3" padding="$4"
              alignItems="center" gap="$3"
              borderWidth={1} borderColor="$blueSoft"
              shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={1} shadowRadius={6} elevation={1}
            >
              <View width={34} height={34} borderRadius="$6" backgroundColor="$blueSoft" alignItems="center" justifyContent="center">
                <Inbox size={16} color="#007aff" strokeWidth={1.5} />
              </View>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="700" color="$text">
                  {inboxCount} item{inboxCount > 1 ? 's' : ''} to process
                </Text>
                <Text fontSize="$2" color="$textSecondary">Tap to review</Text>
              </YStack>
              <ArrowRight size={14} color="$blue" strokeWidth={2} />
            </XStack>
          </TouchableOpacity>
        )}

        {/* Timeline section */}
        <YStack marginTop="$4">
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
              console.log('Complete item:', id);
            }}
            onItemArchive={(id) => {
              console.log('Archive item:', id);
            }}
            onItemDelete={(id) => {
              console.log('Delete item:', id);
            }}
            onTimeBlockAction={(block, action) => {
              console.log(`Time block ${block} action: ${action}`);
            }}
          />
        </YStack>

      </ScrollView>
    </YStack>
  );
}
