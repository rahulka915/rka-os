# Home Today/Upcoming Tab Card + Compact Inbox Card

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

Home's `TodayCard` only shows today's tasks. There's no glance at what's coming up without leaving Home for the full Upcoming screen. Separately, `InboxScrollCard` is currently full-width (a leftover from removing the Next Up card it used to share a row with) — it should go back to its original compact square-tile size.

## Goals

1. `TodayCard` gains a segmented "Today" / "Upcoming" tab. Upcoming shows a capped preview of future-scheduled tasks, grouped by date, with a "View all" row that opens the full Upcoming screen.
2. `InboxScrollCard` returns to half-row width so its `aspectRatio`-driven sizing makes it compact again.

## Non-goals

- No checkbox-complete on the Upcoming tab (matches how the standalone Upcoming screen already treats its rows — tap-to-open only).
- No inner scroll view for the Upcoming tab's list — it's a capped, non-scrolling preview to avoid nesting a scrollable list inside Home's page-level `ScrollViewContainer` (a known React Native pitfall).
- No change to Upcoming screen itself (`apps/mobile/src/screens/UpcomingScreen.tsx`) — Home's tab reuses its data/grouping utilities, not its UI.

## Design

### Upcoming data

Reuse existing, unchanged utilities — no new queries:
- `getUpcomingItems(fromDate: string): Item[]` (`apps/mobile/src/db/database.ts`) — items scheduled after `fromDate`.
- `groupByScheduledDate(items: Item[], today: string): UpcomingGroup[]` (`apps/mobile/src/utils/upcomingGrouping.ts`) — buckets into `{ date, label, items }` groups (e.g. "TOMORROW", "MON 3 AUG").

New hook **`useUpcomingPreview()`** in `apps/mobile/src/hooks/useDb.ts`, mirroring the existing `useCompletedItems()`/`useArchivedItems()` pattern: computes `groupByScheduledDate(getUpcomingItems(today), today)` on `refresh()`, returns `{ groups, refresh }`.

**Cap:** flatten the grouped items in date order and take the first 5 across however many leading groups that spans (a group's items aren't split mid-group — if the 5th item falls inside a group, that whole group's remaining items after it are simply not shown, since the "View all" row covers the rest).

### `TodayCard` changes

`apps/mobile/src/components/home/TodayCard.tsx` gains:
- A segmented control above the list — same visual pattern as `TasksScreen`'s Tasks/Logbook tabs (`segmentedControl`/`segment`/`segmentLabel` styles), local `activeTab: 'today' | 'upcoming'` state.
- New props: `upcomingGroups: UpcomingGroup[]` (capped, from `useUpcomingPreview()`), `onViewUpcoming: () => void`.
- Today tab: unchanged existing rendering (`TodayTaskRow`, overdue-first sort, red accent, checkbox-complete).
- Upcoming tab: for each group, a small date-label header (reusing the same `sectionLabel` text style already in this file) followed by rows — reuses a new lightweight row (title + `DeadlineBadge` if `dueDate` set, tap → `onOpen(item)`, no checkbox). After all capped items, a trailing "View all" row (chevron-right affordance, tap → `onViewUpcoming()`). Empty state ("Nothing scheduled") when `upcomingGroups` is empty.

### `HomeScreen` / `App.tsx` wiring

- `HomeScreen.tsx` calls `useUpcomingPreview()` and refreshes it alongside the existing `refresh()` calls (same `inboxOpen`/`composerRevision` triggers already wired for Today).
- `HomeScreenProps` gains `onViewUpcoming: () => void`.
- `App.tsx`'s `Tab.Screen name="Home"` render prop passes `onViewUpcoming={() => (navigation as any).navigate('Menu', { screen: 'Upcoming' })}` — same nested-navigator pattern already used there for `onSettingsPress`'s `getParent()` call, adapted for a same-tree nested screen instead of a parent-level one.

### Inbox card sizing

In `HomeScreen.tsx`, wrap `InboxScrollCard` in a `{ width: '50%' }` container (replacing the current `{ marginHorizontal: 12, marginTop: 8 }` full-width wrapper — margin logic preserved, just width-constrained). No changes inside `InboxScrollCard.tsx` itself; its `aspectRatio: 1.16` on `squareCard` already derives a compact square height from whatever width it's given.

## Testing

Manual verification in the simulator/dev build (project convention):
- Today tab behaves exactly as before (regression check).
- Switching to Upcoming shows future-scheduled tasks grouped by date label, capped at 5 total items.
- Tapping an Upcoming row opens the item editor (no checkbox present).
- Tapping "View all" navigates to the full Upcoming screen.
- With no future-scheduled tasks, Upcoming tab shows "Nothing scheduled".
- Inbox card renders at roughly half its previous (full-row) width, square-proportioned, in both light and dark mode.
