# Home Habits Widget (Hold-to-Confirm)

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

Habits (added in the prior pass — `apps/mobile/src/screens/HabitsScreen.tsx`) can only be checked off from the dedicated Habits screen (Menu → Habits). There's no quick way to check off today's habits from Home, and the existing check-in gesture everywhere else in the app (`LacquerDiscControl`, instant tap-to-toggle) completes immediately with no confirmation — fine for tasks, but the user wants a deliberate, tactile confirmation step specifically for this new Home widget.

## Goal

A Home widget that shows today's scheduled habits and lets the user check them off with a press-and-hold gesture (not an instant tap, not a modal dialog) — responsive, tactile, and hard to trigger by accident.

## Non-goals

- No changes to `HabitsScreen.tsx`'s own checkbox (`LacquerDiscControl`, instant tap) — the hold-to-confirm gesture is specific to this new Home widget.
- No tap-to-open-editor affordance on the widget's tiles — the full Habits screen already covers editing; this widget is check-in only.
- No empty state — if zero habits are scheduled today, the widget renders nothing at all (not even a header), so Home isn't cluttered on days with nothing due.

## Design

### Shared data extraction (refactor of existing code)

`HabitsScreen.tsx` currently defines a local `HabitRowData` interface and `buildRowData(item, today)` function. Both are extracted, unchanged, into a new `apps/mobile/src/utils/habits.ts`:

```ts
export interface HabitRowData {
  item: Item;
  streak: number;
  isScheduledToday: boolean;
  isCompletedToday: boolean;
}

export function buildHabitRowData(item: Item, today: string): HabitRowData { /* unchanged body */ }
```

`HabitsScreen.tsx` is updated to import from here instead of defining its own copy. This is what lets the new Home widget reuse the exact same streak/scheduled/completed logic without duplicating it.

### `useTodayHabits()` hook

New hook in `apps/mobile/src/hooks/useDb.ts`, same shape as the existing `useCompletedItems()`/`useArchivedItems()`:

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

### `HabitHoldButton` (new component)

`apps/mobile/src/components/home/HabitHoldButton.tsx` — a 64pt circular button, modeled on `LacquerDiscControl`'s existing Reanimated + `Pressable` + SVG pattern (same `createAnimatedComponent`/`useAnimatedProps`/stroke-dash technique that file already uses for its checkmark reveal, applied here to a progress ring instead):

- **Track:** a static SVG `Circle` (muted stroke, `palette.fill` or `separator`).
- **Progress ring:** an `AnimatedCircle` (via `createAnimatedComponent(Circle)`) with `strokeDasharray` set to the circle's circumference and an animated `strokeDashoffset` driven by a `progress` shared value (0 → 1 = empty → full ring), rotated -90° so it starts filling from 12 o'clock.
- **Center:** the `Flame` icon — muted/outline-toned when not completed, `palette.red`/solid-feeling when `isCompletedToday`.
- **Hold mechanics** (on `Pressable`'s `onPressIn`/`onPressOut`, same event pair `LacquerDiscControl` already uses):
  - `onPressIn` (only when not already completed): `progress.value = withTiming(1, { duration: 600 }, (finished) => { if (finished) runOnJS(handleConfirmed)(); })`. A `useAnimatedReaction` watches `progress.value`, and on each 0.2 threshold crossed fires a light haptic tick via `runOnJS` (5 ticks across the 600ms hold — same tick-per-threshold idea `useHapticReorder`'s `onIndexChange` already uses elsewhere in this app, just time-based instead of index-based).
  - `onPressOut` before completion: `progress.value = withTiming(0, { duration: 150 })` — this reassignment interrupts the still-running fill animation, so its completion callback fires with `finished: false` and `handleConfirmed` never runs. A light "cancelled" haptic fires here too, so an early release still feels acknowledged rather than silently failing.
  - `handleConfirmed` (JS-thread): fires a success haptic (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`, matching `LacquerDiscControl`'s own completion haptic), then calls the `onConfirm` prop.
  - Already-`isCompletedToday` buttons render fully filled/solid with no `onPressIn` handler wired (inert) — nothing left to hold.

Props: `{ title: string; streak: number; isCompletedToday: boolean; isDark: boolean; onConfirm: () => void }`. Title renders below the circle (max 1 line, small caption); streak count in smaller muted text below the title (only shown when `streak > 0`, to avoid "0" clutter on brand-new habits).

### `HabitsWidget` (new component)

`apps/mobile/src/components/home/HabitsWidget.tsx` — thin wrapper: a horizontal `ScrollView` (`horizontal`, `showsHorizontalScrollIndicator={false}`) of `HabitHoldButton`s, one per habit from `useTodayHabits()`. Renders `null` entirely when `habits.length === 0` (the approved no-empty-state behavior). On confirm, calls `updateItemStatus(item.id, 'completed')` (the exact same call `HabitsScreen.tsx`'s own check-in already makes — no new completion path) then `refresh()`s both this hook and (via a passed-down callback) the parent's own refresh cycle, matching how `TodayCard`/`InboxScrollCard` already get refreshed from `HomeScreen.tsx`'s `inboxOpen`/`composerRevision` effects.

### `HomeScreen` wiring

`HomeScreen.tsx` renders `<HabitsWidget />` between the existing Inbox preview `View` and the `TodayCard`. It calls `useTodayHabits()` itself (so its refresh can be folded into the same `inboxOpen`/`composerRevision` `useEffect`s that already refresh `useHomeData()`/`useUpcomingPreview()`) and passes `habits`/`refresh` down as props, keeping `HabitsWidget` a thin presentational wrapper rather than owning its own data fetching (matching how `TodayCard` is structured today — it receives `items`/`refresh`-driving callbacks as props, not fetching its own data internally).

## Data flow

- Read: `HomeScreen` calls `useTodayHabits()`, same local/synchronous pattern as its other Home hooks.
- Write: confirming a hold calls the pre-existing `updateItemStatus(id, 'completed')` path (already Firestore-synced, already logs `completed-occurrence` for streak calculation) — no new sync or logging code.

## Testing

Manual verification in the simulator/dev build (project convention — no automated UI test suite; `computeStreak`/`buildHabitRowData` remain covered by existing/extended unit tests where they're pure):
- Create a habit, set it to "Daily", confirm it appears in the Home widget.
- Press and hold its circle — confirm the ring fills over ~0.6s with light haptic ticks, and it completes (flame turns solid, success haptic, item disappears from "needs holding" state) only once fully held.
- Press and release early (before the ring completes) — confirm it springs back to empty with a light haptic and does NOT complete.
- Confirm an already-completed-today habit's circle is inert (holding it does nothing).
- Confirm the widget disappears entirely (no header, no empty row) when no habits are scheduled for today.
- Confirm streak count under the title matches what the Habits screen shows for the same habit.
- Confirm holding one habit doesn't also complete the `HabitsScreen`'s copy of the same habit incorrectly — both should read the same underlying state after a refresh.
