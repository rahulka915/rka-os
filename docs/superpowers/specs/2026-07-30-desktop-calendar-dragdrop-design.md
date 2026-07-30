# Desktop Calendar Drag-and-Drop Scheduling — Design Spec

## Goal

Rework the desktop Calendar screen into a two-pane "Notion-style linked view" workflow:
an unscheduled task backlog on the left, the selected day's hour-by-hour timeline on the
right, with native HTML5 drag-and-drop between and within them. Dragging a task onto an
hour row schedules it there; dragging a scheduled item back to the backlog unschedules it;
dragging between hour rows reschedules the time. Both panes read the same underlying items,
so they're always in sync — no separate state to reconcile.

## Context

The current `CalendarScreen.web.tsx` is a single-column day list with a text-input
quick-schedule bar (`YYYY-MM-DD` / `HH:MM` typed manually). That still works but isn't the
"drag to schedule" workflow the user wants. All the data primitives already exist and work
on web: `useCalendar(date)` (`timelineEntries`, time-sorted), `getUpcomingItems`/`useTasks`
for backlog candidates, `updateTimelineItemSchedule(id, date?, time?)` for both scheduling
and clearing. **No new database code** — this is a client-side drag-and-drop UI over
existing read/write functions, same shape as every prior desktop phase.

React Native Web doesn't have a first-class drag-and-drop API, but its `View`/`Pressable`
forward unrecognized props straight to the underlying DOM node, so native HTML5 DnD
(`draggable`, `onDragStart`, `onDragOver`, `onDrop`) works by passing those props through a
type-cast (`as any`) — an established pattern for reaching past RNW's web output when native
DOM behavior is needed, consistent with this file already being `.web.tsx`-only.

## Layout

Two panes side by side, replacing the current single list (header + quick-schedule bar stay
at the top, spanning both panes):

### Left pane — "Unscheduled"

- Items with no `scheduledDate` at all: Inbox items + active Tasks without a date (two
  small sub-sections, "Inbox" and "Tasks", each with its own label — reuses the same
  `useInbox()`/`useTasks()` hooks already used elsewhere).
- Each row is a draggable card (`draggable`, `onDragStart` sets `dataTransfer` to the
  item's id).
- The pane itself is also a drop target: dropping a scheduled item here clears its
  schedule (`updateTimelineItemSchedule(id, undefined, undefined)`), so dragging back out
  of the timeline un-schedules — a full round trip, not one-directional.
- Empty state: "Nothing unscheduled."

### Right pane — day timeline

- Same day-navigation header as today (`‹ Thursday, July 30 ›` + "Today" jump link).
- Hour rows from 06:00–23:00 (18 rows), each showing its hour label (`6 AM`, `7 AM`, ...)
  and any `timelineEntries` whose clock time falls in that hour, rendered as small cards
  (title + checkbox, same visual language as existing rows).
- An "Anytime" row above the hour rows holds entries with no clock time (date-only
  schedule) — dragging a task here sets the date but no time.
- Every row (Anytime + each hour) is a drop target: dropping an item sets
  `updateTimelineItemSchedule(id, viewedDate, hourTime | undefined)`. Dropping an
  already-scheduled item on a different row reschedules its time; dropping on the same
  row is a no-op state-wise (still safe to just re-call the update).
- Row click still opens the shared `DetailPanel`/`ItemDetailForm` (unchanged from today);
  the checkbox still toggles completion inline. Drag only intercepts pointer-drag gestures,
  not plain clicks, so both interactions coexist.

## Removed from the current screen

- The manual `YYYY-MM-DD` / `HH:MM` text-input quick-schedule bar is replaced by drag — but
  a lighter version stays: a single title input at the top ("Quick add for [date]...") that
  creates a new item straight into the Anytime row of the currently-viewed day (no manual
  time typing needed; drag it to an hour afterward if a specific time is wanted). This keeps
  fast capture without requiring the old two-field form.

## Interaction details

- **Drag payload**: `event.dataTransfer.setData('text/plain', item.id)` on drag start;
  read back via `event.dataTransfer.getData('text/plain')` on drop.
- **Visual drop feedback**: the row under the pointer highlights (`onDragOver` calls
  `event.preventDefault()` — required for `onDrop` to fire at all — and sets a local
  "hovered row" state for a background-color highlight; cleared on `onDragLeave`/`onDrop`).
- **No resize/duration drag**: dragging changes which hour a task starts at, not its
  duration — matches the existing data model (`durationMinutes` metadata isn't touched by
  this feature, same as it wasn't editable before).
- **Cross-day drag**: out of scope for this pass — drag only works within the currently
  viewed day's timeline and that day's backlog. Rescheduling to a different day still goes
  through opening the item and typing a date in `ItemDetailForm`'s Schedule field (already
  shipped).

## Out of Scope

- Cross-day drag (dragging a task from today's view onto a different day — there's only one
  day visible at a time).
- Resizing an event's duration by dragging its edges.
- Touch/mobile drag support — desktop/web only, consistent with the rest of this redesign;
  HTML5 DnD doesn't work on touch devices anyway, but this codebase's desktop scope was
  already browser/mouse-first.
- Multi-select drag (dragging several tasks at once).

## Self-Review

- **Placeholder scan:** none.
- **Consistency:** reuses `webColors`/`webSpacing`/`webRadius`/`webFontSize`, the existing
  row/checkbox visual language, and the same `DetailPanel`/`ItemDetailForm` click-to-edit
  pattern already shipped — drag is additive, not a replacement interaction language.
- **Scope:** single screen rewrite (`CalendarScreen.web.tsx`), no new files needed beyond
  the screen itself since it already owns its own row rendering.
- **Ambiguity resolved:** "unscheduled" is defined precisely as Inbox + dateless active
  Tasks (not e.g. Someday items or objects), since those are the two backlog sources the
  Calendar's own quick-add already fed into.
