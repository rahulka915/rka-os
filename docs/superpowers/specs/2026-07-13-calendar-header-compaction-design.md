# Calendar screen — header compaction (layout pass)

**Scope:** `apps/mobile/src/screens/CalendarScreen.tsx`, `topShell` region only (the month nav, week strip, and summary card currently rendered above the `ScrollView`). This is a layout optimization, not a redesign — no new features, no visual restyle beyond spacing/hierarchy, no changes to interaction model.

**Explicitly out of scope (must remain untouched):** `TimelineEntryCard`, the live current-time line/pill, drag-to-reschedule and add-slot affordances, the create/edit `BottomSheet`, all DB/state logic (`useCalendar`, draft state, handlers).

## Problem

The header region (month nav + week strip + summary card with title/subtitle/stats/hint) consumes a large share of vertical space before the timeline — the actual primary interaction surface — even begins. On a phone screen this pushes most of the day out of view without scrolling.

## Design

Collapse three stacked blocks (`monthNav`, `WeekStrip`, `summaryCard`) into two compact rows plus the week strip, with all functionality preserved:

### 1. Combined month/date nav (replaces `monthNav` block)
Single row: `‹  July · Monday 13 Jul  ›`
- Left/right chevrons keep their existing `onPress` (±7 days) and hit targets — unchanged handlers, `ChevronLeft`/`ChevronRight` icons.
- Center text becomes one line combining month (`MONTHS[selected.getMonth()]`) and the existing `selectedLabel` (weekday + short month + day), separated by `·`.
- **Today indicator:** when `isToday`, render a small inline pill/accent-colored "Today" tag directly after the date text (not a second line) — reuses `palette.blue`/`blueSoft` like the existing today-dot convention in `WeekStrip`. When not today, no pill (chevron row is otherwise identical).

### 2. Week strip
`WeekStrip` component is unchanged — already compact, keeps day-jump navigation.

### 3. Compact inline stats row (replaces the 3 `statChip` cards)
Single low-profile row, no card backgrounds/padding: `{blocksCount} Blocks · {doneCount} Done · {unscheduledEntries.length} Flexible`, small icons optional, `textSecondary`/`text` coloring consistent with existing stat values. Same three numbers, same live data — just laid out inline instead of as three bordered chips.

### 4. Simplified Timeblocking section header (replaces `summaryTitleWrap` block)
Drop the `TIMEBLOCKING` eyebrow, the large `summaryTitle` (date — now redundant with #1), and the paragraph-length `summarySub`. Replace with one slim row:
- Small label (e.g. "Timeblocking" or similar, de-emphasized)
- The existing `+` create button (`fabButton`, `openCreate()`), moved here from its previous slot in `summaryTopRow`
- The existing `Today` jump-back button, when `!isToday`, folds in here too (still `setSelected(new Date())`, same haptic)

### 5. Shortened helper text
`"Drag blocks by the grip. Time snaps to quarter hours."` → a shorter phrase (e.g. "Drag to reschedule · snaps to 15m"), smaller/muted, single line, no dedicated row-height budget beyond what the text needs.

### Net effect
All header chrome (nav + stats + hint) becomes visually lighter and shorter; every pixel saved is returned to the `ScrollView`/timeline below by virtue of removing height from `topShell`, not by shrinking the timeline itself.

## Data / logic

No changes to `useCalendar`, `draft` state, `handleComplete`/`handleMove`/`handleReschedule`/`handleDelete`/`handleMoveToNow`, `saveDraft`, or any DB call. Purely JSX/StyleSheet restructuring in the render function between the top of `CalendarScreen`'s return and the `ScrollView`, plus corresponding style rule edits/removals in the `StyleSheet.create` block (old: `monthNav`, `monthCenter`, `monthTitle`, `monthSub`, `summaryCard`, `summaryTopRow`, `summaryTitleWrap`, `summaryEyebrow`, `summaryTitle`, `summarySub`, `summaryActions`, `todayButton`, `todayButtonText`, `summaryStats`, `statChip`, `statValue`, `statLabel`, `summaryHintRow`, `summaryHint` — most removed/replaced with slimmer equivalents).

## Testing / verification

Layout-only change with no new logic — verify visually in the preview (light + dark mode), confirm:
- Both week-nav arrows still move ±7 days
- Week strip day taps still select that day
- Today pill/button still returns to today and only appears when relevant
- Create (`+`) button still opens the create sheet
- Stats numbers match live `blocksCount`/`doneCount`/`unscheduledEntries.length`
- `npx tsc --noEmit` clean
