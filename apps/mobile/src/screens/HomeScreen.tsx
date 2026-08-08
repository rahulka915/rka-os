import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AppHeader } from '../components/AppHeader';
import { RiverStoneSurface } from '../components/riverstone';
import { MedicationQuickLogWidget } from '../components/home/MedicationQuickLogWidget';
import { TodayCard } from '../components/home/TodayCard';
import { HabitsWidget } from '../components/home/HabitsWidget';
import { HomeTaskRow } from '../components/home/HomeTaskRow';
import { RoninJourneyPrototype } from '../components/home/RoninJourneyPrototype';
import { JourneySummaryStrip } from '../components/home/JourneySummaryStrip';
import { useHomeData, useUpcomingPreview, useTodayHabits, useProjects } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import {
  getBlockingTask,
  updateItemStatus,
  getUpcomingItems,
  getItemsByType,
  getCompletedItems,
  getRelation,
  deleteItem,
  formatDate,
  computeOverallPotential,
  getFocus,
} from '../db/database';
import { LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { getThemeColors } from '../theme';
import { showActionSheet } from '../utils/actionSheet';
import { groupByScheduledDate } from '../utils/upcomingGrouping';
import type { Item } from '../db/types';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onSettingsPress: () => void;
  onViewUpcoming: () => void;
}

type HomeView = 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

const VIEW_CHIPS: Array<{ key: HomeView; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'anytime', label: 'Anytime' },
  { key: 'someday', label: 'Someday' },
  { key: 'logbook', label: 'Logbook' },
];

export function HomeScreen({ onInboxPress, inboxOpen, onSettingsPress, onViewUpcoming }: HomeScreenProps) {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const { habits: todayHabits, refresh: refreshHabits } = useTodayHabits();
  const { projects } = useProjects();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<HomeView>('today');
  const [upcomingItems, setUpcomingItems] = useState<Item[]>([]);
  const [anytimeItems, setAnytimeItems] = useState<Item[]>([]);
  const [somedayItems, setSomedayItems] = useState<Item[]>([]);
  const [logbookItems, setLogbookItems] = useState<Item[]>([]);
  const [potentialPercent, setPotentialPercent] = useState(0);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);

  // Anytime/Upcoming/Someday are task-only (matching the dedicated Tasks/
  // Upcoming screens and GTD convention) — Domains/Missions/Habits/Workouts
  // have their own dedicated places in the app, not mixed into these lists.
  const refreshViewLists = useCallback(() => {
    const today = formatDate(new Date());
    const tasks = getItemsByType('task');
    setUpcomingItems(getUpcomingItems(today).filter((item) => item.type === 'task'));
    setAnytimeItems(tasks.filter((item) => item.status === 'active' && !item.scheduledDate));
    setSomedayItems(tasks.filter((item) => item.status === 'someday'));
    setLogbookItems(getCompletedItems());
    setPotentialPercent(computeOverallPotential());
    setFocusLabel(getFocus()?.label ?? null);
  }, []);

  const getProjectTitle = useCallback((item: Item): string | null => {
    const id = getRelation(item.id, 'project');
    return id ? projects.find((p) => p.id === id)?.title ?? null : null;
  }, [projects]);

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes, or an item save elsewhere bumps composerRevision.
  // One combined effect (not two) — on mount, and on any save while the Inbox happens to be
  // closed, both deps land in the same commit, so a separate per-dep effect would just fire
  // the exact same 4 synchronous DB reads twice back-to-back for nothing.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
      refreshHabits();
      refreshViewLists();
    }
  }, [inboxOpen, composerRevision, refresh, refreshUpcoming, refreshHabits, refreshViewLists]);

  // Belt-and-suspenders: some write paths (e.g. HabitsScreen's own
  // quick-create) don't go through the shared item-composer flow, so they
  // never bump composerRevision — refreshing on every return to this tab
  // catches those instead of leaving Home showing stale data.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshUpcoming();
      refreshHabits();
      refreshViewLists();
    }, [refresh, refreshUpcoming, refreshHabits, refreshViewLists]),
  );

  // Each of the 4 new lists is otherwise only refetched on save/focus (above) —
  // also refetch when the switcher lands on one, so a tab you haven't visited
  // since the last change doesn't show stale data.
  useEffect(() => {
    refreshViewLists();
  }, [activeView, refreshViewLists]);

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
      refreshViewLists();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  }, [completingIds, refresh, refreshViewLists]);

  const handleItemTap = useCallback((item: Item) => {
    openItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') {
          refresh();
          refreshViewLists();
        }
      },
    });
  }, [openItem, refresh, refreshViewLists]);

  const handleTaskLongPress = useCallback((item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const moveLabel = item.status === 'someday' ? 'Move to Active' : 'Move to Someday';
    showActionSheet(item.title, [
      { label: 'Edit', onPress: () => handleItemTap(item) },
      { label: 'Complete', onPress: () => handleItemComplete(item) },
      {
        label: moveLabel,
        onPress: () => {
          updateItemStatus(item.id, item.status === 'someday' ? 'active' : 'someday');
          refreshViewLists();
        },
      },
      {
        label: 'Delete',
        onPress: () => {
          deleteItem(item.id);
          refreshViewLists();
        },
        destructive: true,
      },
    ]);
  }, [handleItemTap, handleItemComplete, refreshViewLists]);

  const renderSimpleRow = (item: Item, subtitle: string) => (
    <TouchableOpacity
      key={item.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.surface,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
      }}
      onPress={() => handleItemTap(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
          {item.title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onSettingsPress={onSettingsPress}
        onInboxPress={onInboxPress}
        inboxCount={inboxCount}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 }}
      >
        {VIEW_CHIPS.map((chip) => {
          const isActive = activeView === chip.key;
          const onPress = () => {
            if (activeView !== chip.key) {
              Haptics.selectionAsync();
              setActiveView(chip.key);
            }
          };
          // Active tab sits in the "chip" River Stone material — its inset/
          // pressed treatment (see RiverStoneSurface) reads as a carved
          // groove the selection rests in, matching the tab bar's material
          // elsewhere in the app. Inactive tabs stay flat text, same as the
          // tab bar's unselected icons.
          if (isActive) {
            return (
              <TouchableOpacity key={chip.key} style={{ flexShrink: 0 }} onPress={onPress}>
                <RiverStoneSurface
                  variant="chip"
                  mode={isDark ? 'dark' : 'light'}
                  shape="regular"
                  style={{ height: 30 }}
                  contentStyle={{ paddingHorizontal: 14, height: '100%', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: palette.text }}>{chip.label}</Text>
                </RiverStoneSurface>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={chip.key}
              style={{ flexShrink: 0, height: 30, paddingHorizontal: 14, justifyContent: 'center' }}
              onPress={onPress}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', fontWeight: '500', color: palette.textTertiary }}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <Animated.View key={activeView} entering={FadeIn.duration(200).reduceMotion(ReduceMotion.Never)}>

        {activeView === 'today' && (
        <>
        <RoninJourneyPrototype
          completedCount={todayItems.filter((item) => item.status === 'completed').length}
          totalCount={todayItems.length}
          isDark={isDark}
          potentialPercent={potentialPercent}
        />
        <JourneySummaryStrip
          isDark={isDark}
          potentialPercent={potentialPercent}
          focusLabel={focusLabel}
          onPress={() => (navigation as any).navigate('Menu', { screen: 'Potential' })}
        />

        {/* Quick actions: Medication logging (Inbox now lives in the header).
            Sized to a third of the row (3 square widgets fit side by side) so
            we can see how much room is left for more widgets on this row. */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 }}>
          <View style={{ width: '31%' }}>
            <MedicationQuickLogWidget isDark={isDark} />
          </View>
        </View>

        {/* Habits */}
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        {/* Today */}
        <TodayCard
          items={todayItems.filter((item) => item.status !== 'completed')}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          upcomingGroups={upcomingGroups}
          onViewUpcoming={onViewUpcoming}
          isDark={isDark}
        />
        </>
        )}

        {activeView !== 'today' && (
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          {activeView === 'upcoming' && (
            upcomingItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing upcoming.</Text>
            ) : (
              groupByScheduledDate(upcomingItems, formatDate(new Date())).map((group) => (
                <View key={group.date} style={{ marginBottom: 20 }}>
                  <Text style={{ color: palette.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4 }}>
                    {group.label}
                  </Text>
                  {group.items.map((item) => (
                    <HomeTaskRow
                      key={item.id}
                      item={item}
                      isDark={isDark}
                      palette={palette}
                      projectTitle={getProjectTitle(item)}
                      isCompleting={completingIds.has(item.id)}
                      onComplete={handleItemComplete}
                      onOpen={handleItemTap}
                      onLongPress={handleTaskLongPress}
                    />
                  ))}
                </View>
              ))
            )
          )}

          {activeView === 'anytime' && (
            anytimeItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing here.</Text>
            ) : (
              anytimeItems.map((item) => (
                <HomeTaskRow
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  palette={palette}
                  projectTitle={getProjectTitle(item)}
                  isCompleting={completingIds.has(item.id)}
                  onComplete={handleItemComplete}
                  onOpen={handleItemTap}
                  onLongPress={handleTaskLongPress}
                />
              ))
            )
          )}

          {activeView === 'someday' && (
            somedayItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing filed for someday.</Text>
            ) : (
              somedayItems.map((item) => (
                <HomeTaskRow
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  palette={palette}
                  projectTitle={getProjectTitle(item)}
                  isCompleting={completingIds.has(item.id)}
                  onComplete={handleItemComplete}
                  onOpen={handleItemTap}
                  onLongPress={handleTaskLongPress}
                />
              ))
            )
          )}

          {activeView === 'logbook' && (
            logbookItems.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing completed yet.</Text>
            ) : (
              logbookItems.map((item) => renderSimpleRow(item, item.completedAt ? new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''))
            )
          )}
        </View>
        )}

        </Animated.View>
      </ScrollViewContainer>
    </YStack>
  );
}
