# Components

**Interaction patterns** (capture sheets, flat lists, toolbars, circle checkboxes, swipe/context-menu behavior) are governed by [`apps/mobile/THINGS_3_DESIGN.md`](../../../apps/mobile/THINGS_3_DESIGN.md) — not repeated here. This file covers **visual/structural** component patterns that have graduated from `DESIGN_CHECKLIST.md` as settled.

Anything not listed below as settled is still being decided — check [`apps/mobile/DESIGN_CHECKLIST.md`](../../../apps/mobile/DESIGN_CHECKLIST.md)'s per-screen/per-component checklist before assuming a pattern is final.

## River Stone surfaces

`apps/mobile/src/components/ui/RiverStoneSurface.tsx` — the shared elevated-surface primitive that replaced generic rounded rectangles across Home and the app shell. It supplies **shape and light only** — never color. Anything with a deliberate color of its own (hero gradients, scene photos, per-block accent tints) passes `backgroundColor="transparent"` and keeps its own color.

**Geometry rule:** every surface uses an **asymmetric-but-point-symmetric** corner radius — top-left pairs with bottom-right (one value), top-right pairs with bottom-left (a smaller value), not four independent corners. This reads as "carved, not perfectly geometric" while staying recognizable as a card.

| Variant | Major/minor radius | Used by |
|---|---|---|
| hero | 36/22 | `RoninGreetingCard.tsx` |
| card | 26/17 | `NextUpCard.tsx`, `InboxScrollCard.tsx` |
| list | 17/13 | `TimelineSection.tsx` time-block header rows |
| chip | 20/16 | icon+label pill inside a time-block header |
| tray | 32/24 | `App.tsx`'s `AppleTabBar` |
| header | 20/14 | `AppHeader.tsx` |

**Materials:** dark = graphite `stoneSurface` `#1c1c22`; light = warm pale stone `#f3efe4` (see [`tokens.md`](tokens.md)). No borders anywhere in the primitive.

**Explicit exception:** individual task rows inside an expanded time block stay flat, no card/shadow — per `THINGS_3_DESIGN.md`'s "flat rows, no cards" rule. Only the colored, tappable block-header containers count as surfaces.

**RN platform constraints** (don't try to pixel-match the original CSS mockup — RN can't do these): no native inset/multi-layer `box-shadow`; rim highlight/shadow are plain clipped `View`s, not a shadow trick; per-corner radial ambient occlusion was dropped as not worth an `onLayout`-tracked SVG overlay for a barely-visible gain.

**Not yet adopted:** dialogs, sheets, and `MenuScreen`/`ProfileScreen`/`MedicationsScreen`/`CalendarScreen`'s own cards — per the original brief, adopted incrementally as those screens get touched, not in one sweep.

## Hero card color system — `RoninGreetingCard.tsx`

Two independent color axes, not one mood-driven hue swap (that was tried and rejected — see [`decision-log.md`](decision-log.md)):

- **Base gradient — time-of-day** (`TIME_OF_DAY_TINT`): morning `#40311f→#1c150e`, day `#1e56a0→#4fa8f5`, night `#1c1c32→#0f0f1a` (matches app dark surface/bg tokens).
- **Accent — mood** (`moodConfig.accentColor`), layered as a small corner glow, status dot, hanko seal tint, and katana progress-bar fill — never the whole background: normal `#9aa0aa`, alert `#d9a13f`, tired `#6b6fb0`, focused `#3a8ff2`, overwhelmed `#e2534a`, resolved `#3fbb63`.

The corner also carries a time-of-day motif icon (sun/crescent, `TimeOfDayMotif.tsx`) and a small hanko seal (kanji 武).

## Time-block color system — `TimelineSection.tsx`

Home's "TODAY" card's four time blocks, each with its own icon and accent color, bled through the header chip, count number, checkbox rings, and a full-row background tint (picked as "Bold + full-row" after comparing 3 palettes × 3 bleed depths):

| Block | Icon | Light | Dark |
|---|---|---|---|
| Anytime | `StoneIcon` | `#6E6E6E` | `#a8a8a8` |
| Morning | `SunriseIcon` | `#E0A73D` | `#F0BE5E` |
| Afternoon | `FanIcon` | `#D65A2E` | `#F07850` |
| Evening | `MoonStarIcon` | `#2A2A72` | `#6D6DD6` |

## Dock icon color system — `apps/mobile/src/components/icons/DockIcons.tsx`

Icon-only tab bar (no labels). Color mode is **selected-color state**: hex values below only apply to the active tab (plus a soft `color + '22'` badge); inactive tabs render neutral/muted. Exception: the FAB is always RKA blue regardless of state, since it's a fixed primary action, not a nav destination.

| Section | Icon | Color when active |
|---|---|---|
| Home | Torii gateway | Lacquer red `#C44545` |
| Calendar | Sun dial | Ritual gold `#D4B078` |
| More | Ensō (Zen circle) | Archive jade `#4E9E86` |
| Me | Ronin mon/portrait | RKA blue `#2b7ff0` |
| Create (FAB) | Calligraphy brush | RKA blue, always |

## Still in progress

Illustration motif cards (torii/blossom/wave), most screen-level restyles beyond Home/Inbox, and every UI primitive except what's listed above — see `DESIGN_CHECKLIST.md`'s live checklist rather than assuming anything not listed here is settled.
