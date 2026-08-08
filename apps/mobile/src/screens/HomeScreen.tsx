import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AppHeader } from '../components/AppHeader';
import { RiverStoneSurface } from '../components/riverstone';
import { MedicationQuickLogWidget } from '../components/home/MedicationQuickLogWidget';
import { WeatherWidget } from '../components/home/WeatherWidget';
import { TodayCard } from '../components/home/TodayCard';
import { HabitsWidget } from '../components/home/HabitsWidget';
import { HomeTaskRow } from '../components/home/HomeTaskRow';
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
import { UndoToast, type UndoToastState } from '../components/ui/UndoToast';
import { getThemeColors } from '../theme';
import { showActionSheet } from '../utils/actionSheet';
import { groupByScheduledDate } from '../utils/upcomingGrouping';
import type { Item } from '../db/types';

// Complete/delete/move-to-someday all read as instant (row disappears right
// away) but don't actually commit to the DB until this window elapses —
// Undo just cancels the pending timer, so it's a real cancel, not a second
// write undoing the first. 4s matches iOS Mail's own undo-send-adjacent
// convention: long enough to react, short enough not to feel like a delay.
const UNDO_GRACE_MS = 4000;

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
  const reducedMotion = useReducedMotion();
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
  // 'complete' keeps the item counted as done (for the Journey walker's
  // ratio) while it's hidden from the task list; 'delete'/'move' drop it
  // from both the list and any count entirely. Distinguishing the two
  // matters here specifically — completing a task should move the walker
  // immediately, not lag 4s behind the row disappearing.
  const [pendingActions, setPendingActions] = useState<Map<string, 'complete' | 'delete' | 'move'>>(new Map());
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    // Unmount mid-grace-window (e.g. app backgrounded and killed) — commit
    // immediately rather than silently dropping the action.
    for (const timer of pendingTimersRef.current.values()) clearTimeout(timer);
  }, []);

  // Shared by complete/delete/move-to-someday: hide the row immediately
  // (via pendingActions, filtered out of every list below), show an Undo
  // toast, and only actually run `commit` once the grace window elapses
  // uncancelled. Keyed per-item so acting on a second row while one is
  // still pending doesn't clobber the first's timer.
  const scheduleUndoableAction = useCallback((itemId: string, kind: 'complete' | 'delete' | 'move', message: string, commit: () => void) => {
    const existing = pendingTimersRef.current.get(itemId);
    if (existing) clearTimeout(existing);
    setPendingActions((current) => new Map(current).set(itemId, kind));
    const timer = setTimeout(() => {
      pendingTimersRef.current.delete(itemId);
      commit();
      setPendingActions((current) => {
        const next = new Map(current);
        next.delete(itemId);
        return next;
      });
      setUndoToast((current) => (current?.onUndo === undoAction ? null : current));
    }, UNDO_GRACE_MS);
    pendingTimersRef.current.set(itemId, timer);

    const undoAction = () => {
      const t = pendingTimersRef.current.get(itemId);
      if (t) clearTimeout(t);
      pendingTimersRef.current.delete(itemId);
      setPendingActions((current) => {
        const next = new Map(current);
        next.delete(itemId);
        return next;
      });
      setUndoToast(null);
      Haptics.selectionAsync();
    };
    setUndoToast({ message, onUndo: undoAction });
  }, []);

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

  // Three independent, legitimate triggers for the same 4-read refresh
  // (data change, tab focus, view-switcher change) all land on the very
  // first render — each is correct on its own, but stacked on cold mount
  // they meant 3 full computeOverallPotential() passes (an 8-domain scan
  // each) before the user saw anything. The first effect below does the
  // actual mount-time refresh unconditionally; the other two each skip
  // only their own first firing (independent per-effect guards, since
  // effect order isn't something to depend on) and behave normally for
  // every trigger after that.
  const isFirstFocusRef = useRef(true);
  const isFirstActiveViewRef = useRef(true);

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes, or an item save elsewhere bumps composerRevision.
  // One combined effect (not two) — on mount, and on any save while the Inbox happens to be
  // closed, both deps land in the same commit, so a separate per-dep effect would just fire
  // the exact same 4 synchronous DB reads twice back-to-back for nothing. This is the
  // designated mount-time refresh — always runs.
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
  // catches those instead of leaving Home showing stale data. Skips its
  // own first (mount-time) firing — the effect above already covers it.
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      refresh();
      refreshUpcoming();
      refreshHabits();
      refreshViewLists();
    }, [refresh, refreshUpcoming, refreshHabits, refreshViewLists]),
  );

  // Each of the 4 new lists is otherwise only refetched on save/focus (above) —
  // also refetch when the switcher lands on one, so a tab you haven't visited
  // since the last change doesn't show stale data. Skips its own first
  // (mount-time) firing for the same reason as the focus effect above.
  useEffect(() => {
    if (isFirstActiveViewRef.current) {
      isFirstActiveViewRef.current = false;
      return;
    }
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
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      // The disc's own completion animation already played (above); the
      // status write itself is what's undoable, deferred behind the toast.
      scheduleUndoableAction(item.id, 'complete', `"${item.title}" completed`, () => {
        updateItemStatus(item.id, 'completed');
        refresh();
        refreshViewLists();
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  }, [completingIds, refresh, refreshViewLists, scheduleUndoableAction]);

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
          const nextStatus = item.status === 'someday' ? 'active' : 'someday';
          scheduleUndoableAction(item.id, 'move', `Moved to ${nextStatus === 'someday' ? 'Someday' : 'Active'}`, () => {
            updateItemStatus(item.id, nextStatus);
            refreshViewLists();
          });
        },
      },
      {
        label: 'Delete',
        onPress: () => {
          scheduleUndoableAction(item.id, 'delete', `"${item.title}" deleted`, () => {
            deleteItem(item.id);
            refreshViewLists();
          });
        },
        destructive: true,
      },
    ]);
  }, [handleItemTap, handleItemComplete, refreshViewLists, scheduleUndoableAction]);

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
          // hitSlop compensates for the 30pt visual height staying below the
          // 44pt touch-target floor — same pattern as DragHandleButton's
          // compact glyph — rather than growing the "carved groove" chip
          // itself, which is a deliberate compact tray shape.
          const a11yProps = {
            accessibilityRole: 'tab' as const,
            accessibilityLabel: chip.label,
            accessibilityState: { selected: isActive },
          };
          if (isActive) {
            return (
              <TouchableOpacity key={chip.key} style={{ flexShrink: 0 }} onPress={onPress} hitSlop={7} {...a11yProps}>
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
              hitSlop={7}
              {...a11yProps}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', fontWeight: '500', color: palette.textTertiary }}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* No `entering` prop at all under Reduce Motion, rather than trusting
            FadeIn's own .reduceMotion(System) config to skip to the final
            frame — that left this view stuck at FadeIn's initial opacity:0
            (content present, permanently invisible) instead of jumping to
            visible. Checking the setting directly and omitting the animation
            outright (same approach RoninJourneyPrototype already uses) is
            reliable; the previous forced .Never was very likely a workaround
            for this exact failure mode, not an oversight. */}
        <Animated.View key={activeView} entering={reducedMotion ? undefined : FadeIn.duration(200)}>

        {activeView === 'today' && (
        <>
        {/* Journey hero (RoninJourneyPrototype) pulled off Home while the
            new Rive avatar/animation work replaces it — the old Rive
            runtime init on this card was a likely contributor to Home's
            load lag. Re-add once the new rig ships. */}
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
          <View style={{ width: '31%' }}>
            <WeatherWidget isDark={isDark} />
          </View>
        </View>

        {/* Habits */}
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        {/* Today */}
        <TodayCard
          items={todayItems.filter((item) => item.status !== 'completed' && !pendingActions.has(item.id))}
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
            upcomingItems.filter((item) => !pendingActions.has(item.id)).length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing upcoming.</Text>
            ) : (
              groupByScheduledDate(upcomingItems.filter((item) => !pendingActions.has(item.id)), formatDate(new Date())).map((group) => (
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
            anytimeItems.filter((item) => !pendingActions.has(item.id)).length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing here.</Text>
            ) : (
              anytimeItems.filter((item) => !pendingActions.has(item.id)).map((item) => (
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
            somedayItems.filter((item) => !pendingActions.has(item.id)).length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Nothing filed for someday.</Text>
            ) : (
              somedayItems.filter((item) => !pendingActions.has(item.id)).map((item) => (
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

      <UndoToast state={undoToast} isDark={isDark} />
    </YStack>
  );
}
