# Experimental Home — Header + List-Switcher Tabs

## Problem

`HomeScreenExperimental.tsx` (the workflow-first Home redesign behind the
Profile toggle) currently only renders one view: Needs Doing + a timeline for
today. The user's reference screenshot specifies a header row (avatar → Me
tab, wordmark, dark-mode toggle, inbox button with unread badge) plus a
5-tab pill switcher (Today/Upcoming/Anytime/Someday/Logbook) above it,
turning the screen into a single flat state machine: one `activeView` value
picks the header content is unaffected by, drives which chip is highlighted,
and which section renders below.

## Design

### State

```typescript
type ExperimentalView = 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';
const [activeView, setActiveView] = useState<ExperimentalView>('today');
```

### Header row (top of screen, above everything else)

- Row: `justifyContent: 'space-between'`, `alignItems: 'center'`, padding
  `14px 20px 0`.
- Left: 36×36 circular button, `Settings` icon (Cog6Tooth, matching the
  reference screenshot exactly), fill-color background + 1px separator
  border → `onHeroPress` prop (wired in App.tsx to
  `navigation.navigate('Profile')`, same pattern `HomeScreen` already uses).
- Center: "RKA" wordmark, Georgia italic bold 15px, secondary/dim text
  color, letterSpacing 0.5.
- Right: `gap: 8` row of two 36×36 circular buttons (same fill/border
  style):
  1. Dark-mode toggle — `useThemeContext().toggle()`; icon is `Moon`
     (stroke `#9DB4FF`) when dark, `Sun` when light.
  2. Inbox button — `Inbox` icon, `onInboxPress` (existing prop). Badge:
     absolute top/right `-4`, red (`#D9506B`) circle, white 10px bold count,
     rendered only when `inboxCount > 0`.

### Chip row (directly beneath header)

- Horizontal `ScrollView` (`horizontal`, no scroll indicator), `gap: 8`,
  padding `16px 16px 6px`.
- 5 chips: Today / Upcoming / Anytime / Someday / Logbook. Each
  `flex-shrink: 0`, padding `6px 14px`, `borderRadius: 999`, 13px/600 text.
- Active chip (`activeView === chip.key`): filled background (a step
  lighter than page bg in dark mode / step darker in light mode — matches
  an iOS segmented-control "selected" look), full-contrast text.
- Inactive chips: transparent background, dim text.
- Tapping a chip sets `activeView`.

### Section bodies

One `activeView === 'x' ? ... : null` block per tab, all siblings in the
same outer `ScrollView`:

- **today**: existing content, unchanged (Inbox card, Needs Doing, timeline).
- **upcoming**: flat list from `getUpcomingItems(today)` — title + formatted
  scheduledDate, tap opens item via the existing `useOpenItem()`.
- **anytime**: flat list from `getItemsByStatus('active')` filtered to
  `!item.scheduledDate` — active items with no date, the GTD "anytime"
  bucket.
- **someday**: flat list from `getItemsByStatus('someday')`.
- **logbook**: flat list from `getCompletedItems()` — title + relative
  completed time.

All four new lists are plain rows (title + one line of metadata, tap to
open, no timeline/cards) — matching the "simple lists now, polish later"
scope decision. They reuse the screen's existing bespoke inline
dark/light color consts (`fg`/`dim`/`line`/`cardBg`), not the app's theme
tokens, consistent with this screen's existing "true visual reset"
approach (per its own header comment).

## Files touched

- Modify: `apps/mobile/src/screens/HomeScreenExperimental.tsx` (header,
  chip row, activeView state, 4 new list sections)
- Modify: `apps/mobile/App.tsx` (pass `onHeroPress` navigating to Profile,
  matching `HomeScreen`'s existing wiring)

## Out of scope (per user decision)

- Rich content for Upcoming/Anytime/Someday/Logbook (grouping, swipe
  actions, timeline-style cards) — flat lists only this pass.
- Any change to the production `HomeScreen.tsx`/`AppHeader.tsx` — this is
  scoped entirely to the experimental screen.
