# Home Today Tab Drag-to-Reorder

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

`TodayCard`'s Today tab (`apps/mobile/src/components/home/TodayCard.tsx`) renders today's tasks in a fixed order (overdue-first, then insertion order) with no way to manually reorder them, unlike Tasks/Missions screens elsewhere in the app which already support drag-to-reorder.

## Goal

Add drag-to-reorder to the Today tab, reusing the app's existing reorder infrastructure (`useHapticReorder`, `applyManualOrder`/`setManualOrder`, `NestedReorderableList`) exactly as `TasksScreen`/`ProjectDetailScreen` already use it.

## Non-goals

- Upcoming tab reorder — out of scope per explicit decision; it's a 5-item capped preview of a screen (`UpcomingScreen`) that has no reorder concept of its own, so reordering the truncated preview would be misleading.
- Any change to `UpcomingScreen.tsx`, `TasksScreen.tsx`, or `ProjectDetailScreen.tsx` — this only touches `TodayCard.tsx` and its `HomeScreen.tsx` wiring.

## Design

### Sort behavior change

The current `sortTodayItems()` (overdue-first, then prop order) is replaced by the same pattern `TasksScreen` uses for its Active/Someday sections:
- On every change to the `items` prop, `TodayCard` calls `applyManualOrder('home:today', items)` (`apps/mobile/src/db/database.ts`) into local state (`useState` + `useEffect`), which returns items in their previously-persisted manual order (falling back to `items`' incoming order for any items with no stored position — i.e. new tasks land at the end, existing manual order is preserved).
- `useHapticReorder('home:today', <local state>, <setter>)` (`apps/mobile/src/hooks/useHapticReorder.ts`) drives the actual drag gesture, haptics, and persistence (`setManualOrder`, which also pushes to Firestore — already handled inside the hook, no new sync code needed).
- Overdue tasks (`item.status === 'overdue'`) keep their red title styling — that's per-row styling, independent of order — but no longer auto-jump to the top.

### Rendering change

The Today tab's row list changes from a plain `View`/`.map()` to `NestedReorderableList` (`react-native-reorderable-list`, already a dependency) — "Nested" because Home's outer scroll container is itself `ScrollViewContainer` from the same library (`HomeScreen.tsx`), the same nesting `TasksScreen` already has for its own tab-switched sections. `scrollable={false}` on the nested list, matching `TasksScreen`'s usage.

`TodayTaskRow` gains a `DragHandleButton` (`apps/mobile/src/components/ui/DragHandleButton.tsx`, already shared by `TasksScreen`/`ProjectDetailScreen`) at its trailing edge — a long-press-and-drag handle, so dragging doesn't conflict with the row's existing tap-to-open or the checkbox's tap-to-complete. `useReorderableDrag()` (used inside `DragHandleButton`) requires the row to be its own component, which `TodayTaskRow` (already `memo`-wrapped) already is.

The Upcoming tab's rendering is untouched (still a plain `View`/`.map()`, no drag handle, no reorder).

## Testing

Manual verification in the simulator/dev build (project convention):
- Drag a task by its handle to a new position in the Today list — confirm it moves, haptics fire, and the order persists after closing/reopening the app (or backgrounding and returning to Home).
- Confirm tapping the checkbox still completes a task, and tapping the row title still opens it, without triggering a drag.
- Confirm an overdue task's title still renders red regardless of its position.
- Confirm the Upcoming tab still has no drag handles and behaves as before.
- Add a new task for today and confirm it appears in the list (at the end, per `applyManualOrder`'s fallback for items with no stored position) without disturbing the existing manual order of the rest.
