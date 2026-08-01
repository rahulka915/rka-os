# Home Habits Widget (Hold-to-Confirm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Home widget showing today's scheduled habits, checked off via a press-and-hold gesture (ring fills over 600ms with haptic ticks; release early cancels) rather than an instant tap.

**Architecture:** Extract `HabitsScreen.tsx`'s existing row-building logic into a shared `utils/habits.ts` so a new `useTodayHabits()` hook can reuse it. A new `HabitHoldButton` (Reanimated + SVG progress ring, modeled directly on `LacquerDiscControl`'s existing animation technique) provides the hold gesture; `HabitsWidget` is a thin horizontal-scroll wrapper; `HomeScreen` wires the hook and renders the widget between the Inbox preview and `TodayCard`.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript, `react-native-reanimated`, `react-native-svg` (both already dependencies, already used identically in `apps/mobile/src/components/ui/LacquerDiscControl.tsx`). No automated UI test suite — manual verification per project convention.

## Global Constraints

- Confirming a hold calls `updateItemStatus(id, 'completed')` — the exact same call `HabitsScreen.tsx`'s own check-in already makes. No new completion path.
- `HabitsScreen.tsx`'s own checkbox (`LacquerDiscControl`) is untouched — hold-to-confirm is exclusive to the new Home widget.
- The widget renders nothing at all (`null`, no header, no empty state) when zero habits are scheduled today.
- Hold duration: 600ms fill, 150ms cancel-spring-back. Haptic ticks at each 0.2 progress threshold (5 ticks across the hold); light haptic on early release; success haptic (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`) on completion — matching `LacquerDiscControl`'s own completion haptic.
- No tap-to-open-editor on the widget's tiles (non-goal — editing stays on the full Habits screen).

---

### Task 1: Extract `utils/habits.ts`, refactor `HabitsScreen.tsx`

**Files:**
- Create: `apps/mobile/src/utils/habits.ts`
- Modify: `apps/mobile/src/screens/HabitsScreen.tsx`

**Interfaces:**
- Consumes: `parseRepeatRule`, `dayMatchesRepeat` (`apps/mobile/src/utils/repeat.ts`); `computeStreak` (`apps/mobile/src/utils/streak.ts`); `getCompletedOccurrenceDates` (`apps/mobile/src/db/database.ts`); `Item` type (`apps/mobile/src/db/types.ts`).
- Produces: `HabitRowData` interface, `buildHabitRowData(item: Item, today: string): HabitRowData`. Consumed by Task 2 (`useTodayHabits`) and this task's own `HabitsScreen.tsx` refactor.

- [ ] **Step 1: Create the shared utility**

```ts
// apps/mobile/src/utils/habits.ts
import { getCompletedOccurrenceDates } from '../db/database';
import { parseRepeatRule, dayMatchesRepeat } from './repeat';
import { computeStreak } from './streak';
import type { Item } from '../db/types';

export interface HabitRowData {
  item: Item;
  streak: number;
  isScheduledToday: boolean;
  isCompletedToday: boolean;
}

export function buildHabitRowData(item: Item, today: string): HabitRowData {
  const rule = parseRepeatRule(item.rrule);
  const completedDates = getCompletedOccurrenceDates(item.id);
  return {
    item,
    streak: computeStreak(item.rrule, completedDates, today),
    isScheduledToday: rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false,
    isCompletedToday: completedDates.has(today),
  };
}
```

- [ ] **Step 2: Update `HabitsScreen.tsx` to use it**

In `apps/mobile/src/screens/HabitsScreen.tsx`, replace:
```tsx
import { getItemsByType, createItem, updateItemStatus, deleteItem, formatDate, getCompletedOccurrenceDates } from '../db/database';
import { parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';
import { computeStreak } from '../utils/streak';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { LacquerDiscControl, LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { useOpenItem } from '../hooks/useOpenItem';
import { showActionSheet } from '../utils/actionSheet';
import { Flame } from '../icons';
import type { Item } from '../db/types';

interface HabitRowData {
  item: Item;
  streak: number;
  isScheduledToday: boolean;
  isCompletedToday: boolean;
}

function buildRowData(item: Item, today: string): HabitRowData {
  const rule = parseRepeatRule(item.rrule);
  const completedDates = getCompletedOccurrenceDates(item.id);
  return {
    item,
    streak: computeStreak(item.rrule, completedDates, today),
    isScheduledToday: rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false,
    isCompletedToday: completedDates.has(today),
  };
}
```
with:
```tsx
import { getItemsByType, createItem, updateItemStatus, deleteItem, formatDate } from '../db/database';
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { LacquerDiscControl, LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import { useOpenItem } from '../hooks/useOpenItem';
import { showActionSheet } from '../utils/actionSheet';
import { Flame } from '../icons';
```

Then replace the one call site:
```tsx
    setRows(getItemsByType('habit').map((item) => buildRowData(item, today)));
```
with:
```tsx
    setRows(getItemsByType('habit').map((item) => buildHabitRowData(item, today)));
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors other than the pre-existing, unrelated ones under `src/webApp/` (retired PWA code — confirm the error list is unchanged from before this task).

- [ ] **Step 4: Run the test suite**

Run: `cd apps/mobile && npm test`
Expected: all tests still pass (this refactor doesn't touch any tested pure function's behavior, just its location).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/habits.ts apps/mobile/src/screens/HabitsScreen.tsx
git commit -m "refactor: extract shared habit row-building into utils/habits.ts"
```

---

### Task 2: `useTodayHabits()` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts`

**Interfaces:**
- Consumes: `buildHabitRowData`, `HabitRowData` (Task 1); `getItemsByType`, `formatDate` (already imported in this file, per the existing import block).
- Produces: `useTodayHabits(): { habits: HabitRowData[]; refresh: () => void }`, where `habits` is already filtered to `isScheduledToday`. Consumed by Task 5 (`HomeScreen.tsx`).

- [ ] **Step 1: Add the import**

In `apps/mobile/src/hooks/useDb.ts`, add to the existing `import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';` line's neighborhood:

```ts
import { buildHabitRowData, type HabitRowData } from '../utils/habits';
```

- [ ] **Step 2: Add the hook**

Add after `useUpcomingPreview` (the function added in the prior Home Today/Upcoming work):

```ts

export function useTodayHabits() {
  const [habits, setHabits] = useState<HabitRowData[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setHabits(getItemsByType('habit').map((item) => buildHabitRowData(item, today)).filter((row) => row.isScheduledToday));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { habits, refresh };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useDb.ts
git commit -m "feat: add useTodayHabits hook for Home's habits widget"
```

---

### Task 3: `HabitHoldButton`

**Files:**
- Create: `apps/mobile/src/components/home/HabitHoldButton.tsx`

**Interfaces:**
- Consumes: `getThemeColors` (`apps/mobile/src/theme`); `Flame` icon (`apps/mobile/src/icons.tsx`).
- Produces: `HabitHoldButton({ title, streak, isCompletedToday, isDark, onConfirm }: HabitHoldButtonProps)`. Consumed by Task 4 (`HabitsWidget`).

- [ ] **Step 1: Create the component**

```tsx
// apps/mobile/src/components/home/HabitHoldButton.tsx
import { Text, View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';
import { Flame } from '../../icons';

const AnimatedCircle = createAnimatedComponent(Circle);

const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HOLD_DURATION = 600;
const CANCEL_DURATION = 150;

interface HabitHoldButtonProps {
  title: string;
  streak: number;
  isCompletedToday: boolean;
  isDark: boolean;
  onConfirm: () => void;
}

function tickHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function cancelHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function confirmHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// Press-and-hold confirmation, not an instant tap — the ring fills over
// HOLD_DURATION with a haptic tick at each fifth crossed; releasing early
// interrupts the fill (withTiming reassignment makes the pending completion
// callback fire with finished:false, so onConfirm never runs) and springs
// back with a light "cancelled" tick instead of failing silently.
export function HabitHoldButton({ title, streak, isCompletedToday, isDark, onConfirm }: HabitHoldButtonProps) {
  const palette = getThemeColors(isDark);
  const progress = useSharedValue(isCompletedToday ? 1 : 0);

  useAnimatedReaction(
    () => Math.floor(progress.value * 5),
    (bucket, previousBucket) => {
      if (bucket > 0 && bucket !== previousBucket) {
        runOnJS(tickHaptic)();
      }
    },
  );

  const handleConfirmed = () => {
    confirmHaptic();
    onConfirm();
  };

  const handlePressIn = () => {
    if (isCompletedToday) return;
    progress.value = withTiming(
      1,
      { duration: HOLD_DURATION, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(handleConfirmed)();
      },
    );
  };

  const handlePressOut = () => {
    if (isCompletedToday || progress.value >= 1) return;
    progress.value = withTiming(0, { duration: CANCEL_DURATION });
    runOnJS(cancelHaptic)();
  };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const flameColor = isCompletedToday ? palette.red : palette.textTertiary;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isCompletedToday}
        accessibilityRole="button"
        accessibilityLabel={isCompletedToday ? `${title}, already checked in today` : `Hold to check in ${title}`}
      >
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.fill}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.red}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={ringProps}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>
          <View style={styles.iconOverlay} pointerEvents="none">
            <Flame size={24} color={flameColor} />
          </View>
        </View>
      </Pressable>
      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title}</Text>
      {streak > 0 && (
        <Text style={[styles.streak, { color: palette.textTertiary }]}>{streak}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: SIZE + 16,
    gap: 4,
  },
  iconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  streak: {
    fontSize: 11,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/HabitHoldButton.tsx
git commit -m "feat: add HabitHoldButton with press-and-hold confirmation"
```

---

### Task 4: `HabitsWidget`

**Files:**
- Create: `apps/mobile/src/components/home/HabitsWidget.tsx`

**Interfaces:**
- Consumes: `HabitHoldButton` (Task 3); `HabitRowData` type (`apps/mobile/src/utils/habits.ts`); `updateItemStatus` (`apps/mobile/src/db/database.ts`).
- Produces: `HabitsWidget({ habits, refresh, isDark }: HabitsWidgetProps)`. Consumed by Task 5 (`HomeScreen.tsx`).

- [ ] **Step 1: Create the component**

```tsx
// apps/mobile/src/components/home/HabitsWidget.tsx
import { ScrollView, StyleSheet } from 'react-native';
import { updateItemStatus } from '../../db/database';
import { HabitHoldButton } from './HabitHoldButton';
import type { HabitRowData } from '../../utils/habits';

interface HabitsWidgetProps {
  habits: HabitRowData[];
  refresh: () => void;
  isDark: boolean;
}

// Renders nothing at all — no header, no empty state — when there's
// nothing scheduled for today, so Home stays uncluttered on quiet days.
export function HabitsWidget({ habits, refresh, isDark }: HabitsWidgetProps) {
  if (habits.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {habits.map((row) => (
        <HabitHoldButton
          key={row.item.id}
          title={row.item.title}
          streak={row.streak}
          isCompletedToday={row.isCompletedToday}
          isDark={isDark}
          onConfirm={() => {
            updateItemStatus(row.item.id, 'completed');
            refresh();
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    gap: 12,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/HabitsWidget.tsx
git commit -m "feat: add HabitsWidget horizontal scroll wrapper"
```

---

### Task 5: Wire into `HomeScreen`

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (current full content below — the entire file as of the last commit)

**Interfaces:**
- Consumes: `useTodayHabits` (Task 2), `HabitsWidget` (Task 4).
- Produces: nothing consumed elsewhere — this is the last task.

The current full content of `apps/mobile/src/screens/HomeScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { TodayCard } from '../components/home/TodayCard';
import { useHomeData, useUpcomingPreview } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import { getBlockingTask, updateItemStatus } from '../db/database';
import { LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import type { Item } from '../db/types';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
  onViewUpcoming: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress, onViewUpcoming }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
    }
  }, [inboxOpen, refresh, refreshUpcoming]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
  }, [composerRevision, refresh, refreshUpcoming]);

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
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  }, [completingIds, refresh]);

  const handleItemTap = useCallback((item: Item) => {
    openItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  }, [openItem, refresh]);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onProfilePress={onHeroPress}
        onSettingsPress={onSettingsPress}
      />

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View>

        {/* Inbox preview */}
        <View style={{ width: '50%', marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today */}
        <TodayCard
          items={todayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          upcomingGroups={upcomingGroups}
          onViewUpcoming={onViewUpcoming}
          isDark={isDark}
        />

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
```

- [ ] **Step 1: Add imports**

Replace:
```tsx
import { useHomeData, useUpcomingPreview } from '../hooks/useDb';
```
with:
```tsx
import { useHomeData, useUpcomingPreview, useTodayHabits } from '../hooks/useDb';
```

Add, after the `TodayCard` import:
```tsx
import { HabitsWidget } from '../components/home/HabitsWidget';
```

- [ ] **Step 2: Call `useTodayHabits()` and fold its refresh into the existing effects**

Replace:
```tsx
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
    }
  }, [inboxOpen, refresh, refreshUpcoming]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
  }, [composerRevision, refresh, refreshUpcoming]);
```
with:
```tsx
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const { habits: todayHabits, refresh: refreshHabits } = useTodayHabits();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
      refreshHabits();
    }
  }, [inboxOpen, refresh, refreshUpcoming, refreshHabits]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
    refreshHabits();
  }, [composerRevision, refresh, refreshUpcoming, refreshHabits]);
```

- [ ] **Step 3: Render `HabitsWidget` between the Inbox preview and `TodayCard`**

Replace:
```tsx
        {/* Inbox preview */}
        <View style={{ width: '50%', marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today */}
```
with:
```tsx
        {/* Inbox preview */}
        <View style={{ width: '50%', marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Habits */}
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        {/* Today */}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). On Home:
- With a "Daily" habit that hasn't been checked in today, confirm its circle appears between the Inbox preview and the Today/Upcoming card.
- Press and hold the circle — confirm the ring fills over ~0.6s with light haptic ticks along the way.
- Hold to completion — confirm a success haptic fires, the flame turns solid/red, and (after `refresh()`) the circle now renders inert/filled.
- Press and release early (before the ring finishes) — confirm the ring springs back to empty with a light haptic and the habit is NOT marked complete (verify on the Habits screen too).
- With no habits scheduled for today (e.g. temporarily set a habit to "Weekdays" and test on a weekend, or delete/complete all today's habits), confirm the widget area renders nothing — no empty placeholder, no leftover header space.
- Confirm the streak number under a habit's title matches what `HabitsScreen` shows for the same habit.
- Scroll the widget horizontally with 3+ habits scheduled today — confirm it scrolls smoothly and doesn't interfere with the outer page scroll.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: wire HabitsWidget into HomeScreen"
```

---

## Self-Review Notes

- **Spec coverage:** Shared data extraction → Task 1. `useTodayHabits` (today-scheduled only) → Task 2. Hold-to-confirm gesture (ring fill, tick haptics, cancel-on-early-release, success haptic, reused completion path) → Task 3. Horizontal scroll wrapper with no-empty-state behavior → Task 4. Home placement + refresh wiring → Task 5. All non-goals respected (HabitsScreen's own checkbox untouched, no tap-to-edit on the widget, no empty-state UI).
- **Placeholder scan:** No TBD/TODO; every step has complete code.
- **Type consistency:** `HabitRowData`/`buildHabitRowData` (Task 1) match exactly how Task 2's `useTodayHabits` and Task 4's `HabitsWidgetProps.habits` consume them. `HabitHoldButtonProps` (Task 3: `title`, `streak`, `isCompletedToday`, `isDark`, `onConfirm`) matches exactly how Task 4 invokes `<HabitHoldButton />`. `HabitsWidgetProps` (Task 4: `habits`, `refresh`, `isDark`) matches exactly how Task 5 invokes `<HabitsWidget />`.
- **Scope check:** Five tasks with a clean dependency chain (shared util → hook → button → widget → screen wiring), each independently testable and committed separately, matching the single-subsystem spec.
