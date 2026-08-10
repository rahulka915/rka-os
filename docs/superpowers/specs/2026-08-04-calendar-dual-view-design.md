# Calendar dual-view (Calendar grid + Timeline)

## Goal

Give the Calendar tab a Home-style view switcher: a `Calendar` (month grid) view alongside the existing hour-by-hour `Timeline` view, so users can zoom out to a month and jump back into a specific day.

## Toggle

- New two-option segmented chip row (`Calendar` / `Timeline`), visually matching Home's `VIEW_CHIPS` pattern, placed in `CalendarScreen`'s header stack (below the month/nav row, replacing the week strip when `Calendar` is active).
- New local state `activeView: 'timeline' | 'calendar'`, default `'timeline'` — today's behavior is unchanged when the screen first opens.

## Timeline view

No behavior change. Existing week strip, Timeblocking tray, hour lanes, drag/drop, "Now" line all render exactly as today, just nested under `activeView === 'timeline'`.

## Calendar view (new)

- Reuses the existing header row (month/year label, chevrons, Today pill), but chevrons page by month instead of by week while this view is active.
- 7-column month grid, one row per week. Current-month days are full-opacity; adjacent-month leading/trailing days are dimmed (non-interactive or navigate-and-switch-month — TBD to whichever is simpler at implementation time, dimmed+tappable is fine).
- Each day cell: day number + a small dot/count badge if that day has any scheduled items (from the new count query below). Today gets the existing `CalendarDayBadge` "today" ring treatment; the currently-selected date gets the "selected" treatment.
- Tapping a day cell: sets `selected` to that date, switches `activeView` back to `'timeline'`. Existing auto-scroll-to-day effect (`CalendarScreen.tsx` around the `daySectionLayouts` effect) takes over and scrolls/centers on that day — no new scroll logic needed.

## Data

New query in `database.ts`: `getItemCountsForMonth(year: number, month: number): Record<string, number>` — maps `YYYY-MM-DD` → count of scheduled items that day, for the 42 grid cells' date range (leading/trailing days included so the grid never shows a blank dot-check). Lightweight (`COUNT` grouped by date), not the full `TimelineEntry` shape `useCalendar` returns — the grid only needs a badge, not full entry data.

## Explicitly out of scope

- No create/edit flows from the grid.
- No drag-and-drop onto grid cells.
- No infinite/virtualized multi-month scroll — chevron-paged single month only.
- No changes to Timeline's internals.

## Files touched

- `apps/mobile/src/db/database.ts` — add `getItemCountsForMonth`.
- `apps/mobile/src/hooks/useDb.ts` — add a small hook wrapping it (e.g. `useMonthItemCounts(year, month)`), matching existing hook conventions.
- `apps/mobile/src/screens/CalendarScreen.tsx` — add view-chip state, month-grid component, wire tap-to-jump.
