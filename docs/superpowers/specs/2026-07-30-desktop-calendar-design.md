# Desktop Calendar — Design Spec

## Goal

Enable the desktop sidebar's disabled "Calendar" placeholder: a day-at-a-time view with
prev/next/today navigation, a quick-schedule bar (title + time), and a flat time-sorted list of
that day's items, reusing the existing slide-over for editing.

## Context

Mobile's `CalendarScreen.tsx` is a 2000+ line drag/resize timeline grid — far more than desktop
needs for an MVP, and inconsistent with the flat-list pattern every other desktop screen (Home,
Inbox, Tasks, Areas/Projects) already uses. All the data plumbing already exists and works on
web: `useCalendar(date)` (`{ items, instances, timelineEntries, refresh }`), `createTimedItem`,
`updateTimelineItemTime`, `completeInstance`, `formatDate`, `formatTimeLabel`. **No new
database/hook code needed** — same shape as every prior desktop phase.

## Scope

Desktop/web only. Mobile untouched. A day view, not week/month — matches the "very minimal"
direction already set, and every other desktop screen is single-list, not grid-based.

## Components

### `Sidebar.web.tsx` (modify)

- `SidebarView` gains `'calendar'`.
- The Calendar nav row stops being `disabled`/showing "Soon" — becomes a real `Pressable` like
  Home/Inbox/Tasks, using the active-state highlight pattern.

### `CalendarScreen.web.tsx` (new)

- **Header**: `‹` / date label (e.g. "Thursday, July 30") / `›` day-navigation row, plus a
  small "Today" button (hidden when already viewing today) to jump back. Local `useState<string>`
  holding the viewed date (`YYYY-MM-DD`, via `formatDate`), prev/next just ±1 day.
- **Quick-schedule bar**: two inputs side by side — title (flex, placeholder "Schedule for
  [date]...") and time (fixed width, placeholder "09:00"). Enter on either submits:
  `createTimedItem('task', title, viewedDate, time || '09:00')`, then clears both and refreshes.
  Empty title is a no-op, matching every other capture bar's guard.
- **List**: `useCalendar(viewedDate).timelineEntries`, already time-sorted with untimed last (per
  `buildTimelineEntries`). Each row: time label (`entry.time` or "Anytime", muted, fixed-width
  left column) + title + checkbox. Checkbox toggles via `completeInstance(entry.instance.id)`
  when an instance exists, else falls back to `updateItemStatus(entry.item.id, ...)` — same
  dual-path mobile already uses for timeline entries. Row click opens the shared
  `DetailPanel`/`ItemDetailForm` on `entry.item` (consistent with every other screen — editing
  targets the item, not the instance). Empty state: "Nothing scheduled for this day."

### `AppShell.web.tsx` (modify)

- Render `<CalendarScreen />` when `activeView === 'calendar'`.

## Out of Scope

- No week/month grid, no drag-to-resize/reschedule, no multi-day view.
- No recurring-item creation UI (repeat rules) — quick-schedule only creates one-off timed items,
  same restriction as Home/Areas-Projects' capture bars only creating plain tasks.
- No timezone handling beyond what `formatDate`/`normalizeTimeInput` already do (local browser
  time, matching every other desktop screen).

## Self-Review

- **Placeholder scan:** none.
- **Consistency:** reuses `webColors`/`webSpacing`/`webRadius`/`webFontSize`, the same
  capture-bar/row/`DetailPanel` patterns as every prior phase.
- **Scope:** one new screen + two small edits, same shape as Home and Areas & Projects.
- **Ambiguity resolved:** checkbox completes via instance when present, else via item status —
  matches the exact fallback mobile's own timeline UI relies on, since `createTimedItem` always
  creates an instance but manually-triaged scheduled items (via `processInboxItem`) may not.
