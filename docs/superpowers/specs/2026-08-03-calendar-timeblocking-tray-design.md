# Calendar Timeblocking Tray — Design

**Date:** 2026-08-03
**Status:** Approved for implementation

## Context

Mobile's `CalendarScreen.tsx` (`apps/mobile/src/screens/CalendarScreen.tsx`) currently shows a "Timeblocking" card (lines 1293-1348) that's purely informational: three read-only stats — Blocks (`timelineEntries.length`), Done (completed count), and Flexible (unscheduled-for-today count). The timeline itself already supports drag-to-reschedule on cards already placed in it (`TimelineEntryCard`, lines 405-596, via `react-native-gesture-handler`'s `Gesture.Pan()`, calling `handleReschedule(entry, nextTime)` → `updateTimelineItemTime()`), and a FLEXIBLE section below the timeline already lists today's dateless-but-assigned-to-today items (lines 1381-1415, filtered by `entry.minutes == null`).

What's missing is a Notion-style "different view of the same database" experience: a single place to see and grab *any* task — including ones with no date at all — and drop it directly onto the timeline to schedule it. Web's `CalendarScreen.web.tsx` already has an equivalent pattern (`UnscheduledPane` + `DropRow`s, `apps/mobile/src/webApp/CalendarScreen.web.tsx`) using HTML5 drag-and-drop; this spec brings the same concept to mobile using touch gestures, reusing mobile's existing reschedule-drag math rather than introducing a new drag system.

**Platform scope: mobile only.** Web already has a working equivalent; reworking it to match is explicitly out of scope here.

## Data Model

No schema changes. One new query function, alongside `getRelatedItems`-style rollups already in `apps/mobile/src/db/database.ts`:

```typescript
// Rollup: every task-like item with no scheduledDate at all (Inbox + undated
// Tasks), matching the scope of the web app's UnscheduledPane — not date-scoped,
// unlike the Calendar screen's existing "Flexible" section (which only shows
// items already assigned to the viewed day but missing a time).
export function getUnscheduledItems(): Item[] {
  // WHERE scheduledDate IS NULL AND type IN ('task', ...) AND deletedAt IS NULL
  //   AND status NOT IN ('completed', 'archived')
}
```

No changes to `updateTimelineItemSchedule(id, scheduledDate?, time?)` — it already handles all three cases the tray needs (unschedule / date-only / date+time), confirmed in `apps/mobile/src/db/database.ts:1235-1284`.

## UI: Collapsible Tray

The Timeblocking card (`CalendarScreen.tsx:1293-1348`) is replaced by a collapsible panel in the same slot:

- **Collapsed (default):** a compact summary row — task count + unscheduled count (e.g. "12 tasks · 3 unscheduled") — tap to expand. Preserves the card's current footprint when not in use, so the timeline stays the primary view on a small screen.
- **Expanded:** a scrollable list in two groups:
  - **Unscheduled** — all items from the new `getUnscheduledItems()` query (Inbox + undated Tasks, app-wide, not date-scoped).
  - **Today** — the viewed day's already-scheduled items, including ones with no specific time (this absorbs the current FLEXIBLE section's data — the FLEXIBLE section below the timeline is removed since its content now lives in this "Today" tray group).
- Each card in either group uses the same visual style `TimelineEntryCard` already uses (icon, title, time-or-"Anytime"), and becomes a drag source.

## Interaction: Drag From Tray Onto Timeline

Every tray card gets a `Gesture.Pan()` handler, structurally the same one `TimelineEntryCard` already uses for in-timeline reschedule-dragging, adapted so the "vertical position → time" calculation is computed against the timeline's on-screen layout (captured via the timeline container's `onLayout`) rather than the card's own starting position — since the drag now originates outside the timeline, in the tray panel below/above it.

- **While dragging:** a floating preview card follows the touch point, reusing the existing reschedule-drag preview styling (no new visual language). The hour row currently under the touch point highlights, mirroring web's `dropTargetActive` hover treatment translated to a touch equivalent.
- **On release over an hour row:** calls `updateTimelineItemSchedule(id, viewedDate, time)` — same call the timeline's internal reschedule already makes, just with the tray-item's id.
- **On release over the "Anytime" row/bucket:** calls `updateTimelineItemSchedule(id, viewedDate, undefined)` — date only, no time, matching the existing date-only case.
- **On release outside the timeline** (e.g., back over the tray, or anywhere off-target): the drag cancels with no database write — same "no-op" behavior a cancelled reschedule-drag already has today.

## Out of Scope

- Web (`CalendarScreen.web.tsx`) — no changes; its existing `UnscheduledPane`/`DropRow` pattern is untouched and was only referenced here as prior art.
- Per-instance scheduling overrides for recurring/habit items — dragging a habit from the tray changes its base schedule (same caveat that already applies to any drag-reschedule today, per `updateTimelineItemSchedule`'s existing behavior); no new instance-level override UI is introduced.
- Multi-day date reassignment via a week-strip drop target — mobile's Calendar shows one day at a time with its own date navigation; dropping from the tray always targets the currently-viewed day, never a different day.
- Search/filter within the tray — the tray lists everything in its two groups with no filtering controls in this version.
