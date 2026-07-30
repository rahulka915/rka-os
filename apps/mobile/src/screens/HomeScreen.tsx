import { useEffect } from 'react';
import { View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const { inboxCount, refresh } = useHomeData();

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

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
