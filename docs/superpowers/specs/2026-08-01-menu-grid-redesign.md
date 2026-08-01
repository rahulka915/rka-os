# Menu ("More") Screen Grid Redesign

**Date:** 2026-08-01
**Status:** Approved (design), pending implementation plan

## Problem

`MenuScreen.tsx` (the "More" tab) currently renders a decorative header (enso motif image, gradient background, "More" title/subtitle) followed by a single-column stacked list of destination rows (icon, label, subtitle, chevron). With 9 destinations, the list requires a lot of scrolling and each row spends most of its height on a subtitle that isn't essential to recognizing the destination.

## Goal

Remove the decorative header entirely and replace the single-column list with a 3-per-row grid of compact square cards (icon + label only), so more destinations are visible at once without scrolling.

## Non-goals

- No changes to the destinations themselves (same 9 routes, same icons, same accent colors, same navigation behavior).
- No changes to `MenuStack.tsx` routing.
- No changes to other screens' headers or list styles — this is scoped to `MenuScreen.tsx` only.

## Design

### Header

The entire `RiverStoneSurface variant="header"` block (motif image, gradient background, "YOUR SYSTEM" eyebrow, "More" title, "Libraries, routines and records" subtitle) is removed. The screen's `ScrollView` starts directly with the section label row.

### Section label

The existing `sectionHeading` row (a short rule, "COLLECTIONS" label, and "N destinations" count) is kept as-is, now the first thing on screen instead of sitting below the header. It costs one line and keeps the screen oriented.

### Grid

The `list`/`rowStone` single-column mapping is replaced with a 3-column grid (`flexDirection: 'row', flexWrap: 'wrap'`, each card `width: '31%'` with row/column gaps — matches 3-per-row with even gutters at any device width without needing a fixed pixel size).

Each card:
- `RiverStoneSurface variant="card"` (the same square-tile treatment `InboxScrollCard.tsx` already uses elsewhere on Home — reused, not reinvented), roughly square (`aspectRatio: 1`).
- Centered icon in its existing accent-tinted frame (`iconFrame` style, `backgroundColor: soft`, `borderColor: ${accent}38`) — same frame styling as today, just centered in the card instead of left-aligned in a row.
- Label below the icon, centered, `numberOfLines={2}` (some labels like "Medications" may need to wrap at this width).
- No subtitle, no chevron, no accent dot — the icon's own tint already carries the accent; chevrons read as list affordances, not grid ones.
- Same `TouchableOpacity` + haptic + `navigation.navigate(route)` behavior as today, same `accessibilityLabel` (still includes the subtitle text for screen readers even though it's not shown visually, so accessibility doesn't regress from removing it visually).

### Removed code

`MENU_MOTIF` require, the `LinearGradient` import/usage, and all header-specific styles (`headerStone`, `headerContent`, `headerMotif`, `headerCopy`, `eyebrowRow`, `bambooMark`, `bambooLine`, `eyebrow`, `headerTitle`, `headerSubtitle`) are deleted along with the header JSX block. The `sub` field stays in each `menuItems` entry (still used for the accessibility label) but its `Text` element and `sub`/`trailing`/`accentDot`/`rowStone`/`rowContent` styles are removed from the row rendering, replaced by new grid/card styles.

## Testing

Manual verification in the simulator/dev build (project convention — no automated UI test suite):
- Menu tab opens directly into the grid, no header art, no title text.
- 9 cards arranged 3 per row (3 full rows), each showing icon + label only.
- Tapping any card navigates to its existing destination, unchanged.
- Labels that could wrap (e.g. "Medications", "Domains") render legibly at the smaller width.
- Light and dark mode both look correct (card background/border via `RiverStoneSurface`'s existing `mode` prop, already theme-aware).
- VoiceOver announces each card's full accessibility label (label + subtitle text), confirming the subtitle didn't just vanish from accessibility along with its visual removal.
