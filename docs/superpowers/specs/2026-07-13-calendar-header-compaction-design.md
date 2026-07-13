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

---

## Addendum (2026-07-13, same session) — Japanese paper/bamboo visual pass on the compact header

Follow-up to the compaction above, same file, same explicitly-out-of-scope list (`TimelineEntryCard`, current-time line, drag/add affordances, `BottomSheet`, all DB/state logic). This pass restyles the already-compacted header — it does not add height back. Explored with inline mockups (widget-based, not the brainstorming browser companion) before implementation; final direction approved as "H" below.

### Header row (single line, same height as the compact pass)
`‹  MON   ·centered·   July   ·right·   13  ›` — three type registers in one row, no added height:
- **MON** (weekday) — small caps, wide letter-spacing, sans, positioned left of center, muted white
- **July** (month) — Georgia italic, dead-centered — reuses the same serif already used for the Home greeting (`RoninGreetingCard`'s Georgia italic), so this isn't a new font import
- **13** (date number) — large bold sans, right of center
- Chevrons (±7 days, unchanged handlers) sit at the outer edges as before
- Background: the sky-toned gradient already approved for direction B (`#1e56a0 → #173a70 → #0f0f1a`, matching `RoninGreetingCard`'s day-mode gradient — should key off the same time-of-day source, not a hardcoded value, so it changes with morning/day/night like the greeting card does), overlaid with a very faint (~5% opacity) diagonal line pattern evoking washi paper grain. Grain is header-only — never extends into the timeline.
- The gradient's bottom edge is a soft wave curve (SVG path or equivalent), not a hard rule — first real use of the checklist's still-unbuilt "wave/mountain" motif (`DESIGN_CHECKLIST.md`'s illustration-motif table), reusing that table's existing deep-blue-adjacent color language rather than introducing a new hue.

### Week strip — tear-away calendar pages
Each of the 7 day cells in `WeekStrip` becomes a small paper "page" instead of a plain circle:
- Cream/paper body (a fixed off-white, not a `colors.ts` token — this is the one deliberate departure from dark-surface tokens, justified by the paper motif; still needs distinct light/dark-safe values chosen so it reads as paper in both app modes)
- Colored top band with the day-of-week letter: neutral gray band by default, `deeperBlue` band for the selected/today cell, muted red band for Sunday (a nod to traditional 日めくり tear-calendars marking Sundays/holidays in red — deliberately muted so it doesn't collide with `DESIGN_CHECKLIST.md`'s existing red = torii/milestones convention)
- Date number in dark ink-like text on the paper body
- A thin "fold" line near the bottom of each page
- **Page-stack shadow**: 2 darker, slightly offset rects behind each page (visible top-left), suggesting torn pages stacked underneath. Selected day's stack shadow is blue-tinted; others are neutral.
- Selected/today cell is slightly taller than its neighbors (raised page effect)
- All 7 cells stay equal width with a fixed gutter — no per-cell size drift from the mockup's earlier alignment bug

### Today pill — repositioned, no added height
A slim, centered, `deeperBlue`-tinted pill directly under the week strip, sized into the vertical gap that already existed between the week strip and the stats row in the compacted version. Only rendered when `!isToday` — same conditional and same `setSelected(new Date())` handler as the compact pass, just moved from its old slot in the section bar.

### Timeblocking bar — bamboo accent
The compact section bar's plain left edge gets two thin vertical tan/gold strokes (bamboo-stalk suggestion) in place of the previous flat divider treatment. Purely decorative — label, hint text, Today button (when shown), and `+` create button keep their existing behavior/position from the compaction pass, only the leading accent changes.

### Explicitly not changing further
- Header total height stays equal to the already-shipped compact version — this pass must not grow it back
- Stats row (`{blocks} · {done} · {flexible}`) and its data source are unchanged
- Hour rows, `TimelineEntryCard`, current-time line, and the `BottomSheet` are untouched, same as the base compaction spec above

### Resolved implementation decisions
- **Gradient behavior — time-of-day driven (confirmed).** Reuses the same time-of-day source `RoninGreetingCard.tsx` already keys off (`RoninTimeOfDay`/`TIME_OF_DAY_TINT` — likely via `getTimeOfDayFromHour` already imported in `CalendarScreen.tsx` from `utils/time`, keyed off the live clock, not the selected date, matching how the greeting card behaves on Home). Header will look different in the morning vs. night, consistent with Home.
- Paper/cream color values for the tear-away pages need explicit light + dark-mode hex (not yet chosen — pick values that read as "paper" against both `colors.bg`/`darkColors.bg`)
- SVG vs. RN View/border-based approach for the wave-curve edge and page-stack shadows — likely SVG (`react-native-svg`, already a dependency per `KatanaProgressBar.tsx`) given the curve requirement

### Testing / verification (in addition to the base spec's checklist above)
- Tear-away day cells still call `onSelect(day)` correctly — verify by tapping a non-selected day and confirming timeline updates
- Verify paper cell colors pass basic contrast against their own top-band text and against both app background modes
- Confirm gradient/grain/wave rendering doesn't regress `onLayout`-based auto-scroll math from the earlier centering fix (header height must stay measured correctly)
- `npx tsc --noEmit` clean
