# Ronin Visual Refresh — Design Checklist

**Scope:** look only — color, type, illustration motifs. Interaction patterns (capture sheets, swipe, checkboxes, toolbars) are governed separately by `THINGS_3_DESIGN.md`, untouched by this refresh.

**Direction:** feel like Things 3, look like Moonly (deep rich backgrounds, considered accent palette, Japanese/Ronin illustration motifs instead of Moonly's lunar ones).

Any agent or human can edit this file directly — check off a row once its palette, type, and motif treatment has actually been reviewed/restyled against the current tokens below, not just discussed. Update the reference sections whenever a token or motif decision changes; this file is the source of truth, not a point-in-time snapshot.

A human-viewable mirror of this checklist also exists as an [interactive artifact](https://claude.ai/code/artifact/f02f7b3c-52bb-47c6-ab80-1ac01aacee41) — its checkbox state is local to whichever browser opens it (localStorage) and is **not** authoritative. This file is authoritative. If the two drift, trust this file and re-sync the artifact.

**Promotion rule:** once a row here is genuinely settled (reviewed and restyled, not just discussed), graduate its content into `../../docs/design-system/reference/` (tokens.md/components.md/etc.) and trim this row to a one-line status. If it involved real deliberation or a rejected alternative, add an entry to `docs/design-system/reference/decision-log.md` too. See `docs/design-system/README.md` for the full rationale.

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

## Hero card colors — two independent axes

`RoninGreetingCard.tsx` deliberately splits color into two axes rather than one mood-driven hue swap (that was tried and rejected as too jarring / not "in line with the actual app theme colors"):

**Base gradient — time-of-day** (`TIME_OF_DAY_TINT` in-file), matching the same `RoninTimeOfDay` value already driving the scene art (`roninScenes.ts`) and the Japanese greeting (`roninGreeting.ts`):

| Time | Gradient |
|---|---|
| morning | `#40311f` → `#1c150e` (warm dawn) |
| day | `#1e56a0` → `#4fa8f5` (bright sky blue — deeper stop kept near the text corner for contrast) |
| night | `#1c1c32` → `#0f0f1a` (matches the app's actual dark surface/bg tokens) |

**Accent — mood** (`moodConfig.accentColor`), layered on top as a small corner glow (SVG `RadialGradient`), the status dot, the hanko seal tint, and the katana progress-bar fill — never the whole background:

| Mood | Accent |
|---|---|
| normal (Steady) | `#9aa0aa` |
| alert | `#d9a13f` |
| tired | `#6b6fb0` |
| focused | `#3a8ff2` |
| overwhelmed | `#e2534a` |
| resolved | `#3fbb63` |

The corner also carries a `TimeOfDayMotif` (sun-with-rays / plain sun-disc / crescent+stars per time-of-day, `src/components/icons/TimeOfDayMotif.tsx`) and a small hanko seal (kanji 武, "martial/warrior") — replacing an earlier ink-brush-stroke placeholder that read as an unclear icon.

## Time-block color system — `apps/mobile/src/components/TimelineSection.tsx`

Separate from the motif table above and from dock icon colors below — this is the Home "TODAY" card's four time blocks. Picked via mockup review (3 palettes × 3 accent-bleed depths); landed on **Bold** palette with **full-row** bleed (color reaches header chip, count number, checkbox rings, and a soft full-row background tint, not just the header).

| Block | Icon | Light | Dark |
|---|---|---|---|
| Anytime | `StoneIcon` | `#6E6E6E` | `#a8a8a8` |
| Morning | `SunriseIcon` | `#E0A73D` | `#F0BE5E` |
| Afternoon | `FanIcon` | `#D65A2E` | `#F07850` |
| Evening | `MoonStarIcon` | `#2A2A72` | `#6D6DD6` |

Dark-mode values are brightened per-color (not just alpha-adjusted from light mode) to stay legible against the dark bg.

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
- [x] `InboxScrollCard.tsx` — deeperBlue accent; dropped the old stacked-duplicate-card "paper stack" effect in favor of real depth — a top-lit gradient surface, an actual drop shadow, same techniques already used for the dock FAB. Following a comparison against a real Moonly home screen (found ours light on illustration below the hero), the small `ScrollIcon` line-icon-in-a-bubble was replaced with a commissioned flat-vector illustration (`assets/illustrations/scroll-stack.png` — chibi-style single scroll, parchment/wood/red-tie, matching the chibi Ronin's art style per `ART_HANDOFF_home_illustrations.md`), no bubble background needed since the art carries its own color/depth. Restructured from a horizontal row to a square tile (`aspectRatio: 1`) — illustration on top, stat + text stacked below, chevron moved to a small top-right corner accent — since it now sits side by side with `NextUpCard.tsx` splitting the row width (see HomeScreen.tsx), rather than each stacked full-width. `ScrollIcon.tsx` kept in the repo as a fallback, no longer referenced.
- [x] `KatanaProgressBar.tsx` — SVG katana XP progress bar
- [x] `NextUpCard.tsx` — deeperBlue label/badge, painted Moonly-scene hero (dark), gradient hero (light); empty state's small `ZenGardenIcon` line-icon replaced with a commissioned flat-vector illustration (`assets/illustrations/zen-garden-scene.png` — chibi-style mossy stone lantern, matching the chibi Ronin's art style per `ART_HANDOFF_home_illustrations.md`). All three states (empty / dark photo-hero / light gradient-hero) restructured to a shared square tile (`aspectRatio: 1`) with the same corner-badge + bottom-anchored-text convention, since the card now sits side by side with `InboxScrollCard.tsx` splitting the row width (see HomeScreen.tsx) instead of each stacked full-width. `ZenGardenIcon.tsx` kept in the repo as a fallback, no longer referenced.
- [x] `PracticeList.tsx` — **dead code, not rendered anywhere** (orphaned when Home was redesigned); flagged for deletion rather than restyled, see spawned cleanup task
- [ ] `Ronin3D.tsx` — native three.js/R3F renderer — **not mounted on Home** (per CLAUDE.md, only in Profile's dev bench); nothing to restyle until it's actually used somewhere
- [ ] `Ronin3DDom.tsx` — DOM-webview three.js renderer — same as above, not mounted anywhere live
- [ ] `RoninCharacter.tsx` — Ronin character wrapper — same as above
- [x] `RoninGreetingCard.tsx` — both a visual and a functional pass. Visual: two-axis color system (see "Hero card colors" above) instead of a single flat surface or a full mood-hue swap; Japanese time-of-day greeting + name (`roninGreeting.ts` — おはよう/こんにちは/こんばんは) replacing the English "Good morning/afternoon/evening". A two-font split (Shippori Mincho for the Japanese phrase, Cormorant Garamond italic for the name) was tried and shipped briefly, then explicitly reverted back to the original single Georgia italic across both — user preferred it on reflection after seeing both side by side. The Mincho/Cormorant Garamond packages were removed since nothing else used them; katana bar now `preserveAspectRatio="none"` + slightly taller so it actually spans the card width instead of "meeting" a shorter box. Functional: the fabricated Level/XP bar (`roninProgress.ts`, a hardcoded placeholder, now deleted) is replaced by real today's-progress (`completedCount`/`totalCount` from `todayItems`, computed in `HomeScreen.tsx`, zero new queries needed); the vague per-mood flavor text (`moodConfig.supportingCopy`, now removed) is replaced by a concrete, number-driven status line (`getRoninStatus()` in `roninMood.ts`, one function producing both mood and its matching status line so they can't drift apart). The chibi Ronin+cat illustration (`getRoninAsset`, `base` outfit) bleeding off the corner was tried and shipped briefly in an earlier pass, then pulled — on-device the current PNG cutouts (`assets/ronin/base|haori|training|journey/`) have rough/dirty transparency edges. Those PNG files are untouched on disk (still used by `RoninCharacter.tsx`'s static fallback + the Profile dev bench); **TODO: regenerate clean no-background cutouts, then re-add the `<Image>` to this card**
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
- [x] `ScrollIcon.tsx` — rolled hanging-scroll silhouette; **no longer referenced** — `InboxScrollCard.tsx` now uses the commissioned `assets/illustrations/scroll-stack.png` illustration instead. Kept in the repo as a fallback.
- [x] `ZenGardenIcon.tsx` — raked zen-garden circles + stone (silver); **no longer referenced** — `NextUpCard.tsx`'s empty state now uses the commissioned `assets/illustrations/zen-garden-scene.png` illustration instead. Kept in the repo as a fallback.
- [x] `TimeBlockIcons.tsx` — `StoneIcon`/`SunriseIcon`/`FanIcon`/`MoonStarIcon`, one per Anytime/Morning/Afternoon/Evening block, used on `TimelineSection.tsx` in place of generic Lucide Clock/Sun/Sunset/Moon icons
- [x] `TimeOfDayMotif.tsx` — sun-with-rays / plain sun-disc / crescent+stars, keyed by the same `RoninTimeOfDay` value as the scene art and greeting, used as `RoninGreetingCard.tsx`'s corner decoration in place of an earlier ink-brush-stroke placeholder

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
- [x] `TimelineSection.tsx` — superseded the "neutral, matches Things 3 as-is" call: each time block (Anytime/Morning/Afternoon/Evening) now gets its own Ronin motif icon and accent color from the new "Bold" palette (`timeBlockColors` in-file), bled through the header chip, count number, checkbox rings, and full row background tint (mockup-tested against a Muted and Sunrise alternative + 3 bleed depths before picking Bold/full-row)

## Typography

**Tried and reverted:** a two-font greeting system (`ShipporiMincho_600SemiBold` for the Japanese phrase + `CormorantGaramond_600SemiBold_Italic` for the name) was built, shipped briefly, then explicitly reverted back to the original single Georgia italic — user preference after comparing both. The `@expo-google-fonts/shippori-mincho` and `@expo-google-fonts/cormorant-garamond` packages were uninstalled since nothing else used them. `roninGreeting.ts` still returns the Japanese word and name as separate pieces (harmless, keeps the door open for a future per-segment style) even though both currently render identically.

**Shipped (2026-07-13, same day as above, done as a follow-up in the same session):** app-wide switch to Inter for all UI text.

- `App.tsx` loads `Inter_300Light/400Regular/500Medium/600SemiBold/700Bold/800ExtraBold` via `useFonts()` (same splash-gate as the greeting fonts) and sets `Text.defaultProps.style` to `Inter_400Regular` as the base default for any `<Text>` without an explicit weight.
- `tamagui.config.ts`'s `interFont` (`createFont`) uses a `face` map so Tamagui's `fontWeight="600"` etc. props (used in `AppHeader.tsx`, `LogDoseSheet.tsx`, `ContextMenu.tsx`, `HeroSection.tsx`) automatically resolve to the matching Inter file — no per-component changes needed for those, one config change covers all of them.
- Every raw `StyleSheet`-based `fontWeight: '300'/'500'/'600'/'700'/'800'` across the app (131 occurrences, 23 files, found via a scripted pass + a manual sweep for inline single-line styles the script's line-based pattern missed) now has a matching explicit `fontFamily: 'Inter_*Weight'` alongside it — required because RN doesn't synthesize bold/weight variants for custom fonts, so `fontWeight` alone silently stops rendering as bold once the system font is replaced. `fontWeight: '400'` occurrences were left alone (already covered by the global default). `InboxScreenV2.tsx`'s deliberate `Georgia` italic title and `RoninGreetingCard.tsx`'s Mincho/Cormorant greeting were explicitly skipped/preserved, not overwritten.
- **New native dependency (`expo-font`, already required for the greeting fonts) — needs a dev-client rebuild, not just a Metro reload, before any of this takes effect on-device.**

## Theme & icons

- [ ] `theme/colors.ts` — color tokens/palette (partial: removed the dead `maroon`/`maroonSoft` alias now that every call site has been migrated to `deeperBlue`/`purple`; `blue` alias still intentionally kept, still has live call sites)
- [ ] `theme/index.ts` — theme aggregator/exports
- [ ] `theme/spacing.ts` — spacing scale tokens
- [ ] `icons.tsx` — centralized icon registry
- [x] `tamagui.config.ts` (project root) — **found while finishing the Home screen pass**: an entirely separate, fully stale token system that Tamagui-styled components read through instead of `colors.ts`/`getThemeColors()`. Still had the old pre-refresh values (`bg: '#faf9f6'`/`'#0c0c0c'`, `blue: '#007aff'`, `orange: '#ff8c42'`, old text/surface/fill/separator). Every value in both `rkaTokens.color` and `themes.light`/`themes.dark` synced to match `colors.ts` exactly, plus added the `purple`/`pink`/`silver` accent tokens that didn't exist here at all. Affects every Tamagui `$token`-styled component app-wide, not just Home — confirmed consumers: `HomeScreen.tsx`, `AppHeader.tsx`, `ContextMenu.tsx`, `LogDoseSheet.tsx`. `MenuScreen.tsx`/`MedicationsScreen.tsx` (Tamagui-based per CLAUDE.md) benefit from this token fix too but haven't had their own full visual review yet.
