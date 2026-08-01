# Habits

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

`habit` exists as an `Item` type in the schema (`apps/mobile/SCHEMA.md` explicitly lists it as an "unconnected node" with no relations/metadata wired up) and Inbox triage can classify an item as a Habit, but nothing happens after that — no screen, no check-in, no streak, no recurrence UI specific to habits.

## Goal

A real Habits feature: a dedicated screen listing habits with daily check-off and streak tracking, reusing the app's existing recurring-task infrastructure rather than building new recurrence/completion machinery.

## Non-goals

- No Home screen changes in this pass (Menu-only nav placement, per approved design).
- No new recurrence rule types beyond the four the app already supports (`FREQ=DAILY`, `FREQ=WEEKDAYS`, `FREQ=WEEKEND`, `FREQ=WEEKLY`) — the existing `REPEAT` picker in the generic item editor is reused as-is.
- No new "habit-specific" edit form — the existing `ItemEditorSheet` (title, notes, REPEAT picker) already works for any item type, habits included.
- No stored/cached streak counter on the item — streaks are always derived from `activityLogs`, computed on read.

## Design

### Reused infrastructure (no changes)

- **Recurrence:** `rrule` field + `parseRepeatRule`/`dayMatchesRepeat`/`nextOccurrenceDate` (`apps/mobile/src/utils/repeat.ts`), already used by recurring tasks.
- **Completion:** `updateItemStatus(id, 'completed')` (`apps/mobile/src/db/database.ts:1230-1256`) already special-cases any item with an `rrule`: it doesn't mark it "done," it advances `scheduledDate` to `nextOccurrenceDate(item.rrule, item.scheduledDate)` and logs `logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence, next }))`. This is exactly a habit check-in — reused verbatim, no new completion path.
- **Editing:** `useOpenItem()` (`apps/mobile/src/hooks/useOpenItem.ts`) already falls through to the generic `ItemEditorSheet` for any type without a dedicated detail screen (habits included) — its existing REPEAT chip picker (`Never`/`Daily`/`Weekdays`/`Weekends`/`Weekly`) is the habit's recurrence editor, unchanged.
- **Creation:** Inbox triage's existing "Habit" button (`InboxScreenV2.tsx:118`, `handleBulkProcess('habit')`) already reclassifies an item to `type: 'habit'`.

### New: streak calculation

**`apps/mobile/src/utils/streak.ts`** (new file):
```ts
computeStreak(rrule: string | null | undefined, completedDates: Set<string>, today: string): number
```
Walks backward day-by-day starting from `today` if `completedDates.has(today)`, else from the day before `today` (so an as-yet-uncompleted today doesn't zero out an active streak). For each day walked, if it's a day the rrule matches (`dayMatchesRepeat`), it must also be in `completedDates` to continue the streak — the first rrule-matching day that's missing from `completedDates` stops the walk. Non-matching days are skipped without breaking the streak (a "Weekdays" habit's streak isn't broken by weekends). Returns the count of matching+completed days walked.

**`apps/mobile/src/db/database.ts`**: new `getCompletedOccurrenceDates(itemId: string): Set<string>` — queries `activityLogs WHERE entityId = ? AND actionType = 'completed-occurrence'`, parses each row's `details` JSON, collects the `occurrence` field into a `Set<string>`.

### New: `HabitsScreen`

**`apps/mobile/src/screens/HabitsScreen.tsx`** (new), modeled directly on `TasksScreen.tsx`'s structure (flat rows, `LensSurface`, `QuickCreateSheet` via hold-FAB):
- Data: `getItemsByType('habit')` (already generic, no changes needed), one `getCompletedOccurrenceDates` + `computeStreak` call per row.
- Row: title, `🔥 {streak}` (new `Flame` icon export — `react-native-heroicons/solid/FireIcon`, added to `apps/mobile/src/icons.tsx`) next to the title, and a `LacquerDiscControl` checkbox on the left.
  - Checkbox `isEnabled`: `dayMatchesRepeat(parseRepeatRule(item.rrule), today, item.scheduledDate)` — true only when today is one of the habit's scheduled days. When `false`, the disc renders in its existing disabled visual state (already supported by `LacquerDiscControl`'s `isEnabled` prop) and its `onToggle` is a no-op.
  - Checkbox `isCompleted`: true when today's occurrence has already been logged, i.e. `getCompletedOccurrenceDates(item.id).has(today)`.
  - Tap checkbox (when enabled): `updateItemStatus(item.id, 'completed')`, then refresh (which recomputes streak from the now-updated activity log).
  - Tap row body: `openItem({ item, onComplete: ... })` via `useOpenItem()`, same as `TasksScreen`.
- Empty state: "No habits yet" / "Hold the + in the dock to create one" (same copy pattern as `ProjectsScreen`/`TasksScreen`).
- Quick-create: `useRegisterFabHoldAction` + `QuickCreateSheet` (title "New Habit", placeholder "Habit name...", icon = new `Flame` icon), `onSubmit: (title) => createItem('habit', title, 'active')` — same pattern as `ProjectsScreen`'s `handleCreate`. No rrule set at creation (defaults to none/"Never" until the user opens the habit and sets REPEAT — same as a freshly created task).

### Nav wiring

- `apps/mobile/src/icons.tsx`: add `export { default as Flame } from 'react-native-heroicons/solid/FireIcon';` (the outline `FireIcon` is already used, aliased `Dumbbell`, for Workouts — using the solid variant under its own name for habits keeps the two visually distinct).
- `apps/mobile/src/navigation/MenuStack.tsx`: register `<Stack.Screen name="Habits" component={HabitsScreen} />`.
- `apps/mobile/src/screens/MenuScreen.tsx`: add a `{ route: 'Habits', label: 'Habits', sub: 'Daily routines and streaks', icon: Flame, accent: palette.orange, soft: palette.orangeSoft }` entry to `menuItems` (accent reused from Workouts' orange, since Flame is now free of that association).

## Data flow

- Read: `HabitsScreen` reads `getItemsByType('habit')` + per-item `getCompletedOccurrenceDates`/`computeStreak` (all local, synchronous, no new async work).
- Write: check-in writes through the pre-existing `updateItemStatus` path (already synced to Firestore via `syncItemToRemote`, already logs via `logActivity`) — no new sync code.

## Testing

Manual verification in the simulator/dev build (project convention — no automated UI test suite):
- Create a habit via Inbox triage and via the new Habits screen's hold-FAB quick-create.
- Open a habit, set REPEAT to "Daily" via the existing editor — confirm it saves.
- On a day the habit is scheduled, confirm its checkbox is enabled; check it off, confirm the disc completes, the item's `scheduledDate` rolls to tomorrow, and the streak count increments.
- On a day the habit is NOT scheduled (e.g. a "Weekdays" habit on a Saturday), confirm the checkbox renders disabled and tapping it does nothing.
- Verify a "Weekdays" habit's streak survives across a weekend (Friday completed → Monday completed should read as an unbroken streak, not reset by Sat/Sun).
- Miss a scheduled day (don't check in), confirm the streak resets to 0 on the next visit.
- Confirm the Habits card appears in Menu and navigates correctly.
