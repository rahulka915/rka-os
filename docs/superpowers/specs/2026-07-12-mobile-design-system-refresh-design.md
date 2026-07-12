# Mobile Design System Refresh — Design Spec

**Date:** 2026-07-12
**Scope:** `apps/mobile/` (React Native / Expo iOS app)
**Status:** Approved, pending implementation plan

## Purpose

Refresh the visual theme (color palette, typography, dark mode) of the iOS app. Interaction patterns and structure stay Things 3-inspired (flat lists, capture sheets, circle checkboxes, toolbars — see `THINGS_3_DESIGN.md`), but the *look* moves away from generic iOS blue/gray toward a warmer, more distinctive palette inspired by Moonly's visual language (deep, rich backgrounds + considered accent colors), without copying Moonly's specific gold/mystical theming.

**Feel like Things 3. Look like Moonly.**

## Current State

`apps/mobile/src/theme/colors.ts` defines:
- Light mode: warm-neutral bg (`#f6f5f1`) with **maroon** (`#a41e34`) as primary accent
- Dark mode: near-black bg (`#0a0a0b`) with a **silvery blue** (`#9fb8d1`) primary accent — already partially Moonly-inspired per an existing code comment
- Single-accent system: one `primary` color used everywhere, plus green/red/orange for semantic states

This predates this spec and only has one accent color. It gets superseded by the new 4-accent system below.

## New Color Palette

Four accent colors replace the single maroon/silvery-blue primary, giving the UI more range to express state and hierarchy without leaning on the same color for everything.

| Role | Light mode | Dark mode | Usage |
|---|---|---|---|
| Silver | `#808080` | `#c5c5c5` | Secondary/neutral emphasis, non-primary selected states |
| Deeper Blue | `#2b7ff0` | `#2b7ff0` | Primary actions, CTAs, primary selected states (replaces maroon/silvery-blue as the default primary) |
| Pastel Pink | `#ffb8d1` | `#ffb8d1` | Warm accent — personal/favorite/highlighted items |
| Bridging Purple | `#d4a8ff` | `#d4a8ff` | Balanced accent between blue and pink — tertiary emphasis |

Functional colors (unchanged, no updates needed):
- Success green, Error red stay as-is (`colors.green` / `colors.red` already close to target: `#34a853`/`#ff3b30` light, `#3dbb5e`/`#ff5147` dark).
- Orange stays — actively used in `CalendarScreen`, `MedicationsScreen`, and `PersistentTimerBanner` for its own semantic meaning (unrelated to the primary/accent refresh).

Background/surface tones shift slightly darker/richer in dark mode:
- Dark bg: `#0a0a0b` → `#0f0f1a` (subtle navy undertone instead of pure near-black)
- Dark surface: `#18181b` → `#1a1a2e`
- Light bg/surface: keep existing warm-neutral tones (`#f6f5f1` / `#ffffff`) — they already fit the direction, no change needed.

`primary` (used broadly across the app today) maps to **Deeper Blue** in both light and dark mode, replacing maroon (light) and silvery-blue (dark). This is the single biggest behavior change — anywhere `colors.primary` / `themeColors.primary` is referenced today will visually shift from maroon/silvery-blue to `#2b7ff0`.

Silver, Pink, and Purple are net-new tokens (`colors.silver`, `colors.pink`, `colors.purple` + `*Soft` variants matching the existing pattern) for use where a component wants a secondary/tertiary accent instead of primary — e.g., alternating list item accents, category tagging, non-primary selected states. Adoption of these three is opportunistic, not a forced pass over every screen.

## Typography Refinement

Current type scale (`fontSize` in `spacing.ts`: xs 12 / sm 14 / base 16 / lg 18 / xl 22 / title 24) stays as-is — sizes are fine. The refinement is in **line-height and letter-spacing**, which aren't currently defined as shared tokens (each screen sets its own inline).

Add to `spacing.ts` (or a new `typography.ts` if that reads cleaner — implementation plan should decide based on existing import patterns):
- `lineHeight`: body copy 1.5–1.6× font size, titles tighter (~1.1–1.2×)
- Title letter-spacing: slightly negative (~-0.3 to -0.5) for large titles (24px+), default (0) below that

This is a shared-token addition, not a rewrite of every screen's text styles — screens adopt the new tokens as they're touched, starting with the highest-traffic screens (Home, Inbox, Profile).

## Scope & Rollout

This is a **token-level + high-traffic-screen** change, not a full app rewrite in one pass:

1. **Foundation:** Update `colors.ts` (new palette + renamed/added tokens) and typography tokens. This alone shifts every screen using `colors.primary` / `themeColors.primary`.
2. **High-traffic screens:** Home, Inbox, Profile, QuickAdd — verify the new palette reads well against real content, adopt new silver/pink/purple accents where a secondary accent already exists conceptually (e.g. category colors, priority flags).
3. **Remaining screens:** Areas, Tasks, Projects, Calendar, Medications, Workouts, Menu — pick up the new tokens as touched; no dedicated pass required unless visual regressions appear.

Out of scope for this spec: Ronin 3D companion theming, onboarding flow, app icon/splash screen.

## Known Hardcoded Color Usages

A grep for `#a41e34`, `#9fb8d1`, `#007aff` found hardcoded (non-token) hex references in:
`MedicationTimerActivity.tsx`, `InboxScreenV2.tsx`, `MedicationsScreen.tsx`, `InboxScrollCard.tsx`, `WorkoutsScreen.tsx`, `NextUpCard.tsx`, `moodConfig.ts` (plus `colors.ts` itself, expected).

These bypass the token system and won't update automatically when `colors.ts` changes. The implementation plan should decide per-file whether to migrate to tokens now (preferred, keeps things in sync) or leave as a follow-up — call this out explicitly rather than silently missing them.

## Verification

- Visual check in both light and dark mode on-device or in Expo Go/dev client for Home, Inbox, Profile, QuickAdd
- Confirm existing Things 3 interaction patterns (circle checkboxes, swipe actions, capture sheets) are visually unaffected in structure — only color/type tokens change
