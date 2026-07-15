# Logbook (Completed Items View) — Design

## Problem

Completing a task or inbox item is currently a one-way, non-reversible action: `updateItemStatus(id, 'completed')` flips `status` and the item disappears from every list (`useTasks()` filters out `status === 'completed'`). There is no way to see what was completed, when, or to undo an accidental check-off. Things 3 solves this with a "Logbook" — a persistent, browsable history of everything completed, with restore always available. This spec adds the equivalent to RKA OS mobile, styled to match the app's existing dark/warm theme (Things 3's *interaction model*, not its visual language).

## Scope

- Applies to **all** items that can reach `status === 'completed'` (tasks and inbox items today; anything else that adopts the same status field later gets it for free).
- Lives inside the existing Tasks screen as a second tab, not a new nav destination or bottom-nav entry.
- Medications are out of scope — they don't use status-based completion (they log doses via `activityLogs` and never set `status = 'completed'`).

## Data layer

- Add a nullable `completedAt: number` column to the `items` table (SQLite migration, mirrors existing `archivedAt`/`deletedAt` pattern).
- `updateItemStatus(id, status)` (`apps/mobile/src/db/database.ts:995`):
  - When `status === 'completed'`: also set `completedAt = Date.now()`.
  - When the item's *previous* status was `'completed'` and the new status is not: clear `completedAt = null`.
  - No change to existing callers' signatures — this is internal to the function.
- New hook `useCompletedItems()` in `apps/mobile/src/hooks/useDb.ts`, sibling to `useTasks()`: live query for `status === 'completed'`, sorted by `completedAt` descending.

## UI — Tasks screen

- Add a segmented control at the top of `TasksScreen.tsx` (below the `LensSurface` title) with two options: **Tasks** / **Logbook**. Use the app's existing pill/segmented-toggle visual pattern (match whatever component/style is already used for similar toggles elsewhere in the app, e.g. Calendar's day selector chip style) — flat, rounded, `palette.fill` background with `palette.surface` active-segment highlight, Inter font.
- **Tasks tab** (default): unchanged — existing ACTIVE / SOMEDAY sections.
- **Logbook tab**: replaces the scroll content with day-grouped sections sourced from `useCompletedItems()`:
  - Group headers: `TODAY`, `YESTERDAY`, then `MMMM D` (e.g. `JULY 12`) for anything older, using the same `sectionLabel` style as ACTIVE/SOMEDAY.
  - Each row reuses the existing row shell (`styles.row` / `styles.rowContent`) with two visual changes: title gets `textDecorationLine: 'line-through'` and color drops to `palette.textSecondary` (instead of `palette.text`); the `LacquerDiscControl` renders in its completed/filled resting state (no fill animation replay).
  - Project subtitle (`rowSub`) stays visible, same as active rows, unchanged.
  - Empty state when no completed items exist: reuse the existing `empty` style block, text "Nothing completed yet".

## Restore flow

- Tapping the `LacquerDiscControl` on a Logbook row calls `updateItemStatus(id, 'active')` (clearing `completedAt`), then `refresh()`.
- Same collapse/fade-out row animation already used for completing (`itemHeight`/`itemOpacity` pattern) plays in reverse — the row leaves the Logbook list. No confirmation dialog, no undo-the-undo affordance; this mirrors the existing one-tap symmetry of completing.
- Restored items reappear in the Tasks tab's ACTIVE section on next view (via `useTasks()`'s live query).

## Out of scope / explicitly deferred

- No swipe-to-restore gesture (tap-only, matching how completion itself is tap/swipe on the *Tasks* tab but the Logbook only needs the simpler tap affordance since there's no "un-swipe" convention).
- No bulk-restore or bulk-delete-from-logbook.
- No search/filter within the Logbook.
- No separate Logbook entry in bottom nav or Menu screen.
- Recurring/habit-specific reset-on-complete behavior remains unaddressed (per existing `rrule` gap noted in `SCHEMA.md`) — out of scope for this spec.
