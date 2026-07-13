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
| Torii gate | red `#c23b3b` | Milestones / unlocks | Concept only — feature not built |
| Blossom | pink `#ed93b1` | Streaks / habit wins | Concept only — feature not built |
| Wave / mountain | deep blue `#1a4d7a` | Long-term / weekly views | Concept only — feature not built |
| Katana silhouette | platinum `#dfe1e4` | Companion level/XP | **Shipped** — `KatanaProgressBar.tsx` |

Note: streaks, journaling, weekly-reflection, and real level/XP progression don't exist in the app yet (`roninProgress.ts` returns a hardcoded placeholder). Motif cards for those are vision art, not illustrating live UI — don't imply they're real features.

---

## Screens — `apps/mobile/src/screens/`

- [ ] `AreaDetailScreen.tsx` — single life-area detail view
- [ ] `AreasScreen.tsx` — list of life areas
- [ ] `CalendarScreen.tsx` — calendar/agenda view
- [ ] `HomeScreen.tsx` — main home dashboard
- [ ] `InboxScreenV2.tsx` — main inbox list + capture FAB
- [ ] `MedicationsScreen.tsx` — medication tracking list
- [ ] `MenuScreen.tsx` — app menu / nav hub
- [ ] `ProfileScreen.tsx` — user profile + dev bench
- [ ] `ProjectDetailScreen.tsx` — single project detail view
- [ ] `ProjectsScreen.tsx` — list of projects
- [ ] `QuickAddScreen.tsx` — quick-add capture modal
- [ ] `TasksScreen.tsx` — task list view
- [ ] `WorkoutsScreen.tsx` — workout tracking list

## Home components — `apps/mobile/src/components/home/`

- [ ] `DomProbe.tsx` — dev-only webview sanity check
- [x] `InboxScrollCard.tsx` — deeperBlue accent, dark shadow-cards now derived from bg/surface tokens
- [x] `KatanaProgressBar.tsx` — SVG katana XP progress bar
- [x] `NextUpCard.tsx` — deeperBlue label/badge, painted Moonly-scene hero (dark), gradient hero (light)
- [ ] `PracticeList.tsx` — list of practices/habits
- [ ] `Ronin3D.tsx` — native three.js/R3F renderer
- [ ] `Ronin3DDom.tsx` — DOM-webview three.js renderer
- [ ] `RoninCharacter.tsx` — Ronin character wrapper
- [x] `RoninGreetingCard.tsx` — katana bar wired in, serif italic greeting title, emoji swapped for Sparkles icon
- [x] `RoninHero.tsx` — thin composer wrapping RoninGreetingCard, nothing else to restyle
- [ ] `RoninPreview.tsx` — smaller Ronin preview widget
- [ ] `RoninStage.tsx` — Ronin stage, time-of-day tint

## App shell — `apps/mobile/App.tsx`

- [x] `AppleTabBar` (bottom tab bar + FAB) — active tab color, FAB bg/glow, and FAB icon color moved off the old silvery-blue (#9fb8d1) to deeperBlue; tab bar bg now derived from the real bg tokens instead of hardcoded near-black/near-white. Light-mode FAB intentionally kept near-black ink (matches existing flat-ink CTA convention), not switched to blue.

## Hero components — `apps/mobile/src/components/hero/`

- [ ] `HeroLayer.tsx` — single parallax image layer
- [ ] `HeroSection.tsx` — full hero banner, time-of-day art
- [ ] `ParticleCanvas.tsx` — animated particle overlay

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

- [x] `AppHeader.tsx` — theme-token driven already, no stale colors found
- [ ] `AvatarCompanion.tsx` — avatar/companion display widget
- [ ] `ContextMenu.tsx` — long-press contextual action menu
- [ ] `LensSurface.tsx` — chrome-less pushed-screen container
- [ ] `LogDoseSheet.tsx` — medication dose logging sheet
- [ ] `MedicationStockMeter.tsx` — medication stock-level meter
- [ ] `PersistentTimerBanner.tsx` — persistent running-timer banner
- [ ] `QuickCreateSheet.tsx` — quick-create item bottom sheet
- [ ] `SwipeableItem.tsx` — generic swipe-to-action row
- [ ] `TaskSwipeItem.tsx` — task-specific swipe-to-action row
- [x] `TimelineSection.tsx` — intentionally neutral/no-accent flat list, matches Things 3 spec as-is

## Theme & icons

- [ ] `theme/colors.ts` — color tokens/palette
- [ ] `theme/index.ts` — theme aggregator/exports
- [ ] `theme/spacing.ts` — spacing scale tokens
- [ ] `icons.tsx` — centralized icon registry
