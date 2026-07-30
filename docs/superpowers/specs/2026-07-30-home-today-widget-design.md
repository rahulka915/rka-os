# Home "Today" Widget

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

Home (`apps/mobile/src/screens/HomeScreen.tsx`) was recently stripped down to just the header and an Inbox preview (the Ronin hero, Next Up card, and the Anytime/Morning/Afternoon/Evening timeline were all removed in prior work). It no longer answers "what do I have to do today" at all — there's no task-facing content on the screen.

## Goal

Add a single "Today" widget to Home that lists today's tasks and lets the user complete or open them, without reintroducing the removed hero/Next-Up/time-bucket complexity.

## Non-goals

- Medications, habits, or any non-task item type — tasks only, matching the data `useHomeData()` already computes.
- Time-of-day sectioning (Anytime/Morning/Afternoon/Evening) — a single flat list instead.
- Swipe actions (archive/delete) — checkbox-complete and tap-to-open only.
- Drag-to-reorder.
- A stat/progress summary row — out of scope for this pass.

## Design

### Data

Reuse `useHomeData()`'s existing `todayItems` (`apps/mobile/src/hooks/useDb.ts:66-98`) unchanged — the union of `getTodayItems()` (scheduled today, or status `due-today`/`overdue`), `getPlannedTodayItems()`, and `getRepeatingItemsForToday()`, deduped by id. No new queries or hooks needed.

**Sort:** items with `status === 'overdue'` first, then the remainder in the order `todayItems` already returns them (no secondary sort key — the underlying queries don't provide one worth relying on).

### Components

**`apps/mobile/src/components/home/TodayCard.tsx`** (new) — renders the "TODAY · N tasks" section label and the row list. Props: `items: Item[]`, `completingIds: Set<string>`, `onComplete: (item: Item) => void`, `onOpen: (item: Item) => void`, `isDark: boolean`. Empty state (`items.length === 0`): "Nothing to do today" / "Enjoy the calm" copy, matching the tone of the removed Next Up card's empty state.

Row rendering lives in the same file as a local memoized component (`TodayTaskRow`), following the pattern of `ProjectTaskRow` in `ProjectDetailScreen.tsx` and `TaskRow` in `TasksScreen.tsx`:
- `LacquerDiscControl` checkbox on the left, `isCompleted` driven by `completingIds.has(item.id)`, `onToggle` calls `onComplete(item)`.
- Title `Text`, `numberOfLines={1}`.
- If `item.status === 'overdue'`, title color is `palette.red` instead of `palette.text` (the same overdue-accent convention `DeadlineBadge` uses elsewhere in the app).
- Row `TouchableOpacity` (title area) calls `onOpen(item)`.
- No project/mission subtitle, no `BlockedBadge`/`DeadlineBadge`/`RepeatBadge` — kept minimal per the approved design.

### HomeScreen wiring

`HomeScreen.tsx` regains two handlers it lost in the last cleanup (reintroduced, not restored verbatim — trimmed to just what `TodayCard` needs):

- `handleItemComplete(item: Item)` — checks `getBlockingTask(item.id)` first (same blocked-task `Alert.alert` guard the old timeline had); if clear, adds `item.id` to a local `completingIds` state, waits `LACQUER_DISC_COMPLETION_DURATION` (imported from `LacquerDiscControl`, same constant used by `TasksScreen`/`ProjectDetailScreen`), then calls `updateItemStatus(item.id, 'completed')`, `refresh()`, and clears the id from `completingIds`.
- `handleItemTap(item: Item)` — calls `useOpenItem()`'s `openItem({ item, onComplete: ({ action }) => { if (action !== 'cancelled') refresh(); } })`, the same pattern already used by `TasksScreen`/`ProjectDetailScreen`.

`useHomeData()` is destructured for `todayItems` in addition to the existing `inboxCount`/`refresh`. `TodayCard` renders below the existing Inbox preview `View`, inside the same `ScrollViewContainer`.

## Testing

Manual verification in the simulator/dev build (project convention — no automated UI test suite):
- A task scheduled for today, a task planned-for-today via "Add to Today", and a recurring task firing today all appear in the list.
- Tapping a row's checkbox completes it (after the disc animation) and it disappears from the list on refresh.
- Completing a task that's blocked by another incomplete task shows the "Blocked" alert and does not complete it.
- Tapping a row's title opens the item editor; saving/closing refreshes the list.
- An overdue task's title renders in red; a normal today task does not.
- With no tasks for today, the empty state copy shows instead of an empty list.
