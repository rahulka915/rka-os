# Ronin Visual Refresh — Design Checklist

**Scope:** look only — color, type, illustration motifs. Interaction patterns (capture sheets, swipe, checkboxes, toolbars) are governed separately by `THINGS_3_DESIGN.md`, untouched by this refresh.

**Direction:** feel like Things 3, look like Moonly (deep rich backgrounds, considered accent palette, Japanese/Ronin illustration motifs instead of Moonly's lunar ones).

Any agent or human can edit this file directly — check off a row once its palette, type, and motif treatment has actually been reviewed/restyled against the current tokens below, not just discussed. Update the reference sections whenever a token or motif decision changes; this file is the source of truth, not a point-in-time snapshot.

A human-viewable mirror of this checklist also exists as an [interactive artifact](https://claude.ai/code/artifact/f02f7b3c-52bb-47c6-ab80-1ac01aacee41) — its checkbox state is local to whichever browser opens it (localStorage) and is **not** authoritative. This file is authoritative. If the two drift, trust this file and re-sync the artifact.

**Promotion rule:** once a row here is genuinely settled (reviewed and restyled, not just discussed), graduate its content into `../../docs/design-system/reference/` (tokens.md/components.md/etc.) and trim this row to a one-line status. If it involved real deliberation or a rejected alternative, add an entry to `docs/design-system/reference/decision-log.md` too. See `docs/design-system/README.md` for the full rationale.

---

## River Stone surface language — `apps/mobile/src/components/ui/RiverStoneSurface.tsx`

A reusable geometry primitive (not a color system — colors/content stay each component's own concern) that replaced generic rounded rectangles across Home + the app shell. Design brief came from an external mockup showing 6 surface weights (hero/small cards/list rows/chips/bottom nav/header); iterated through several rounds of HTML mockups in-conversation before implementation (subtler ambient-only glow → directional top-lit bevel → full "carved 3-4mm graphite/stone" surface modeling was the final approved level).

**Geometry rule:** every surface uses **asymmetric-but-point-symmetric** corner radius — top-left pairs with bottom-right (one value), top-right pairs with bottom-left (a smaller value) — not four independent corners. This gives a "carved, not perfectly geometric" read while staying exactly recognizable as a card (explicit user correction mid-session: "even if each corner does have a different value then the overall look should seem symmetric").

**Per-variant radius pairs (major/minor):** hero 36/22, card 26/17, list 17/13, chip 20/16, tray 32/24, header 20/14.

**Surface modeling (5 layers, all "extremely restrained"):**
1. Broad top-down sheen (gradient, brightest at top fading through/past mid-height) — the overhead "light source," not a corner-concentrated glow
2. Thin rim highlight (top edge) + thin rim shadow (bottom edge) — ordinary 1-1.5px absolutely-positioned Views, automatically clipped to the correct rounded silhouette by the parent's `overflow:hidden` (no CSS inset-shadow equivalent needed)
3. Corner ambient-occlusion pooling in the CSS mockup — **not implemented in RN**, see platform constraints below
4. Extra weight/darkening toward the lower portion of the face
5. Outer ambient shadow, one per variant, tuned to read as "soft ambient + a bit of contact weight" combined

**Materials:** dark = graphite (`colors.stoneSurface` = `#1c1c22`), light = warm pale stone (`#f3efe4`) — a genuinely neutral tone distinct from the app's existing blue-tinted `surface` token. Only applies to surfaces with **no color of their own** — anything with a deliberate color already (hero's time-of-day gradient, NextUpCard's scene photo/gradient, TimelineSection's per-block accent tint) passes `backgroundColor="transparent"` (or its own tint) and keeps it; `RiverStoneSurface` only supplies shape/light, never overrides an existing intentional color. "No borders" per the original spec — no `borderWidth`/`borderColor` anywhere in the primitive.

**RN platform constraints that shaped the implementation** (the CSS mockup used features RN doesn't have — noted here so a future session doesn't "fix" this by trying to match the mockup pixel-for-pixel):
- No native inset/`box-shadow`. Rim highlight/shadow are plain clipped Views, not a shadow trick.
- No native multi-shadow support (CSS's comma-separated `box-shadow` has no RN equivalent). One shadow per variant, tuned rather than layering a second shadow View for a separate "contact shadow."
- Per-corner radial ambient occlusion was **dropped** — would need a dynamically-sized SVG overlay per surface (tracking real layout via `onLayout`) for a barely-visible gain at this opacity level. The top sheen + bottom weight gradient already carries most of the depth cue.

**Wired in this pass:**
- Hero → `RoninGreetingCard.tsx` (`variant="hero"`, transparent bg — the time-of-day gradient is the color)
- Small cards → `NextUpCard.tsx` (all 3 states) + `InboxScrollCard.tsx` (`variant="card"`) — the latter's old near-duplicate gradient/shadow was fully replaced, not kept alongside
- List rows + chips → `TimelineSection.tsx`'s time-block header rows (`variant="list"`) and the icon+label pill inside each (`variant="chip"`) — **individual task rows inside an expanded block were deliberately left flat**, per `THINGS_3_DESIGN.md`/CLAUDE.md's explicit "flat rows, no cards, no shadows" rule for Things-3-style lists; only the colored, tappable block-header containers count as "surfaces" in the River Stone sense
- Tray → `App.tsx`'s `AppleTabBar` (`variant="tray"`) — this also converted the tab bar from a full-width edge-to-edge bar to an actual floating tray (margins on all sides, no top border) since the original implementation wasn't floating at all despite looking like it might be
- Header → `AppHeader.tsx` (`variant="header"`) — one shallow ledge behind the whole row (avatar/title/theme toggle/sync), not wrapping each control individually; the safe-area/Dynamic-Island spacer stays outside the ledge
- Home-indicator pill → a decorative recessed pill inside the tray (`App.tsx`), matching the reference mockup — purely stylistic (the OS renders the real system home indicator separately)

**Bug found + fixed on-device (first real build after this pass):** the small square cards (`NextUpCard`/`InboxScrollCard`) initially rendered as squished short pills instead of squares — the inner clipped view had no way to stretch to match the outer `aspectRatio: 1` wrapper, so it collapsed to its content's natural height. First fix (`flex: 1` unconditionally on the inner clip view) broke `AppHeader` instead (it disappeared entirely) — a `flex: 1` child inside a parent with no explicit dimension (hero/tray/header/list/chip are all content-sized, no forced `aspectRatio`) collapses to zero height in Yoga. Fixed by making it opt-in: `RiverStoneSurface` now takes a `stretchToFill` prop, passed only by the two square-tile consumers that actually force a dimension via `style`. Content-sized variants must never pass it.

**Not yet done / explicitly deferred:**
- Every other screen (dialogs, sheets, `MenuScreen`/`ProfileScreen`/`MedicationsScreen`/`CalendarScreen`'s own cards, etc.) — per the original brief this should be adopted incrementally as those screens get touched, same as every other item in this checklist, not applied in one sweeping pass.

---

## Current tokens — `apps/mobile/src/theme/colors.ts`

| Token | Value |
|---|---|
| `silver` | `#808080` (light) / `#c5c5c5` (dark) |
| `deeperBlue` (primary, both modes) | `#2b7ff0` |
| `pink` | `#ffb8d1` |
| `purple` | `#d4a8ff` |
| `ivory` | `#2b2620` (light) / `#F2ECDD` (dark) — primary text on River Stone surfaces |
| `greige` | `rgba(43,38,32,0.58)` (light) / `rgba(242,236,221,0.56)` (dark) — secondary text on River Stone surfaces |
| `antiqueBrass` | `#8B6936` (light) / `#D4B078` (dark) — selection / important-action emphasis; same family as `itemComposer.ts`'s `accent` and `CalendarScreen.tsx`'s `CALENDAR_GOLD`, not yet unified into one token |
| `vermilion` | `#A8402C` (light) / `#C1503A` (dark) — active-navigation / brand emphasis; replaced the old teal (`#4E9E86`) Menu-tab dock color |

Added 2026-08-05 as part of `app-wide-ui-refinement-v1` (see below and `HANDOVER_SUMMARY.md`).

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

Separate from the motif table above (that's illustration cards; this is navigation icons). Color *mode* is **selected-color state**: these hex values only show on the currently-active tab (plus a soft `color + '22'` badge behind it); inactive tabs render in a neutral muted tone instead. The FAB is the one exception — always RKA blue, not state-dependent, since it's a fixed primary action rather than a nav destination.

First generation (simple stroke silhouettes) came from a Codex design handoff. Second generation — a commissioned filled-path redraw, delivered as SVG + multi-size PNG asset packs — swapped Home/Calendar's icons for bolder redraws of the same concepts, and reimagined Menu ("layers" → an ensō/Zen circle) and Profile ("personal seal" hexagon → a ronin mon/portrait silhouette). At true 22px deployed size, the torii and mon-portrait icons read cleanly; the sundial and ensō are a bit softer/blobbier (clock-hand and brush-stroke detail mostly lost) but still functional given each tab's fixed position + distinct color.

| Section | Icon | Component | Color when active | Hex |
|---|---|---|---|---|
| Home | Torii gateway | `TorriHomeIcon` | Lacquer red | `#C44545` |
| Calendar | Sun dial | `SunDialCalendarIcon` | Ritual gold | `#D4B078` |
| More | Ensō (Zen circle) | `EnsoMoreIcon` (was `LayersMoreIcon`) | Archive jade | `#4E9E86` |
| Me | Ronin mon/portrait | `RoninMonIcon` (was `PersonalSealMeIcon`) | RKA blue | `#2b7ff0` |
| Create (FAB) | Layered vector brush + washi animation | `FabControl` | RKA blue, always | `#274B8F` |

The FAB was rebuilt as a single animation-ready vector composition on 2026-08-01. Its lacquer disc, washi sheet, ink mark, bamboo handle, red ferrule and brush tip are independent SVG/Reanimated layers, so press compression, brush lift/sweep and ink reveal animate without raster-frame swapping. Tap and route-aware long-press behavior are unchanged; Reduce Motion bypasses the decorative sequence. The previous registered PNG frame pack remains on disk as source/reference art but is no longer loaded by `FabControl`.

Note the torii-gate motif now has two live meanings in the app: the Home tab icon (navigation, lacquer red) and the still-unbuilt "milestones/unlocks" illustration-card concept above (also red) — same motif, consistent color, different contexts. Not a conflict, just worth knowing both exist.

---

## Screens — `apps/mobile/src/screens/`

- [ ] `AreaDetailScreen.tsx` — single life-area detail view
- [ ] `AreasScreen.tsx` — list of life areas
- [x] `CalendarScreen.tsx` — calendar/agenda view (partial: fixed a real bug where the "Project" item-type accent aliased to `maroon`→`deeperBlue`, colliding with the "Task"/"Area" accent color, `blue`; now uses `purple`. Reviewed against `app-wide-ui-refinement-v1` 2026-08-05: already substantially compliant — `CALENDAR_GOLD` (`#D4B078`) selected Calendar/Timeline segment is already brass, the blue "now" line is preserved, the paper-texture grid is already restrained. No structural changes made.)
- [x] `HomeScreen.tsx` — root uses Tamagui `$bg`, which was itself on a completely separate, entirely stale token system (old `#faf9f6`/`#0c0c0c` bg, `#007aff` blue, `#ff8c42` orange) — see `tamagui.config.ts` fix below. File composes only already-reviewed children otherwise.
- [x] `InboxScreenV2.tsx` — serif italic title matching Home's greeting, count badge tinted deeperBlue, FAB swapped from generic + to the calligraphy brush (also fixed a real contrast bug: the old icon color was picked for the deprecated silvery-blue bg and barely read on the current blue), bulk-toolbar bg moved off a stray hardcoded hex onto the real dark surface value. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** title font switched from Georgia italic to Newsreader; count badge switched from a filled deeperBlue pill to a vermilion-outlined one; empty state got a small brass `Check` glyph, ivory/greige text.
- [ ] `MedicationsScreen.tsx` — medication tracking list
- [x] `MenuScreen.tsx` — app menu / nav hub; collection icon pass complete: removed the colored rounded-square badges so the transparent 3D objects render directly on the River Stone cards at 42pt. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** tile `aspectRatio` 1→1.14 and grid spacing trimmed for a slightly denser grid; all 12 destinations/artwork unchanged. Dock's vermilion active-Menu-tab color (see App shell below) applies here automatically.
- [ ] `ProfileScreen.tsx` — user profile + dev bench
- [ ] `ProjectDetailScreen.tsx` — single project detail view
- [ ] `ProjectsScreen.tsx` — list of projects
- [x] `QuickAddScreen.tsx` — When/Tags/Priority pills moved off dead `maroon` alias to `deeperBlue`; tag chips now cycle deeperBlue/pink/purple by tag text instead of one flat neutral fill
- [x] `TasksScreen.tsx` — task list view. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** rows now render through `RiverStoneSurface` (`variant="list"`) instead of a flat colored `View`, denser padding, ivory/greige text; Tasks/Logbook segmented control restyled as an inset stone chip with a brass border on the selected tab; `LensSurface` title uses the new `titleStyle="editorial"` (Newsreader); empty states got a small brass `CheckCircle2` symbol.
- [ ] `WorkoutsScreen.tsx` — workout tracking list
- [x] Exercise catalogue hierarchy — 183 exact exercises now browse as 32 parent movement families inside each muscle group; the picker uses the same family sections and family-aware search. This is an information-architecture change only: existing exercise artwork and selectable variations are preserved.

## Home components — `apps/mobile/src/components/home/`

- [ ] `RoninJourneyPrototype.tsx` — **prototype awaiting another on-device verdict**. The hand-built SVG landscape and standalone flat walker were rejected because the background looked poor and the on-device tap/idle appeared inert. The active revision uses the user's supplied Fuji sunset composition, edited into a clean portrait background (`sunset-trail-background-v1.png`) plus matching transparent Ronin+cat group (`ronin-cat-walkers-v1.png`). The entire scene is now the press target, eliminating the small transformed-hit-area failure mode; tap performs a large hop, medium haptic, and visible speech bubble. A simple reversible `withTiming` loop continuously bobs the walkers, including a slower two-point cycle under Reduce Motion, while completed/total Today progress translates them along the path. Decide after phone review whether scale/crop/motion now land correctly.

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

- [x] `AppleTabBar` (bottom tab bar + FAB) — icon-only dock (no labels), custom SVG icon set (see `src/components/icons/DockIcons.tsx` — "Dock icon color system" above has the full history of both icon generations). Color mode: **selected-color state** (icons neutral/muted at rest, section color + soft badge only on the focused tab) — an early "persistent, always-colored" option was tried on-device first and replaced with this one per user feedback. FAB uses the layered vector brush-and-washi composition in `FabControl.tsx`. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** Menu tab's active color changed from teal `#4E9E86` to vermilion `#C1503A` in `App.tsx`'s `TAB_ITEMS` — the only teal active-state in the app, per the refinement brief's "remove teal active states" direction. Home/Calendar/Profile tab colors unchanged (not teal, not flagged).

## Hero components — `apps/mobile/src/components/hero/`

- [ ] `HeroLayer.tsx` — single parallax image layer
- [ ] `HeroSection.tsx` — full hero banner, time-of-day art
- [ ] `ParticleCanvas.tsx` — animated particle overlay

## Icons — `apps/mobile/src/components/icons/`

- [x] `DockIcons.tsx` — custom dock icon set (torii/sundial/ensō/mon-portrait/brush), source of truth for the tab bar's icon-only restyle — see "Dock icon color system" above for the two-generation history
- [x] `ScrollIcon.tsx` — rolled hanging-scroll silhouette; **no longer referenced** — `InboxScrollCard.tsx` now uses the commissioned `assets/illustrations/scroll-stack.png` illustration instead. Kept in the repo as a fallback.
- [x] `ZenGardenIcon.tsx` — raked zen-garden circles + stone (silver); **no longer referenced** — `NextUpCard.tsx`'s empty state now uses the commissioned `assets/illustrations/zen-garden-scene.png` illustration instead. Kept in the repo as a fallback.
- [x] `TimeBlockIcons.tsx` — `StoneIcon`/`SunriseIcon`/`FanIcon`/`MoonStarIcon`, one per Anytime/Morning/Afternoon/Evening block, used on `TimelineSection.tsx` in place of generic Lucide Clock/Sun/Sunset/Moon icons
- [x] `TimeOfDayMotif.tsx` — sun-with-rays / plain sun-disc / crescent+stars, keyed by the same `RoninTimeOfDay` value as the scene art and greeting, used as `RoninGreetingCard.tsx`'s corner decoration in place of an earlier ink-brush-stroke placeholder
- [x] `CollectionIcons.tsx` — wrappers for the high-detail transparent 3D PNG set under `assets/icons/collections/`: Workout (black lacquer kettlebell with bronze/cord handle), Habit (wooden prayer beads, lacquer tally and red tassel), To Get (indigo/rose furoshiki parcel), and Archive destination (black lacquer scroll chest with brass hardware). An initial flat SVG pass was rejected on-device because it lacked the material depth of the existing entity artwork. The replacements reuse Task, Project and Medication as direct style references. Ordinary archive actions deliberately retain their familiar system glyph.

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
- [x] `LensSurface.tsx` — chrome-less pushed-screen container. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** added an opt-in `titleStyle="editorial"` prop (Newsreader, 30pt) — default `titleStyle` is unchanged Inter. Only `TasksScreen.tsx` opts in so far; every other Lens screen (Projects, Workouts, Medications, ...) keeps the default Inter title per the brief's "Newsreader only for editorial top-level screen titles" rule.
- [x] `item-composer/ItemEditorSheet.tsx` — Edit Item sheet. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** footer Save switched from a solid brass fill to a brass-outlined button; section `card` surfaces and every chip/segment/duration/bucket/priority control dropped their default hairline border (border now only appears on the selected state) to cut the "boxes inside boxes" look. `itemComposer.ts`'s existing brass `accent` token was already correct and untouched.
- [ ] `LogDoseSheet.tsx` — medication dose logging sheet
- [ ] `MedicationStockMeter.tsx` — medication stock-level meter
- [ ] `PersistentTimerBanner.tsx` — persistent running-timer banner
- [ ] `QuickCreateSheet.tsx` — quick-create item bottom sheet
- [ ] `SwipeableItem.tsx` — generic swipe-to-action row
- [x] `TaskSwipeItem.tsx` — task-specific swipe-to-action row. **Updated 2026-08-05 (`app-wide-ui-refinement-v1`):** row surface swapped from a flat fillStrong/separatorStrong-or-surface split to `RiverStoneSurface` (`variant="list"`); container corner radius 999→18 to match (swipe-reveal clipping still correct, now a rounded rect not a full pill); padding/gap trimmed ~25%; title/notes text moved to ivory/greige.
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
