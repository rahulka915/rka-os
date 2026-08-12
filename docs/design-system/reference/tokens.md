# Tokens

**Source of truth is the code, not this file.** This page explains and cross-references; if a value here ever disagrees with the code, the code wins and this page is stale.

- Color: [`apps/mobile/src/theme/colors.ts`](../../../apps/mobile/src/theme/colors.ts)
- Spacing / radius / type scale / shadows: [`apps/mobile/src/theme/spacing.ts`](../../../apps/mobile/src/theme/spacing.ts)
- Tamagui-facing mirror of the same values: [`apps/mobile/tamagui.config.ts`](../../../apps/mobile/tamagui.config.ts)

Both `colors.ts` and `tamagui.config.ts` must be kept in sync by hand (there are two rendering paths — Tamagui components read tokens/themes, plain `StyleSheet` components read `getThemeColors()` directly). If you change one, change the other in the same pass. `DESIGN_CHECKLIST.md` recorded a real bug where these drifted (`tamagui.config.ts` still had a completely different, pre-refresh palette) — check both whenever colors change.

## Accent palette

One shared set of accent hex values across light and dark mode — only `bg`/`surface` differ by mode.

| Token | Value | Role |
|---|---|---|
| `deeperBlue` (aka `blue`) | `#2b7ff0` | Primary accent, used everywhere a single brand color is needed |
| `silver` | `#808080` (light) / `#c5c5c5` (dark) | Neutral / secondary accent |
| `pink` | `#ffb8d1` | Warm accent |
| `purple` | `#d4a8ff` | Bridges blue and pink |
| `green` | `#34a853` (light) / `#3dbb5e` (dark) | Success |
| `red` | `#ff3b30` (light) / `#ff5147` (dark) | Error |
| `orange` | `#ff9500` (light) / `#ff9f5a` (dark) | Warning |

`deeperBlue` is still the shipped primary, but per `DESIGN_CHECKLIST.md` it is **not yet finalized** — `#002FA7` and `#102A96` (a more uniform/"military" blue direction) are candidates under review. Don't treat `#2b7ff0` as permanently locked in; check `DESIGN_CHECKLIST.md`'s "Primary blue" table for the current status before assuming it's final. Once a primary is chosen for good, that decision (and why the alternatives were rejected) belongs in [`decision-log.md`](decision-log.md), and this file's wording should drop the "still under review" caveat.

## Surface & structural tokens

`bg`, `surface`, `bgElevated` are theme-mode pairs (see `colors.ts`/`darkColors`) — not part of the accent set above. One structural token worth calling out specifically:

- **`stoneSurface`** — `#f3efe4` (light) / `#1c1c22` (dark). Deliberately neutral/warm-gray, distinct from the blue-tinted `surface` token. Backs the River Stone surface primitive (see [`components.md`](components.md)) for any component that doesn't already carry its own deliberate color.

## Spacing scale

`$0`–`$9` = `0, 4, 8, 12, 16, 20, 24, 28, 32, 36` pt. Two named exceptions: `sheetHeaderBottom` (14) and `compact` (10). Used via Tamagui `gap`/`padding` props on `XStack`/`YStack`; plain `StyleSheet` components use the literal pt values from `spacing.ts` directly.

## Radius scale

| Token | Value | Use |
|---|---|---|
| `control` | 10 | buttons, inputs |
| `card` | 12 | generic cards |
| `surface` | 18 | River Stone surfaces (base) |
| `floating` | 24 | floating elements |
| `sheet` | 28 | bottom sheets |
| `pill` | 999 | fully-rounded chips/pills |

Note River Stone surfaces use their own **per-variant asymmetric radius pairs** (major/minor corners), not this flat scale directly — see [`components.md`](components.md) for the geometry rule.

## Type scale

`fontSize`: `xs 12 / sm 14 / base 16 / lg 18 / xl 22 / title 24`. Line-height and letter-spacing are separate multiplier/absolute tables in `spacing.ts` — see that file for exact pairing rules (e.g. tight tracking only applies at `xl` and above).

**Typeface:** Inter, app-wide, shipped 2026-07-13 (`Inter_300Light` through `Inter_800ExtraBold`, loaded via `useFonts()`, resolved through Tamagui's `interFont` face map). A two-font greeting experiment (Shippori Mincho + Cormorant Garamond) was tried and explicitly reverted — see [`decision-log.md`](decision-log.md). Two named exceptions still intentionally use a different typeface and were *not* migrated to Inter: `InboxScreenV2.tsx`'s Georgia italic title, and `RoninGreetingCard.tsx`'s Georgia italic greeting/name.

## Shadows

Four presets in `spacing.ts` — `soft`, `elevated`, `floating`, `sheet` — each a full RN shadow object (`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`/`elevation`). River Stone surfaces use their own per-variant shadow tuning rather than these presets directly — see [`components.md`](components.md).

## Desktop web app tokens

The desktop web app (`src/webApp/`) has its own token file, [`apps/mobile/src/theme/webTheme.ts`](../../../apps/mobile/src/theme/webTheme.ts), separate from the native `colors.ts`/`spacing.ts` above (two different rendering targets). As of 2026-08-12 its values are **deliberately aligned to the native River Stone language** rather than the old standalone "warm-minimal" cream/amber palette it shipped with — the goal is that iOS and web read as the same product. Values are exposed as CSS custom properties (`--rka-*`), so re-theming every web screen is a single edit to `WEB_THEME_CSS` with zero per-screen changes.

Key mappings (see the file for the full light/dark tables):

- **Brand/interactive accent** = restrained **vermilion** (`#A8402C` light / `#C1503A` dark), matching the native active-nav/brand accent (`colors.ts`'s `vermilion`) — **not** the old amber `#D97706`. This is the single `--rka-accent` used across all ~53 interactive call sites (buttons, links, active nav, checkboxes).
- **Surfaces** = warm River-Stone neutrals; **background** matches native (`#F6F5F1` light / `#0B0E16` dark); **warning** carries brass, not amber.
- **`webDepth`** (`list`/`card`) — CSS `boxShadow` recipes mirroring the native River Stone `list`/`card` shadow variants (stacked contact + ambient drop shadow + a faint top light-catch via `inset` highlight). Applied to list rows and cards so web surfaces read as raised graphite stone, not flat fills. Pair with `webColors.card` as the base; drop the old 1px border when applying.
- **`webSunset`** — a peach→amber→dusty-rose gradient sampled from the Ronin scene art, used **only** for the Home hero stage (the future Rive scene mount) as an "adaptive" warm halo that melts into the dark shell; the rest of the app stays on the dark River Stone tokens. See [decision-log](decision-log.md) 2026-08-12.
- **Icons** — the web sidebar uses the **same destination artwork as iOS** (torii, inbox soft-object, note, sundial, bonsai, kettlebell, prayer beads, furoshiki, treasure chest, pill bottle, portfolio, gear) via [`src/webApp/navArtwork.web.tsx`](../../../apps/mobile/src/webApp/navArtwork.web.tsx), not generic Lucide glyphs. The artwork is colourful/3D and never tinted, so active state is the row highlight + bold label, exactly as on iOS.
