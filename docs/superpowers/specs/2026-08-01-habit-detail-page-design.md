# Habit Detail Page — Design

## Problem

Tapping a habit (mobile `HabitsScreen.tsx`, web `HabitsScreen.web.tsx`) currently
opens the generic item editor — a task-shaped form with no streak history, no
calendar, no way to see or correct past check-ins. Habits need their own detail
page, on both platforms, showing history and letting past check-ins be
corrected.

## Goal

Tapping into a habit opens a dedicated detail page (mobile: new screen; web:
new detail-panel content) showing streak, a month calendar of check-ins, and a
chronological log — with past days toggleable to fix mistakes or backfill
forgotten check-ins.

## Design

### Shared pure logic (`apps/mobile/src/utils/`, used by both platforms)

**`habitCalendar.ts`** (new):

```typescript
export interface HabitCalendarDay {
  date: string;           // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isScheduled: boolean;   // rrule matches this date
  isCompleted: boolean;   // in completedDates
  isToday: boolean;
  isFuture: boolean;      // date > today
}

export interface HabitCalendarMonth {
  year: number;
  month: number;          // 0-11
  label: string;          // "August 2026"
  weeks: HabitCalendarDay[][]; // full weeks, leading/trailing days from adjacent months included with inCurrentMonth: false
}

export function buildHabitCalendarMonth(
  rrule: string | null | undefined,
  completedDates: Set<string>,
  anchor: Date,   // any date within the target month
  today: string,
): HabitCalendarMonth
```

Built on the existing `parseRepeatRule`/`dayMatchesRepeat`/`addDays` from
`repeat.ts` — no new date-math primitives. Pure, no RN/DOM imports, so both
`HabitDetailScreen.tsx` (mobile) and `HabitDetailPanel.web.tsx` (web) call it
identically.

A day is toggleable (tappable) only when `isScheduled && !isFuture` — matches
`computeStreak`'s own rule-matching logic, and prevents logging days that
haven't happened yet.

### DB layer: `toggleHabitOccurrence`

New function in both `database.ts` and `database.web.ts`, same shape as the
existing `deleteMedicationLog`/`logActivity` pair each file already has:

```typescript
export function toggleHabitOccurrence(itemId: string, date: string): void {
  // find an existing 'completed-occurrence' log for this itemId whose
  // details.occurrence === date
  //   if found: delete it (uncheck)
  //   if not found: logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }))
}
```

Mobile queries `activityLogs` directly (`getAllSync` + `DELETE FROM
activityLogs WHERE id = ?`, mirroring `deleteMedicationLog`'s existing SQL
pattern). Web filters `getActivityLogsSnapshot()` and calls the existing
`deleteActivityLogDoc`/`logActivity` Firestore helpers.

**Deliberately does not touch `item.scheduledDate` or run the rrule
roll-forward** that `updateItemStatus` performs for the "check in today" path
(Home widget's hold button, Habits list's disc control) — those existing
controls are unchanged and keep working exactly as they do today. Streak and
`isScheduledToday`/`isCompletedToday` (via `buildHabitRowData` in
`utils/habits.ts`) are derived purely from `completedDates` + `rrule` + a date
string, never from `scheduledDate` advancing, so this divergence has no
visible effect — checking in "today" from the new calendar and checking in via
the existing hold-button both write the identical `completed-occurrence` log
shape and are indistinguishable to every reader of that log.

### Mobile: `HabitDetailScreen.tsx`

New root-stack screen, registered in `App.tsx` alongside `AreaDetail` /
`ProjectDetail` / `ObjectDetail`:

```tsx
<RootStack.Screen
  name="HabitDetail"
  component={HabitDetailScreen}
  options={{ animation: 'slide_from_right' }}
/>
```

`useOpenItem.ts` gains a case:

```typescript
case 'habit':
  navigateTo('HabitDetail', { habitId: item.id, title: item.title });
  return;
```

This means the current long-press "Edit" action on `HabitsScreen.tsx`'s rows
(`showActionSheet` → `openItem(...)`) now also lands on `HabitDetail` — same
destination as a plain tap, which is correct: there is one page per habit now,
not a separate "view" and "edit" destination.

Screen content, top to bottom:
- Header: back chevron, habit title, pencil icon.
- Streak badge (flame icon + number, same visual language as
  `HabitHoldButton`/`HabitsScreen`'s existing streak display).
- Month calendar (`buildHabitCalendarMonth`), with `‹`/`›` to navigate months.
  Scheduled days render as filled/outlined circles; completed days filled
  solid; tapping a toggleable day calls `toggleHabitOccurrence` then
  recomputes local streak/calendar state (no navigation, no confirmation
  dialog — direct toggle, matching the "tap to toggle" answer already given).
- Chronological log: `completedDates` sorted descending, rendered as a flat
  list of formatted dates (e.g. "Wed, Jul 30").
- Pencil icon opens the existing generic editor directly via
  `useItemComposer().openEditorForItem({ item, onComplete })` — bypassing
  `useOpenItem()` (which would just navigate back to this same screen) to
  reach `ItemEditorSheet` for title/repeat/delete, reusing that already-built
  UI instead of duplicating it. Deleting there pops back to the previous
  screen (mirrors how `ObjectDetailScreen`/etc. already handle delete-while-
  viewing).

### Web: `HabitDetailPanel.web.tsx`

New component. `HabitsScreen.web.tsx`'s row `onPress` currently sets
`selectedId` and renders `<ItemDetailForm item={selectedItem} .../>` inside
`DetailPanel`. It gains a local `mode: 'detail' | 'edit'` (defaulting to
`'detail'`) alongside `selectedId`:

- `mode === 'detail'` → renders `HabitDetailPanel` (streak, calendar, log,
  pencil button that sets `mode = 'edit'`).
- `mode === 'edit'` → renders the existing `ItemDetailForm` (title, repeat,
  delete), with a back affordance that sets `mode = 'detail'` again.
  `onDeleted` still clears `selectedId` and closes the panel, same as today.

`HabitDetailPanel` itself is presentation-only (calendar grid + list,
`RiverStoneSurface`-free — plain `webColors` tokens matching the rest of
`webApp/`), calling `toggleHabitOccurrence` + a local refresh callback on day
tap, identical data flow to the mobile screen.

## Files touched

- Create: `apps/mobile/src/utils/habitCalendar.ts`
- Modify: `apps/mobile/src/db/database.ts` (add `toggleHabitOccurrence`)
- Modify: `apps/mobile/src/db/database.web.ts` (add `toggleHabitOccurrence`)
- Create: `apps/mobile/src/screens/HabitDetailScreen.tsx`
- Modify: `apps/mobile/src/hooks/useOpenItem.ts` (add `case 'habit'`)
- Modify: `apps/mobile/App.tsx` (register `HabitDetail` route)
- Create: `apps/mobile/src/webApp/HabitDetailPanel.web.tsx`
- Modify: `apps/mobile/src/webApp/HabitsScreen.web.tsx` (mode toggle,
  render `HabitDetailPanel` vs `ItemDetailForm`)

## What this does NOT change

- The existing check-in controls (Home widget hold-button, Habits list disc
  control) are untouched — they still call `updateItemStatus`, unchanged.
- No new activity-log action types — `toggleHabitOccurrence` writes the same
  `completed-occurrence` shape `updateItemStatus` already writes.
- No changes to `computeStreak`, `buildHabitRowData`, or any existing streak
  math — the new calendar/log are read/write views over data that already
  drives those functions today.
