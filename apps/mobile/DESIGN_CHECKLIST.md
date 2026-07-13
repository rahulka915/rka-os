# Ronin Visual Refresh — Design Checklist

**Scope:** look only — color, type, illustration motifs. Interaction patterns (capture sheets, swipe, checkboxes, toolbars) are governed separately by `THINGS_3_DESIGN.md`, untouched by this refresh.

**Direction:** feel like Things 3, look like Moonly (deep rich backgrounds, considered accent palette, Japanese/Ronin illustration motifs instead of Moonly's lunar ones).

Any agent or human can edit this file directly — check off a row once its palette, type, and motif treatment has actually been reviewed/restyled against the current tokens below, not just discussed. Update the reference sections whenever a token or motif decision changes; this file is the source of truth, not a point-in-time snapshot.

A human-viewable mirror of this checklist also exists as an [interactive artifact](https://claude.ai/code/artifact/f02f7b3c-52bb-47c6-ab80-1ac01aacee41) — its checkbox state is local to whichever browser opens it (localStorage) and is **not** authoritative. This file is authoritative. If the two drift, trust this file and re-sync the artifact.

---

## Current tokens — `apps/mobile/src/theme/colors.ts`

| Token | Value |
|---|---|
| `silver` | `#808080` (light) / `#c5c5c5` (dark) |
| `deeperBlue` (primary, both modes) | `#2b7ff0` |
| `pink` | `#ffb8d1` |
| `purple` | `#d4a8ff` |

## Primary blue — still under review

| Status | Value |
|---|---|
| Shipped | `#2b7ff0` |
| Candidate | `#002FA7` |
| Candidate | `#102A96` |

Not yet promoted to `colors.ts`. Once a final primary is picked, update this table and edit the token file to match.

## Illustration motif → meaning

| Motif | Color | Use | Status |
|---|---|---|---|
| Torii gate | red `#c23b3b` | Milestones / unlocks (illustration card) | Concept only — feature not built |
| Blossom | pink `#ed93b1` | Streaks / habit wins | Concept only — feature not built |
| Wave / mountain | deep blue `#1a4d7a` | Long-term / weekly views | Concept only — feature not built |
| Katana silhouette | platinum `#dfe1e4` | Companion level/XP | **Shipped** — `KatanaProgressBar.tsx` |
| Rolled scroll | silver/deeperBlue | Inbox / unopened items | **Shipped** — `ScrollIcon.tsx` |
| Zen-garden circles + stone | silver `#808080` | Empty/calm states (nothing pressing) | **Shipped** — `ZenGardenIcon.tsx` |

Note: streaks, journaling, weekly-reflection, and real level/XP progression don't exist in the app yet (`roninProgress.ts` returns a hardcoded placeholder). Motif cards for those are vision art, not illustrating live UI — don't imply they're real features.

## Dock icon color system — `apps/mobile/src/components/icons/DockIcons.tsx`

Separate from the motif table above (that's illustration cards; this is navigation icons). Icon set approved via a Codex design handoff and shipped. Color *mode* is **selected-color state**: these hex values only show on the currently-active tab (plus a soft `color + '22'` badge behind it); inactive tabs render in a neutral muted tone instead. The FAB is the one exception — always RKA blue, not state-dependent, since it's a fixed primary action rather than a nav destination.

| Section | Icon | Color when active | Hex |
|---|---|---|---|
| Home | Torii gateway | Lacquer red | `#C44545` |
| Calendar | Sun dial | Ritual gold | `#D4B078` |
| More | Layers | Archive jade | `#4E9E86` |
| Me | Personal seal | RKA blue | `#2b7ff0` |
| Create (FAB) | Calligraphy brush | RKA blue, always | `#2b7ff0` |

Note the torii-gate motif now has two live meanings in the app: the Home tab icon (navigation, lacquer red) and the still-unbuilt "milestones/unlocks" illustration-card concept above (also red) — same motif, consistent color, different contexts. Not a conflict, just worth knowing both exist.

---

## Screens — `apps/mobile/src/screens/`

- [ ] `AreaDetailScreen.tsx` — single life-area detail view
- [ ] `AreasScreen.tsx` — list of life areas
- [ ] `CalendarScreen.tsx` — calendar/agenda view (partial: fixed a real bug where the "Project" item-type accent aliased to `maroon`→`deeperBlue`, colliding with the "Task"/"Area" accent color, `blue`; now uses `purple`. Rest of the screen not yet reviewed)
- [x] `HomeScreen.tsx` — root uses Tamagui `$bg`, which was itself on a completely separate, entirely stale token system (old `#faf9f6`/`#0c0c0c` bg, `#007aff` blue, `#ff8c42` orange) — see `tamagui.config.ts` fix below. File composes only already-reviewed children otherwise.
- [x] `InboxScreenV2.tsx` — serif italic title matching Home's greeting, count badge tinted deeperBlue, FAB swapped from generic + to the calligraphy brush (also fixed a real contrast bug: the old icon color was picked for the deprecated silvery-blue bg and barely read on the current blue), bulk-toolbar bg moved off a stray hardcoded hex onto the real dark surface value
- [ ] `MedicationsScreen.tsx` — medication tracking list
- [ ] `MenuScreen.tsx` — app menu / nav hub
- [ ] `ProfileScreen.tsx` — user profile + dev bench
- [ ] `ProjectDetailScreen.tsx` — single project detail view
- [ ] `ProjectsScreen.tsx` — list of projects
- [x] `QuickAddScreen.tsx` — When/Tags/Priority pills moved off dead `maroon` alias to `deeperBlue`; tag chips now cycle deeperBlue/pink/purple by tag text instead of one flat neutral fill
- [ ] `TasksScreen.tsx` — task list view
- [ ] `WorkoutsScreen.tsx` — workout tracking list

## Home components — `apps/mobile/src/components/home/`

- [ ] `DomProbe.tsx` — dev-only webview sanity check
- [x] `InboxScrollCard.tsx` — deeperBlue accent; generic inbox-tray icon swapped for a real rolled-scroll motif (`ScrollIcon.tsx`) matching the "unopened scrolls" copy; count number pulled out as a standalone stat figure, center-aligned against the full text block (was baseline-aligned, sat too low); dropped the old stacked-duplicate-card "paper stack" effect in favor of real depth — a top-lit gradient surface, an actual drop shadow, and a glow behind the icon bubble, same techniques already used for the dock FAB and NextUp's badge
- [x] `KatanaProgressBar.tsx` — SVG katana XP progress bar
- [x] `NextUpCard.tsx` — deeperBlue label/badge, painted Moonly-scene hero (dark), gradient hero (light); empty state ("Nothing pressing right now") swapped the generic Sparkles icon for a new calm-state motif, `ZenGardenIcon.tsx` (raked circles + stone, silver) — none of the milestone/streak/long-term-view motifs fit an empty state
- [x] `PracticeList.tsx` — **dead code, not rendered anywhere** (orphaned when Home was redesigned); flagged for deletion rather than restyled, see spawned cleanup task
- [ ] `Ronin3D.tsx` — native three.js/R3F renderer — **not mounted on Home** (per CLAUDE.md, only in Profile's dev bench); nothing to restyle until it's actually used somewhere
- [ ] `Ronin3DDom.tsx` — DOM-webview three.js renderer — same as above, not mounted anywhere live
- [ ] `RoninCharacter.tsx` — Ronin character wrapper — same as above
- [x] `RoninGreetingCard.tsx` — katana bar wired in, serif italic greeting title, emoji swapped for Sparkles icon
- [x] `RoninHero.tsx` — thin composer wrapping RoninGreetingCard, nothing else to restyle
- [ ] `RoninPreview.tsx` — smaller Ronin preview widget — check if mounted anywhere before restyling
- [ ] `RoninStage.tsx` — Ronin stage, time-of-day tint — not mounted on Home currently (kept ready to drop back in, see CLAUDE.md), review once it's live somewhere

## App shell — `apps/mobile/App.tsx`

- [x] `AppleTabBar` (bottom tab bar + FAB) — full icon overhaul per Codex's design handoff (see `src/components/icons/DockIcons.tsx`): icon-only dock (no labels), custom SVG icon set (torii Home, sundial Calendar, layers More, personal-seal Me, calligraphy-brush Create). Color mode: **selected-color state** (icons neutral/muted at rest, section color + soft badge only on the focused tab) — the handoff doc's other option ("persistent," always-colored) was tried on-device first and replaced with this one per user feedback. FAB is the brush in RKA blue in both modes.

## Hero components — `apps/mobile/src/components/hero/`

- [ ] `HeroLayer.tsx` — single parallax image layer
- [ ] `HeroSection.tsx` — full hero banner, time-of-day art
- [ ] `ParticleCanvas.tsx` — animated particle overlay

## Icons — `apps/mobile/src/components/icons/`

- [x] `DockIcons.tsx` — custom dock icon set (torii/sundial/layers/seal/brush), source of truth for the tab bar's icon-only restyle
- [x] `ScrollIcon.tsx` — rolled hanging-scroll silhouette, used on `InboxScrollCard.tsx` in place of a generic inbox tray
- [x] `ZenGardenIcon.tsx` — raked zen-garden circles + stone (silver), used on `NextUpCard.tsx`'s empty state in place of a generic Sparkles icon

## UI primitives — `apps/mobile/src/components/ui/`

- [ ] `ActionRow.tsx` — tappable icon/label row
- [ ] `BottomSheet.tsx` — reusable bottom sheet container
- [ ] `DragHandle.tsx` — sheet drag-handle indicator
- [ ] `FloatingSurface.tsx` — elevated floating card surface
- [ ] `PillContainerIcon.tsx` — custom SVG pill-bottle icon
- [ ] `SurfaceCard.tsx` — generic elevated card surface

## Voice components — `apps/mobile/src/components/voice/`

- [ ] `VoiceMicButton.tsx` — mic button trigger (currently stub)
- [ ] `VoiceModal.tsx` — voice capture modal UI

## Other components — `apps/mobile/src/components/`

- [x] `AppHeader.tsx` — uses Tamagui `$bg`/`$textSecondary`/`$textTertiary`; these were themselves stale (see `tamagui.config.ts` fix), now correct now that the underlying token system is synced
- [ ] `AvatarCompanion.tsx` — avatar/companion display widget
- [x] `ContextMenu.tsx` — Tamagui `$surface`/`$separator`/`$red`/`$text`, fixed via the `tamagui.config.ts` sync
- [ ] `LensSurface.tsx` — chrome-less pushed-screen container
- [ ] `LogDoseSheet.tsx` — medication dose logging sheet
- [ ] `MedicationStockMeter.tsx` — medication stock-level meter
- [ ] `PersistentTimerBanner.tsx` — persistent running-timer banner
- [ ] `QuickCreateSheet.tsx` — quick-create item bottom sheet
- [ ] `SwipeableItem.tsx` — generic swipe-to-action row
- [ ] `TaskSwipeItem.tsx` — task-specific swipe-to-action row
- [x] `TimelineSection.tsx` — intentionally neutral/no-accent flat list, matches Things 3 spec as-is

## Theme & icons

- [ ] `theme/colors.ts` — color tokens/palette (partial: removed the dead `maroon`/`maroonSoft` alias now that every call site has been migrated to `deeperBlue`/`purple`; `blue` alias still intentionally kept, still has live call sites)
- [ ] `theme/index.ts` — theme aggregator/exports
- [ ] `theme/spacing.ts` — spacing scale tokens
- [ ] `icons.tsx` — centralized icon registry
- [x] `tamagui.config.ts` (project root) — **found while finishing the Home screen pass**: an entirely separate, fully stale token system that Tamagui-styled components read through instead of `colors.ts`/`getThemeColors()`. Still had the old pre-refresh values (`bg: '#faf9f6'`/`'#0c0c0c'`, `blue: '#007aff'`, `orange: '#ff8c42'`, old text/surface/fill/separator). Every value in both `rkaTokens.color` and `themes.light`/`themes.dark` synced to match `colors.ts` exactly, plus added the `purple`/`pink`/`silver` accent tokens that didn't exist here at all. Affects every Tamagui `$token`-styled component app-wide, not just Home — confirmed consumers: `HomeScreen.tsx`, `AppHeader.tsx`, `ContextMenu.tsx`, `LogDoseSheet.tsx`. `MenuScreen.tsx`/`MedicationsScreen.tsx` (Tamagui-based per CLAUDE.md) benefit from this token fix too but haven't had their own full visual review yet.
