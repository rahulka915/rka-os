# Home Screen Visual Redesign (Mobile) — Design Spec

Date: 2026-07-07
Scope: `apps/mobile/` React Native Home screen only. No other screens, no navigation changes beyond one new tap target on the hero card.

## Goal

Redesign the Home screen's visual language to be brighter, warmer, calmer, and more Things-3-restrained, per the provided mockup, while reusing all existing data sources and functionality. This is a visual/UX redesign, not a feature rewrite.

## Current State (as of exploration)

- `src/screens/HomeScreen.tsx` renders: `AppHeader` → `RoninHero` (mood-only, no level/XP) → 4 empty unwired "practice card" placeholders → `InboxScrollCard` → `TimelineSection` (Anytime/Morning/Afternoon/Evening).
- `RoninHero` (`src/components/home/RoninHero.tsx`) shows a static PNG per mood (`normal | alert | tired | focused | overwhelmed | resolved`), mood computed live in `src/utils/roninMood.ts` from inbox count, overdue count, timer state, and time of day. There is no stored level/XP/progression system anywhere in the DB.
- Data hooks: `useHomeData()` (tasks/timeline/inbox count), `usePersistentTimerState()` (global timer), `useMedications()`, `useWorkouts()`, `useProjects()` — all in `src/hooks/useDb.ts`.
- Global `PersistentTimerBanner` renders above all screens (outside Home), untouched by this redesign.
- Theme tokens in `src/theme/colors.ts` and `src/theme/spacing.ts`; UI primitives in `src/components/ui/`.
- No dedicated Ronin/progression detail screen exists yet; nav is a bottom tab bar (Home/Calendar/Menu/Profile) via React Navigation, defined in `App.tsx`.

## Decisions

1. **Level/XP**: No real progression system exists. Add a small stub module `src/utils/roninProgress.ts` exporting a hardcoded placeholder (`{ level: 1, xp: 0, xpToNext: 100 }`), clearly marked as a TODO stub so the hero card layout has a real slot for this data without presenting fabricated production data as authoritative. Future work can replace the stub's implementation without touching the card component.
2. **Practice cards**: Remove the 4 unwired placeholder cards from `HomeScreen.tsx` entirely. They have no data binding and no defined purpose, and don't appear in the mockup's calmer hierarchy.
3. **Next Up selection**: Compute the single nearest upcoming timed item today across tasks, medications, and workouts (whichever has a start time closest to now that hasn't passed). If nothing qualifies (no timed items and nothing in Anytime), render a calm empty state rather than guessing or leaving a blank card.
4. **Hero tap target**: `RoninHeroCard` becomes tappable; onPress navigates to the existing Profile ("Me") tab as a temporary stand-in for a future dedicated progression screen. No new route/screen is created in this task.
5. **Inbox/unattended card**: Keep `InboxScrollCard`, restyled to match the new card language. Show it as the "contextual unattended-matters status" from the mockup — calm "All clear" state when count is 0, otherwise the existing unattended count treatment.
6. **Timeline section**: Keep `TimelineSection` functionally identical (same grouping, same counts, same interactions/swipe actions) — restyle only (spacing, colors, corner radii, shadows) to match the new card language.
7. **Header**: Keep `AppHeader` functionally identical (avatar, logo, timer-restore affordance, dark/light toggle, sync status) — restyle only for the lighter palette. Do not touch `PersistentTimerBanner` (separate, global, out of scope).

## Component Changes

- `apps/mobile/src/screens/HomeScreen.tsx` — remove practice-cards row; reorder/restyle remaining sections; render new `NextUpCard`.
- `apps/mobile/src/components/home/RoninHeroCard.tsx` (new, or restyle existing `RoninHero.tsx` in place) — larger scene treatment, warmer background gradient behind existing mood PNG asset, mood label + level/XP row (from stub), tap → navigate to Profile tab.
- `apps/mobile/src/utils/roninProgress.ts` (new) — stub level/XP data, isolated so it's swappable for a real implementation later.
- `apps/mobile/src/components/home/NextUpCard.tsx` (new) — nearest-item selection logic (colocated or in a small helper `src/utils/nextUpItem.ts`), icon/title/time-range rendering, context-sensitive action button label (Start/Resume/Take/View/Continue) based on item type and timer state, calm empty state.
- `apps/mobile/src/components/home/InboxScrollCard.tsx` — restyle only.
- `apps/mobile/src/components/TimelineSection.tsx` — restyle only.
- `apps/mobile/src/components/AppHeader.tsx` — restyle only.
- `apps/mobile/src/theme/colors.ts` — extend/adjust light-mode tokens as needed for the warmer palette (no structural change to how theme is consumed).

## Data Flow

All data continues to come from existing hooks — no new DB tables or schema changes except the isolated stub module above. `NextUpCard` reads from `useHomeData()` (timeline items), `useMedications()`, `useWorkouts()`, and `usePersistentTimerState()` (to decide Start vs Resume/Continue).

## Testing / Verification

No unit test framework covers RN screens currently (visual-first app). Verification is via running the Expo app / preview and checking: populated state, empty Next-Up state, empty inbox ("All clear") state, dark mode, and that existing interactions (swipe actions on timeline items, Quick Add FAB, tab navigation, timer banner) are unaffected.
