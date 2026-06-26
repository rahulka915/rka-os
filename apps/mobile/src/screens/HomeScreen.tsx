import { ScrollView, View, Alert, StyleSheet, TouchableOpacity, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { TimelineSection } from '../components/TimelineSection';
import { HeroSection } from '../components/hero/HeroSection';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { useHomeData, completeAllInTimeBlock } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { updateItemStatus, deleteItem } from '../db/database';

export function HomeScreen({ onInboxPress }: { onInboxPress: () => void }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems, refresh } = useHomeData();

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* 1. Animated Hero */}
        <View style={{ marginHorizontal: 12, marginTop: 10, height: 200, borderRadius: 16, overflow: 'hidden' }}>
          <HeroSection timeOfDay="day" />
        </View>

        {/* 2. Practice cards — empty placeholders */}
        <View style={s.practicesContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <TouchableOpacity key={i} style={[s.practiceCard, { backgroundColor: palette.fill, borderColor: palette.separator }]} activeOpacity={0.6} />
          ))}
        </View>

        {/* 3. Inbox scroll card */}
        <View style={{ marginHorizontal: 12, marginTop: 12 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* 4. Today timeline */}
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

const s = StyleSheet.create({
  practicesContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  practiceCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceIcon: {
    fontSize: 28,
  },
});
