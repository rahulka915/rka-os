import { ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { YStack, XStack, Text, View } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { AvatarCompanion } from '../components/AvatarCompanion';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { Clock, Sun, Sunset, Moon, ArrowRight, Inbox } from '../icons';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5)  return { word: 'Late Night', name: 'Rahul' };
  if (hour < 12) return { word: 'Good Morning', name: 'Rahul' };
  if (hour < 17) return { word: 'Good Afternoon', name: 'Rahul' };
  return { word: 'Good Evening', name: 'Rahul' };
}

function getHeroColors(isDark: boolean): [string, string, string] {
  const h = new Date().getHours();
  if (isDark) {
    if (h < 6)  return ['#0d0d1a', '#0d1a2e', '#0d2240'];
    if (h < 12) return ['#1a100a', '#2a1a0a', '#3a2510'];
    if (h < 17) return ['#0d0d2a', '#1a0d2e', '#200a38'];
    return ['#050d1a', '#0a1a1a', '#0a2020'];
  }
  if (h < 6)  return ['#1a1a2e', '#16213e', '#0f3460'];
  if (h < 12) return ['#ffd89b', '#ff9a44', '#f7685b'];
  if (h < 17) return ['#667eea', '#764ba2', '#f093fb'];
  return ['#2d1b69', '#11998e', '#38ef7d'];
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

interface TimeBlockRowProps {
  label: string;
  icon: any;
  count: number;
  color: string;
  bgColor: string;
}

function TimeBlockRow({ label, icon: Icon, count, color, bgColor }: TimeBlockRowProps) {
  return (
    <XStack
      alignItems="center" gap="$3"
      paddingVertical="$3" paddingHorizontal="$4"
      backgroundColor="$surface" borderRadius="$3" marginBottom="$2"
      shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={1} shadowRadius={6} elevation={1}
    >
      <View
        width={32} height={32} borderRadius="$6"
        backgroundColor={bgColor as any}
        alignItems="center" justifyContent="center"
      >
        <Icon size={15} color={color} strokeWidth={1.5} />
      </View>
      <Text flex={1} fontSize="$2" fontWeight="700" color="$text" style={{ letterSpacing: 0.3 }}>
        {label}
      </Text>
      <XStack alignItems="center" gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$textSecondary">{count}</Text>
        <ArrowRight size={12} color="rgba(13,13,13,0.28)" strokeWidth={2} />
      </XStack>
    </XStack>
  );
}

export function HomeScreen({ onInboxPress }: { onInboxPress: () => void }) {
  const { isDark } = useThemeContext();
  const { inboxCount, upcomingCount, todayItems, anytime, morningItems, afternoonItems, eveningItems } = useHomeData();
  const { word, name } = getGreeting();
  const hour = new Date().getHours();
  const heroColors = getHeroColors(isDark);
  const companionMsg = getCompanionMessage(inboxCount, todayItems.length, hour);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero gradient */}
        <LinearGradient
          colors={heroColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 24, padding: 24, minHeight: 160 }}
        >
          <Text
            fontSize={11} fontWeight="700"
            color="rgba(255,255,255,0.6)"
            style={{ letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}
          >
            {word}
          </Text>
          <Text fontSize={32} fontWeight="800" color="white" style={{ letterSpacing: -0.5 }}>
            {name}
          </Text>

          {/* Stats row */}
          <XStack gap="$4" marginTop="$4" alignItems="center">
            {[
              { val: todayItems.length, label: 'Today' },
              { val: upcomingCount, label: 'Active' },
              { val: inboxCount, label: 'Inbox' },
            ].map(({ val, label }, i) => (
              <XStack key={label} alignItems="center" gap="$4">
                {i > 0 && <View width={1} height={28} backgroundColor="rgba(255,255,255,0.18)" />}
                <YStack>
                  <Text fontSize={26} fontWeight="800" color="white">{val}</Text>
                  <Text fontSize={10} color="rgba(255,255,255,0.6)" fontWeight="600" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {label}
                  </Text>
                </YStack>
              </XStack>
            ))}
          </XStack>
        </LinearGradient>

        {/* ── Avatar Companion ─────────────────────────────────── */}
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
            {/* Speech bubble feel */}
            <Text fontSize="$2" fontWeight="500" color="$text" lineHeight={20}>
              {companionMsg}
            </Text>
            <Text fontSize={11} color="$textTertiary" marginTop={4} fontWeight="500">
              Your personal OS companion
            </Text>
          </YStack>
        </XStack>

        {/* Inbox shortcut */}
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

        {/* Timeline */}
        <YStack paddingHorizontal="$4" marginTop="$5">
          <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
            <Text fontSize={11} fontWeight="700" color="$textTertiary" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Today's Timeline
            </Text>
            <Text fontSize={11} fontWeight="600" color="$blue">{todayItems.length} items</Text>
          </XStack>

          <TimeBlockRow label="Anytime"   icon={Clock}   count={anytime.length}       color="#007aff" bgColor="rgba(0,122,255,0.10)"   />
          <TimeBlockRow label="Morning"   icon={Sun}     count={morningItems.length}   color="#ff8c42" bgColor="rgba(255,140,66,0.12)"  />
          <TimeBlockRow label="Afternoon" icon={Sunset}  count={afternoonItems.length} color="#7c5cbf" bgColor="rgba(124,92,191,0.12)" />
          <TimeBlockRow label="Evening"   icon={Moon}    count={eveningItems.length}   color={isDark ? '#94a3b8' : '#475569'} bgColor="rgba(71,85,105,0.10)" />
        </YStack>

      </ScrollView>
    </YStack>
  );
}
