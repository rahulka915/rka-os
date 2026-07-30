# Mission Icons & Area Badge

**Date:** 2026-07-30
**Status:** Approved (design), pending implementation plan

## Problem

On the Missions screen (`apps/mobile/src/screens/ProjectsScreen.tsx`), every mission row renders the identical hardcoded `ProjectPortfolioIcon` regardless of content, and a mission's linked Area (`itemRelations`, `relationType: 'area'`) is never shown on the row even though it's already settable via the long-press "Move to Domain..." action.

## Goals

1. Missions default to a plain, neutral placeholder icon instead of the current ornate book icon.
2. Users can set a custom emoji icon per mission, editable from the mission's detail screen.
3. Rows show a text chip badge with the mission's Area name, when one is set.

## Non-goals

- Curated custom icon-set (icons stay emoji-only for now).
- Per-item custom icons on Areas or other Lens screens (the `LensSurface` icon slot is added generically, but only wired up for Projects).
- Area color-coding (areas have no color field today; chips are neutrally styled).

## Design

### 1. Default icon

Add a new icon component, `ProjectPlaceholderIcon` (`apps/mobile/src/components/icons/`), a plain folder/target-outline glyph matching the existing icon set's line weight. Replaces `ProjectPortfolioIcon` as the fallback whenever a mission has no custom emoji set. `ProjectPortfolioIcon` itself is left in place (still used elsewhere, if applicable) — just no longer the Missions-row default.

### 2. Custom emoji icon

**Data model:** Add `icon?: string` to the `project` item's `metadata` JSON blob (`apps/mobile/SCHEMA.md` — no new column, no migration; follows the existing type-specific metadata pattern). Holds a single emoji character.

**Editing UI:** `ProjectDetailScreen.tsx` currently renders its header via `LensSurface`, which has no icon slot. Extend `LensSurfaceProps` with an optional `icon?: ReactNode` slot rendered in `headerLeft`, next to the title. Wire it up only in `ProjectDetailScreen` for now.

The icon slot in `ProjectDetailScreen` is a `TouchableOpacity` showing the mission's current emoji (or the new placeholder icon if unset). Tapping it focuses a minimal, visually-hidden `TextInput` configured to bring up the system emoji keyboard (a standard RN technique — an offscreen/zero-size `TextInput` that still receives keyboard focus). On text change, take the first emoji-containing character(s) entered, write to `metadata.icon` via the existing item-update path, persist, and blur/dismiss the keyboard. No new library dependency.

**List display:** `ProjectsScreen.tsx`'s `renderRow` reads `item.metadata?.icon`. If set, render it as large emoji text in place of the icon component; otherwise render `ProjectPlaceholderIcon`.

### 3. Area badge

`ProjectsScreen` already loads `areas` via `useAreas()`. In `renderRow`, resolve the mission's area via `getRelation(item.id, 'area')` and look up its title from the loaded `areas` list. If found, render a small rounded pill (neutral muted background, small text) showing the area title, positioned next to or beneath the mission title within the row. No badge is rendered when no area is set.

## Data flow

- Read: `ProjectsScreen` reads `item.metadata.icon` and `getRelation(item.id, 'area')` per row (both already-available, synchronous/local lookups — no new queries).
- Write: `ProjectDetailScreen`'s emoji picker writes `metadata.icon` through the existing item-update function used elsewhere for metadata changes, then refreshes.

## Testing

- Manual verification in the iOS simulator/dev build (per project convention — no automated UI test suite for this app):
  - New mission shows placeholder icon and no area chip.
  - Setting an emoji on the detail screen updates the row icon in the list.
  - Setting/removing an Area via "Move to Domain..." shows/hides the chip correctly.
  - Verify no regression to `ProjectPortfolioIcon`'s other usages (`CalendarScreen`, `AreaDetailScreen`, `MenuScreen`, `UpNextCard`, `ItemEditorSheet`) — only the Missions-list row switches to the new placeholder/emoji logic; the component itself is untouched.
