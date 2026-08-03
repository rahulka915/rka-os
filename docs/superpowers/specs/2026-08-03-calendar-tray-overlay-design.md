# Calendar Timeblocking Tray → Big Overlay

## Problem

The Timeblocking tray (Calendar screen) currently expands inline, capped at
`maxHeight: 320`, pushing/sharing space with the day timeline below it. This
leaves too little room to comfortably browse unscheduled items before
dragging one onto the timeline.

## Design

Replace the inline-expanding panel with an overlay that floats on top of the
day timeline when the tray is expanded.

- **Trigger:** unchanged — tapping the "Timeblocking" section header still
  toggles `trayExpanded`.
- **Coverage:** the overlay is `position: 'absolute'`, anchored below the
  existing header + week strip + collapsed section bar (measured via the
  `topShell` `onLayout`), extending down to just above the tab bar. Header
  and week strip stay visible above it; the day timeline underneath is
  covered while the tray is open.
- **Contents:** dimmed backdrop (tappable to dismiss → collapses the tray)
  behind a `RiverStoneSurface` panel holding the same UNSCHEDULED / TODAY
  `TrayCard` lists as today, sized to the available height instead of the
  320px cap.
- **Drag-to-reveal:** dragging a `TrayCard` hides the overlay so the
  timeline (and its existing `dragHighlightMinutes` drop-target highlight)
  is visible to drop onto. The overlay reappears after the drag ends,
  regardless of whether the drop was committed or cancelled.
- **State:** a new `isDraggingFromTray` boolean, set `true` on the first
  `onDragUpdate` call and `false` on `onDragEnd`. Overlay visibility =
  `trayExpanded && !isDraggingFromTray`. Fade transition (~120ms) on both
  edges.
- **No changes** to data sources (`unscheduledItems`, `unscheduledEntries`)
  or drop logic (`computeDropTarget`, `updateTimelineItemSchedule`,
  `handleTrayDragUpdate`/`handleTrayDragEnd`) — this is purely a
  presentation change.

## Testing

Manual verification only (layout/interaction change, no new pure logic):
1. Open tray → overlay covers timeline, header/week strip stay visible.
2. Tap dimmed backdrop → tray collapses.
3. Drag a card → overlay hides, timeline + drop highlight visible.
4. Release on a valid slot → item scheduled, overlay reappears.
5. Release on an invalid/empty area (cancelled drag) → overlay reappears,
   no schedule change.
