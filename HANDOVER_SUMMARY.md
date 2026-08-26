# RKA OS — Handover Summary
**Last Updated:** 2026-08-26
**Status:** Native iOS (primary, active) + a *separate, current* desktop web app (`apps/mobile/src/webApp/`, Expo web, built 2026-07-30–08-01, partial screen parity — see `apps/mobile/CLAUDE.md`'s "Desktop Web App" section). The *different, unrelated* Web PWA described in Session 1 below (Vite + React + Dexie.js, repo root) has been fully retired; that section is kept as historical record only. Do not conflate the two — one is dead, one is actively developed.

---
## 2026-08-26 — Expanded Ronin PNG idle library wired into Home

- Wired all 52 cleaned `apps/mobile/assets/ronin/idle-v2/` frames into `roninSpriteRegistry.ts` and `RoninWalkCycleSprite.tsx`: calm, look-around, blink, yawn, wrap adjustment and shoulder roll.
- `RoninJourneyPrototype.tsx` now schedules weighted personality idles after random 8–18 second calm intervals, prevents immediate repeats, returns to calm between clips, and lets walking/jump/bow interrupt immediately. The outer bob/rotation pauses during one-shot sprite clips so motion layers do not fight.
- Reduce Motion retains all five personality idle clips with the same weighting and no-repeat rule; it only suppresses the extra outer rotation and walk bob. Added pure playback-state tests and tightened the registry test so empty placeholder arrays can no longer pass.
- Verification: 13 focused scheduler/registry/playback/asset tests pass; the 52-frame asset validator passes at 640×640 with the 580±2px baseline. `tsc --noEmit` reports only the repository's existing `.web.tsx` resolution, database skill-union, and missing `event` map errors; no Ronin integration errors.

---


## 2026-08-15 — Measurable (count/duration) Habits now generate proportional Attribute evidence

Follow-up to the entry below — a real gap found before commit/deploy: quantified Habits (e.g. "12k steps") went through `logHabitSample`, never `updateItemStatus`'s completion path, so they generated zero Attribute evidence no matter how tagged. Fixed.

- **New `fraction` column on `attributeContributions`** (REAL, nullable — NULL means full credit). `completionFraction = clamp(actual/target, 0, 1)` scales the configured weight's units linearly, applied once at the raw-unit level in `attributeScoring.ts`'s `bucketEvidenceByWeek` — deliberately NOT run through the weekly-credit curve's `^0.6` a second time (would double-count partial effort).
- **`recordHabitProgressEvidence(habitId, occurredAt, samples)`** (both DB files) — called from `logHabitSample`/`undoLastHabitSample`. Recomputes the *current period's* completion fraction from scratch every time (via `utils/habitMeta.ts`'s newly-exported `periodWindow`/existing `computeHabitPeriodProgress`) and **replaces** that period's evidence rather than accumulating it — excludes whatever was recorded in the current period window, inserts fresh rows only if fraction > 0. Same weekly-target period math the progress UI already uses, so evidence and displayed progress can never disagree. No-ops for binary Habits (unchanged, still go through `recordHabitCompletionEvidence`).
- **Real bug caught and fixed mid-implementation**: on web, Firestore writes are async with no local optimistic update — a `getHabitSamples()` call made immediately after `logActivity()`/delete would read stale data (missing the sample just logged, or still containing the one just removed). Fixed by having `logHabitSample`/`undoLastHabitSample` construct the corrected sample list by hand before calling `recordHabitProgressEvidence`, rather than trusting a fresh snapshot read. Native is unaffected (SQLite writes are synchronous) but was given the same explicit-samples-parameter signature for consistency.
- One new `ALTER TABLE attributeContributions ADD COLUMN fraction REAL` migration (native), wrapped in the existing try/catch-ignore pattern.
- New tests: 3 added to `attributeScoring.test.ts` covering the exact 0/25/50/75/100/150%+ behavior and confirming the curve is not double-applied.
- **Live UI validation not completed this pass**: none of the 5 seeded Habits in the test account are actually configured as count/duration (despite names like "120g Protein"/"12k steps" implying it), and the web Habit editor's Measurement section appears to be display-only — no way found to switch Binary → Count/Duration from the panel. Worth a look as a separate, pre-existing gap; not fixed here. Validated instead via unit tests (thorough, exact-percentage coverage) and code review.
- Docs updated: `SCHEMA.md`'s `attributeContributions` table (new `fraction` column + full mechanism), `CLAUDE.md`'s Potential Attributes note.

---

## 2026-08-14 — Potential Attribute v1 scoring model ("H1") + minimal UI shipped

Follow-up to the evidence-architecture entry below, same day. Two rounds of simulated candidate-model comparison (published as an Artifact, not a repo doc — ask if you need the link) landed on a hybrid model; this entry is what actually got built from it.

- **Scoring engine**: `src/utils/attributeScoring.ts` — `computeAttributeValue(evidence, config, now)`, pure and always recomputed fresh, nothing cached. Weekly buckets (Monday-start, `weekStartMs`) of evidence → `weeklyCredit = 100 × min(raw/target, 1)^curveExponent` (partial credit below target, hard-capped at target) → an asymmetric exponential chase (`alphaUp`/`alphaDown`) walks every week from first evidence to now. `AttributeScoringConfig` lives per-Attribute on `metadata.scoringConfig` (`getAttributeScoringConfig`/`setAttributeScoringConfig`, both DB files) — Strength/Stamina share `DEFAULT_ATTRIBUTE_SCORING_CONFIG` (target 6 units/week, minor/moderate/major = 1/2/4, exponent 0.6, α-up 0.04, α-down 0.015) but nothing hardcodes that they must. `computeAttributeScore(attributeId)` ties it together.
- **History-aware recovery (H2)** — evaluated in the simulation round, explicitly NOT built. The evidence model already supports adding it later without any migration (it's pure history replay), so this was a scope call, not a technical blocker.
- **UI, minimal by design**: new `AttributesScreen.tsx`/`.web.tsx` (Strength/Stamina cards + tap-to-expand recent evidence, separate "Current State" section for Alertness) — reachable from native's "More" grid / web sidebar. Habit tagging added to `HabitDetailScreen.tsx` (native) and `HabitAttributeEditor` in `HabitQuantifiedControls.web.tsx` (web, `HabitsScreen.web.tsx` edit mode) — independent multi-select Minor/Moderate/Major chips per Attribute, separate from the legacy single-Pillar picker on the same screen. Action tagging added to `LogActionSheet` (native) / `CaptureForm` (web) alongside the existing Domain/Pillar/Skill/Mission pickers.
- **Real gap caught and fixed during this pass**: native seeds Strength/Stamina at SQLite cold-init (`seedInitialAttributes`, called from `getDb()`), but web has no equivalent boot hook — a web-only account would never get the two Attributes created. Fixed with a lazy-seed-on-first-`getAttributes()`-read in `database.web.ts`, same idempotent `seedKey` guard as native so a later two-way sync never duplicates.
- **Validated live**, not just via unit tests: tagged the real "Resistance Training" habit (web) to Strength=Major, completed it, confirmed the Attributes screen showed Strength move from 0 to 3 and the evidence list showed the new row — matches the hand-computed expected value (weekly credit ≈78% for a single Major, α-up 0.04 → 0 + 0.04×78 ≈ 3.1) exactly.
- Also fixed in passing: an unrelated concurrent change added a `'supplement'` `ItemType` while this was in flight, which broke two exhaustive `Record<ItemType, ...>` maps (`ArchiveScreen.tsx`'s `TYPE_LABELS`, `HomeScreenExperimental.tsx`'s `TYPE_COLORS`) — both patched with a `supplement` entry so the build stays green; not otherwise related to this work.
- New tests: `utils/attributeScoring.test.ts` (16 tests, including explicit validation-checklist cases: partial-week credit, decay-after-inactivity, excessive-volume capping, per-Attribute config independence, deterministic recompute-from-history).

---

## 2026-08-14 — Domains reduced to 6 + Potential Attribute evidence architecture (shipped, scoring formula deliberately NOT built)

Product direction, discussed at length before implementation: Domains lose their forced-8 Harada framing and stop being RPG stats; a new **Potential Attribute** system (Strength, Stamina for v1) takes over the "developmental stat" role that Pillars were informally drifting toward, plus a separate fast-changing **Alertness** "Current State" reading. Full architecture reasoning lives in this session's chat (not a spec doc this time — see the persistence-model/hierarchy Artifact published earlier the same day for the data-model diagrams this built on).

- **Domains: 8 → 6.** `CANONICAL_DOMAIN_TITLES` (`database.ts`) drops Discipline and Growth — both judged too cross-cutting to be their own Domain. `retireDroppedDomains()` (new, runs once at boot after the existing canonical-backfill pass) re-homes anything linked to either into a fallback Domain (Discipline → Health & Wellbeing, Growth → Creativity) via the existing `mergeAreaIntoArea`, then removes them. **Inspected the live account first, per explicit instruction:** both were confirmed completely empty (0 Missions, 0 Skills, 0 Achievements, 0 Pillars) before this was written, so in practice this is a clean removal. `HaradaWheel.tsx`'s spoke geometry is already `shown.length`-driven, not hardcoded to 8 — renders correctly with 6, no change needed there. `OnboardingScreen.tsx`'s domain list derives from `CANONICAL_DOMAIN_TITLES` directly, so it updated for free.
- **Pillars (`potential-stat`) are now explicitly legacy**, not removed. Inspected first: all 4 seeded Pillars (Physique/Skin/Oral Hygiene/Vitality) were unlinked to any Domain with zero Habits assigned — nothing real to migrate onto Attributes, so no data migration ran. Domain maintenance scoring still reads from Pillars, kept running for compatibility only.
- **Skills' 0-100 proficiency is now explicitly legacy too** — future direction is a skill-tree (branch/node, locked/available/mastered), not built this pass. New Attribute architecture is deliberately not designed around `metadata.proficiency` being permanent.
- **New `potential-attribute` item type**, seeded Strength/Stamina (`seedInitialAttributes`, idempotent). Two new tables: `attributeDomains` (many-to-many Attribute↔Domain association — context only, never itself a scoring input) and `attributeContributions` (the evidence/event log: `{attributeId, sourceType: 'habit'|'action', sourceId, weight: 'minor'|'moderate'|'major', occurredAt, excludedAt}`). Habits (`metadata.attributeContributions`) and Actions (`ActionDetails.attributeContributions`) can each tap zero, one, or several Attributes — independent of and unrelated to the legacy single-target `metadata.potentialStat`. Evidence is generated automatically: every real Habit completion and every logged Action now writes real rows.
- **Deliberately unimplemented: the scoring formula.** `utils/attributes.ts`'s `computeAttributeValue` is a stub, always returns `null`. Explicit instruction: keep evidence generation and scoring strategy decoupled so the progression/decay model (asymmetric growth/decay, near-asymptotic ceiling at high values, months-long half-life) can be designed against real example timelines before being hardwired — do not assume the existing Achievement decay math (`domainScoring.ts`) is automatically correct just because it's available. A follow-up report with candidate progression models compared against example timelines is expected before this gets built.
- **Alertness (shipped, simple):** architecturally separate from Attributes — fast-changing, recomputed fresh each read, nothing stored/decayed. `computeAlertness()` derives a basic 0-100 value from today's Daily Check-In `sleepAmount`/`sleepQuality` answers (`utils/alertness.ts`), returns `null` (never guesses) if no check-in logged today. No HP. No manual daily entry required.
- Mirrored fully in `database.web.ts` — the two new relational tables are localStorage-backed for now (same "no firestoreWebStore mirror yet" pattern already established by `dailyCheckIns`), not yet cross-device synced; everything else (Attribute items, Habit/Action metadata) already syncs via the existing Firestore item/activityLog mirror.
- New unit tests: `utils/attributes.test.ts`, `utils/alertness.test.ts`. `utils/itemLifecycle.ts`/its test updated for the new item type (classified structural).
- Docs updated: `apps/mobile/CLAUDE.md` (new "Potential Attributes"/"Alertness"/"Domains are now six" notes, Pillars/Skills sections marked legacy), `apps/mobile/SCHEMA.md` (new tables + item type documented in the same table format as `domainContributions`).

---

## 2026-08-13 — Pillars page + Actions model (shipped, native + web)

Implemented per `docs/superpowers/specs/2026-08-13-pillars-and-actions-design.md`, in one pass across both targets.

- **Pillars page** (`src/screens/PillarsScreen.tsx` + `src/webApp/PillarsScreen.web.tsx`): standalone list of every `potential-stat` — maintenance %, linked Domain, feeding-habit count, expandable per-habit contributions, create/rename/delete/link-unlink Domain, `SUGGESTED_PILLARS` quick-adds. No schema change, reuses existing DB functions only.
- **Actions model** (no new item type, no migration): an Action is a lightweight `activityLogs` row, `actionType: 'action'`, with a typed `details` JSON (title/kind/duration/intensity/why/optional Domain-Pillar-Skill-Mission links) — this is the first place skill practice with duration/intensity/why is recordable. New DB functions in **both** `database.ts` and `database.web.ts`: `logAction`, `getActions`, `updateAction`, `deleteAction`, plus a unified read-only `getActionFeed` that merges logged Actions with habit check-ins/task completions/medication doses/routine steps, newest-first. Pure types/helpers (`ActionDetails`, `buildActionFeed`, parsing) live in `src/utils/actions.ts` (unit-tested, `actions.test.ts`). **Scoring-safe by design:** logged Actions never write `domainContributions` or touch skill proficiency — recorded + displayed only.
- **Actions page** (`src/screens/ActionsScreen.tsx` + `src/webApp/ActionsScreen.web.tsx`): log control (capture sheet/panel) + the unified feed, newest-first; logged Actions are editable/deletable, derived feed entries are read-only.
- **Navigation:** both are standalone top-level destinations for now — native `MenuScreen.tsx` grid tiles + `MenuStack.tsx` registration; web `Sidebar.web.tsx` `PROGRESSION_ITEMS` + `AppShell.web.tsx` routing. Later nesting (Pillars under Potential/Me, Actions near Tasks/Logbook) is tracked but not done this pass.
- Two screen-building subagents produced the four screen files independently (native+web each); a follow-up pass fixed several wrong-token-key type errors they introduced (web screens used non-existent `webSpacing.sm/md/lg`-style keys instead of the real numeric `webSpacing[N]` scale, `webRadius.full` instead of `.pill`, a nonexistent `webColors.accentForeground`; native `ActionsScreen.tsx` used wrong radius keys; `PillarsScreen.tsx`'s `QuickCreateSheet` call used guessed prop names) — worth double-checking generated screens against the actual token shapes in `theme/webTheme.ts`/`theme/riverStone.ts` rather than assuming subagents got them right.
- `WEB_PARITY.md` updated with both new destinations (✅/✅, no gaps this pass).

---

## 2026-08-12 — Clean Ronin skeleton reconciliation

- Confirmed the active Rive tab is `RONIN RIG CLEAN REBUILD` in Design mode; the old Ronin and
  CATCAT donor were not touched.
- Re-enumerated all 22 live bones from scratch, corrected the reversed provisional arm-side names
  by anatomy, and connected clavicles, hips, thighs, feet and toes into one pelvis-rooted hierarchy.
- Re-query and forward-solving verified that every reparent preserved its pre-edit world-space
  start. Both arm and leg chains are left/right symmetric within the hand-drawn tolerances.
- With explicit user approval, duplicated the existing head bone and split its former 69.434-unit
  run into `bone-neck 1-57670` (14.000) and `bone-head 1-57669` (55.434). The complete verified
  centreline is now `pelvis → spine → chest → neck → head`, with the original hairline endpoint and
  rotation preserved. The clean skeleton contains 23 bones and Timeline `1-6` remains empty.
- No artwork was bound, hidden, reordered or deleted. Next: rigidly attach the complete new head
  assembly to `bone-head`, preserving its internal expression layers. This was completed:
  `RONIN-HEAD-ART 1-51970` is now a rigid child of `bone-head 1-57669`, its world placement and
  neutral silhouette are preserved, and all eyes/brows/nose/mouth/hair/skin children remain
  separate. Next: bind torso/pelvis/neck structural geometry. Canonical artwork spec and project
  code were unchanged.
- Torso/pelvis/neck binding is now complete: torso base + both canonical tunic paths jointly use
  spine/chest; pelvis base + all 21 canonical sash paths jointly use pelvis/spine; both neck paths
  use `bone-neck`. The first neck bind was caught as inert (zero neck influence), its two failed
  Skin components were replaced, and all 17 neck vertices now follow the neck bone. All 27 target
  paths contain Skin components, the test pose was restored exactly, and Timeline `1-6` is empty.
- Next: rig and fully validate one complete arm, including structural base, deep-root coverage,
  visible sleeve, wrist wrap and rigid hand before mirroring it.
- The anatomical right arm is now numerically rigged: four base paths + visible sleeve + five deep
  roots jointly use upperarm/forearm; 12 wrap paths jointly use forearm/hand; canonical `hand-R` is
  a rigid child of the hand bone with world placement preserved. Sampled paths show healthy
  upperarm/forearm influence and appropriate wrap blending.
- Visual sign-off is still blocked: the Rive desktop canvas remained on a stale neutral render while
  MCP values held the shoulder/elbow test pose and ignored live selection changes. The test rotations
  were restored exactly and Timeline `1-6` is empty. Refresh/reopen the clean tab, re-enumerate, then
  repeat the right shoulder/elbow visual test before mirroring the arm.
- A user-requested second check reproduced the same split even after `focusArtboard`: MCP held the
  obvious `-30°/-55°/20°` arm pose while the visible desktop canvas stayed neutral. Direct UI control
  could not reach the Rive window (`noWindowsAvailable`). Neutral was restored again; no mirror work
  was started.
- After the user reconnected and interacted with Rive, the high-resolution right-arm pose rendered.
  The rigged base/sleeve/wrap/canonical hand followed correctly, but an unnamed near-black hand
  silhouette stayed at the neutral position. It was identified geometrically as direct `Custom
  Shape 1-30083` and set to 0% as recoverable rollback-only; nothing was deleted. Other temporary
  candidate opacities were restored to 100%. Bone values are neutral and Timeline `1-6` is empty;
  the canvas may hold the last evaluated pose until another direct Rive click.
- A refreshed isolation pass confirmed `LEGACY-hand-R-base 1-30424` is another stationary hand
  duplicate and `arm-R-base` shape `1-30254` causes the orange/brown elbow triangle. Both remain at
  0%; the retained right sleeve/wrap/hand stack bends without a hole.
- Mirrored the left sleeve/wrap/hand rig and rigid-parented canonical `hand-L 1-29075` with world
  placement preserved. A `45°/70°/-20°` test exposed stationary duplicate hands (`1-30050`,
  `1-30326`) plus three base and three deep-root shapes that extruded beyond the silhouette. Those
  candidates remain recoverably at 0%, not deleted. The retained visible stack passes without holes
  or stationary fragments; exact neutral rotations were restored and the neutral silhouette is
  intact.
- Leg binding has deliberately not started. The left imported structural/deep-root candidates are
  currently rollback-only and their intended coverage role remains unresolved. Resolve clipping or
  reconstruction versus superseded-duplicate status before treating the complete-arm gate as passed.
  Project code and the canonical artwork specification remain unchanged.
- Follow-up deformation testing rigid-parented the six left structural/deep-root candidates by
  segment. The rendered pose proved they are duplicate brown limb fragments outside an already
  complete sleeve/wrap silhouette, so they remain intentionally as superseded rollback artwork at
  0%. This closes the arm construction gate without deleting them.
- Began only the anatomical left leg: base+corrected trousers use thigh/shin, extended shin band uses
  shin/foot, and all boot parts use foot/toe. Representative Skin summaries are healthy. Rive then
  stalled at `LOADING FILE… 0%` before the pose could be visually signed off; exact neutral rotations
  were restored and Timeline `1-6` is empty. Reconnect and visually validate this leg before mirroring.
- Waiting through the ordinary loading overlay allowed the left-leg pose to render. Strong knee,
  ankle, toe, and hip-shift tests showed complete following with no holes or stationary fragments;
  the left leg is visually validated and neutral was restored.
- Rechecked the orange buried left-leg backing during the full-body walk. The offender is path
  `1-31038` in `leg-L-base 1-30989`. A foot-only diagnostic bind worsened the exposure and was
  removed. A restored five-bone joint solve then caused an orange curve in neutral, so that failed
  Skin was also removed. The isolated path is now rigidly bound to `bone-L-shin`; exact neutral is
  visually clean again. It stays at 100% and behind the visible leg artwork; validate/tune the walk
  extremes rather than hiding it.
- Corrected an earlier false diagnosis: the orange triangle was not `1-31037`; all experimental
  transform/vertex edits to it were reverted exactly. Opacity isolation at 1683% identified Shape
  `1-31054` / path `1-31055`. Its inappropriate five-bone Skin `1-58868` was replaced by rigid
  `bone-L-shin` binding. The shape remains 100% opaque and the close neutral render is clean.
- Began the required high-zoom four-limb audit. Expanded inventory to include retained legacy paths:
  38 left-leg and 50 right-leg paths, all bound only to their anatomical side. Deep left-knee flex
  isolated a dark rectangle to legacy trouser path `1-26103`; three automated assignment models
  failed, so it was restored/rebound in exact neutral and marked for manual weights/clipping.
- Audited 26 left-arm paths. Found six structural/deep-root Shapes incorrectly at 0% and restored all
  to 100%. Isolation identified `1-30179` as a large neutral orange protrusion. Five tail vertices
  were shortened into the visible sleeve, its stale Skin was rebuilt in exact neutral, and the new
  Skin `1-62518` confirms all corrected vertices rigidly follow `bone-L-upperarm`. Explicit selection
  at 989% verifies the orange base is fully contained while remaining 100% opaque.
- User-selected screenshots identified the neutral displacement precisely as left structural Shapes
  `1-30200` and `1-30800`, then exposed the same hierarchy defect across all six structural/deep-root
  Shapes. They had both bone parenting and a Skin to that bone, so transforms were applied twice.
  All six were returned under `RONIN-BODY-ART`, kept at 100%, and rebound exactly once: three to
  `bone-L-upperarm`, three to `bone-L-forearm`. A full reload visually confirms the clean neutral
  silhouette; final queries confirm parent `1-25996` and the intended single L-side bone per path.
- Compared the clean neutral against the supplied Illustrator original (ignoring the intentional skin
  tone change). At 1174.3% zoom, user-assisted direct selection identified the anatomical-left
  (viewer-left) full dark forearm/hand backing as Shape `1-30083` / path `1-30084`, fill `#1B1411`.
  It remains 100% opaque. The MCP offset was visually rejected, so the path was unbound and the user
  manually placed the Shape at the accepted `(-193, 113)`. Rebound path `1-30084` to
  `bone-R-forearm` plus `bone-R-hand`; Rive auto-weighted all 33 vertices and both bones have verified
  influence. Restored unrelated Shape `1-30400` to `(0,0)`. No path geometry was changed.
- Attempted a moderate right-arm stress pose after the backing rebind, but Rive's canvas stayed stale
  and therefore provided no visual proof. Restored and re-queried the exact neutral rotations for
  `bone-R-upperarm`, `bone-R-forearm`, and `bone-R-hand`; no test pose remains.
- Audited the leg assemblies after a generic hierarchy query appeared to show nine unbound paths in
  `trousers-L-corrected`. Direct `querySkin` proved this was a hierarchy-response omission: all nine
  already have their five L-leg bones attached and each has active thigh, shin, or foot weights. The
  attempted bind changed nothing; no paths were reweighted.
- Audited the complete 33-path right arm. All 26 deforming paths are bound exclusively to R-side arm
  bones; the seven canonical hand paths remain intentionally unskinned inside rigid `hand-R`; every
  parent Shape is 100%. MCP stress rotations initially left a stale canvas; a visible-sleeve opacity
  nudge forced one refresh and revealed large orange structural artwork across the torso in a moderate
  shoulder/elbow pose. Later isolation toggles again failed to invalidate, so no offender was guessed.
  All Shapes and exact neutral rotations were restored and read back. Binding/opacity passes; visual
  deformation fails pending reliable high-zoom isolation of the orange pieces.
- Mirrored the numerical rig to the anatomical right leg using its larger actual inventory: 17
  base/trouser, 14 shin-band, and 16 boot paths. A per-path audit caught and repaired one initially
  unbound boot detail (`1-26498`). The MCP test pose did not evaluate on the visible canvas even after
  extended waiting without a loading overlay, and UI refresh attempts returned `noWindowsAvailable`.
  Right-leg neutral was restored; visually sign it off before animation.
- Follow-up restored the Rive MCP and combined MCP transform control with full-window computer
  captures. The right leg visibly passed a strong hip/knee/ankle/toe bend plus a planted-foot roll;
  trousers, band, boot, toe, and the previously missed detail all followed without holes or detached
  fragments. Exact neutral rotations read back correctly and Timeline `1-6` remains empty, but the
  desktop canvas stayed on the last evaluated roll frame and direct refresh clicks intermittently
  returned `noWindowsAvailable`. Right-leg deformation is signed off; exact neutral-silhouette
  validation remains the final gate before animation.
- Resolved the last neutral-render gate by addressing Rive as `app.rive.editor`: a fresh state read
  followed by a Design-canvas click forced the pending neutral transforms to evaluate. The visible
  character returned to the approved symmetrical stance. Full skeleton, head, torso, both arms,
  both legs, foot roll, and neutral silhouette are now validated; Timeline `1-6` is still empty.
- Began animation with one restrained checkpoint: renamed the existing empty Timeline `1-6` to
  `idle`, set 60 fps / 60 frames / loop / speed `0.45`, and authored nine cubic skeleton-only keys
  on pelvis Y, chest rotation, and head rotation at frames 0/30/60. Endpoints are exact neutral;
  midpoint amplitude is 2.5 px / 1° / -0.8°. The midpoint rendered cleanly and Design values were
  restored exactly. Visually review continuous playback before creating `walk`.
- Completed and visually validated `walk` (`1-60155`): 60 fps, 60 frames, looping, 95 cubic keys,
  19 tracks, 17 skeleton objects, and no artwork targets. It includes pelvis shift/double-bounce,
  torso/head counter-motion, hip/thigh swing, alternating knee flexion, ankle/toe roll, planted-foot
  phases, and upperarm/forearm coordination. Frame-15 and frame-45 captures show alternating swing
  legs and opposite planted boots with no holes or detached fragments. Corrected the initial
  same-direction arm sway to antiphase and replayed the cycle. Every track has equal frame-0/60
  values; exact Design neutral was restored. The default state machine remains Entry → `idle`;
  connecting runtime walk transitions is intentionally separate from the completed walk clip.
- User review correctly reopened production walk sign-off: the animated limbs reveal imported
  construction edges. Live inventory proves these are not Rive Strokes—there are zero Stroke
  components in the leg/trouser/band/boot groups—but separate near-black filled detail paths with
  independent Skin deformation. Isolated the four lowest paths responsible for hanging cuff/trouser
  lines (`1-27770`, `1-27687`, `1-27440`, `1-27330`) and retained them at 0%; neutral remains intact.
  Remaining knee/hip/ankle seams require consolidated limb artwork or no-outline joint-cover shapes,
  not further timing/weight tweaks. Treat `walk` as a validated motion test, not production-ready art.
- Corrected that conclusion after the user challenged it: continuous limb silhouettes do exist.
  Root cause was separate per-role weight solves plus nine unskinned left-trouser decorative paths.
  Restored the four isolated dark shapes to 100%, rebound every full-leg path to the complete
  hip→thigh→shin→foot→toe chain, and jointly auto-weighted 34 left / 47 right paths as one surface
  per leg (blend 0.35, max influences 3, smooth). Excluded stale id `1-26413`; explicitly rebound
  `1-27400`. Frame-45 inspection shows coordinated continuous following; exact neutral restored.
- Completed a full imported-body audit after the user clarified that every layer is intentional.
  Found 190 live paths, of which 53 were unskinned, plus eight shapes incorrectly left at 0% by
  earlier rollback/duplicate judgments. Restored all eight to 100% and bound all 53 missing paths,
  including legacy trousers/bands, complete tunics, composite masks, sleeve details, and concealed
  hand coverage. Final machine audit: 190/190 paths skinned, zero unskinned, zero hidden body shapes.
  Frame-45 proves all layers follow, but restored composites still require role-specific weight and
  draw-order refinement before the walk is visually clean. Nothing was deleted; no imported layer
  may be called redundant.

## 2026-08-12 — "Potential Stats" → **Pillars** (product rename + optional/first-class model)

- **Terminology:** all user-facing "Potential Stat"/"Stat(s)" copy is now **Pillar/Pillars** on both native and web. The internal item `type` stays `'potential-stat'` and all code symbols (`getPotentialStats`, `metadata.potentialStat`, `PotentialStatResult`, relation `'potentialStatArea'`, etc.) are **unchanged** — no DB migration, no data touched. "Pillar" is purely the product term.
- **Model shift:** Pillars are now framed as **optional, first-class maintenance/capacity areas, mostly Health & Fitness** (Skin, Oral Health, Hair & Grooming, Sleep, Hydration, Nutrition, Physique, Strength, Stamina, Mobility) — **not** a required child of every Domain. Finance/Relationships/Discipline/Growth/Creativity/Career are expected to have **no** Pillars and are driven by Missions/Skills/Achievements/reflection instead. Habits can feed a Pillar whether or not it's linked to a Domain (already true in the data layer via the `potentialStatArea` relation).
- **Scoring safety (the one real logic change):** a Domain with **no linked Pillars** used to get maintenance `0`, which read as a "0% failure" and dragged Overall Potential down. New shared pure helper `domainMaintenance(percents)` + `NO_PILLAR_MAINTENANCE_BASELINE = 10` (`src/utils/domainScoring.ts`) give a Pillar-less Domain a neutral **10% maintenance floor** that Mission/Achievement/Skill lift floats above. Domains **with** Pillars are unchanged (same average-of-streaks maintenance as before). Applied in native `computeDomainMaintenance` (`database.ts`) and web `computeDomainScoreApprox` (`PotentialOverview.web.tsx`). New tests in `domainScoring.test.ts` (18 pass).
- **Neutral UI states:** `AreaDetailScreen.tsx` (native) and `DomainMissionDetailForm.web.tsx` (web) now show "No Pillars tracked for this Domain — Pillars are optional…" instead of implying failure, and the score caption explains a Pillar-less Domain's score comes from Missions/achievements, not daily maintenance.
- **Suggestions, not auto-creation:** `SUGGESTED_PILLARS` (grouped Health & Wellbeing / Fitness & Performance, `src/utils/potential.ts`) is offered as optional quick-adds in the native "Add Pillar" action sheet. **Nothing is auto-created** — the legacy 4-stat `migratePotentialStats` back-compat seed is deliberately left as-is (expanding it would auto-seed Pillars for every existing user, the opposite of the intent). Onboarding's per-Domain Pillar field stays optional and is relabeled + steered toward Health/Fitness.
- **Future Actions model (product direction, NOT shipped):** see `apps/mobile/CLAUDE.md` "Actions model (planned)". Actions = umbrella for planned/done things; Tasks = planned actions; habit check-ins = recurring action logs; Skill practice logs should eventually carry duration/type/intensity/why; most actions should optionally answer "why?" and link to Domain/Pillar/Skill/Mission. Not implemented.
- **Verification:** `domainScoring`/`potential`/`habitMeta` tests pass (33); `npx tsc --noEmit` clean on all touched files (ignoring known `.web.tsx` platform-extension false alarms).

---

## 2026-08-12 — Nav consolidation round 2 (Routines→Habits, Archive→Tasks)

- **Routines folded into Habits** on both targets. Native (`HabitsScreen.tsx`): a "Routines →" header link (Workouts→Trends idiom), Routines tile removed from `MenuScreen.tsx`. Web (`HabitsScreen.web.tsx`): a "Routines" segmented tab rendering the unchanged `RoutinesScreen`, removed from `Sidebar.web.tsx` `PROGRESSION_ITEMS`.
- **Archive folded into Tasks** on both targets as a third segment (Tasks/Logbook/Archive). Native: extracted a body-only `ArchiveList` from `ArchiveScreen.tsx` (keeps `useArchivedItems` lazy — only queries when the segment is open, per the cold-start guardrail) and rendered it in `TasksScreen.tsx`'s new archive branch; Archive tile removed from `MenuScreen.tsx`. Web: renders the unchanged `ArchiveScreen` in `TasksScreen.web.tsx`'s archive branch, removed from `Sidebar.web.tsx` `NAV_ITEMS`.
- All four screens (`RoutinesScreen`/`ArchiveScreen`, native + web) remain registered/reachable; only their top-level nav entries moved.
- Docs synced: `apps/mobile/WEB_PARITY.md`.
- Verification: `npx tsc --noEmit` clean on all touched files (ignoring the known `.web.tsx` platform-extension false alarms). Web app is behind a Firebase login gate, so no authenticated visual smoke-test was run.

---

## 2026-08-12 — Cross-target navigation consolidation (native ↔ web parity)

- Brought native's top-level navigation in line with the web sidebar consolidation so both targets share the same "these aren't standalone destinations" logic (navigation *model* still differs — bottom tabs + a "More" grid on native, sidebar on web — which is expected variation).
- **Native** (`MenuScreen.tsx`): removed the **Focus, Potential, Plan Backwards, Upcoming, Skills, Achievements** tiles from the "More" grid. All six screens remain registered in `MenuStack.tsx` and reachable via `navigate`.
  - Focus / Skills / Achievements are now reached from the **Me** (Profile) tab — Focus via `PotentialOverview.tsx`'s CURRENT FOCUS row, Skills/Achievements via new link rows in `ProfileScreen.tsx`. `PotentialOverview.tsx`'s `navigate('Focus'|'Achievements')` calls now route through `navigate('Menu', { screen })` so they resolve from the Profile tab too.
  - Plan Backwards + Upcoming are now navigate-chips in `CalendarScreen.tsx`'s view-chip row (next to Calendar/Timeline).
- **Web**: removed the still-top-level **Upcoming** entry from `Sidebar.web.tsx` and folded it into `CalendarScreen.web.tsx` as a fourth segment (Timeline/Agenda/Plan Backwards/**Upcoming**), rendering the unchanged `UpcomingScreen.web.tsx`. (Focus/Potential/Plan Backwards/Skills/Achievements were already consolidated on web.)
- Docs synced: `apps/mobile/WEB_PARITY.md` (new "Cross-target navigation parity pass" note + Upcoming row).
- Verification: `npx tsc --noEmit` clean for all touched files (ignoring the known `.web.tsx` platform-extension false alarms). Web app is behind a Firebase login gate, so no authenticated visual smoke-test was run.

---

## 2026-08-12 — Web Potential Stats and habit maintenance wiring

- Closed the web gap that blocked conversational onboarding from being entered through the preview UI: `database.web.ts` now exports `getPotentialStats()` and `createPotentialStat()`, alongside the existing Domain-link helpers.
- Updated `DomainMissionDetailForm.web.tsx` so Domain detail can create new Potential Stats/Pillars and unlink existing ones, while keeping the Skills/Achievements/score sections intact.
- Added `HabitPotentialEditor` in `HabitQuantifiedControls.web.tsx` and wired it into `HabitsScreen.web.tsx`, so web habits can be assigned to a Potential Stat/Pillar and given target days for 100%.
- Updated `PotentialOverview.web.tsx` scoring from the old Mission-completion approximation to the native-style maintenance baseline: Domain score = average linked Potential Stats, each Stat = average assigned habit streak progress. Web still does not mirror native `domainContributions`, so achievement/mission/skill decay lift remains absent on web.
- Documentation synced: `AGENTS.md`, `apps/mobile/CLAUDE.md`, and `apps/mobile/WEB_PARITY.md` now describe the web progression state accurately.
- Verification: `npm run web:build` passes. `npm run typecheck` currently fails with a TypeScript compiler `RangeError: Maximum call stack size exceeded` and no source file, so it could not provide a useful targeted check.
- Next: deploy the web build before expecting `https://rka-os.web.app/` to show the new controls, then use the web UI to create the starter Health/Fitness Pillars and linked habits.

---

## 2026-08-11 — Ronin Rive reskin structural rig + first idle

- Continued the live `RONIN RIG 1` rebuild only; the shipping `apps/mobile/assets/rka_journey_rig.riv` remains unchanged.
- Approved the right arm’s structural setup, identified the two direct near-black duplicate hand silhouettes (`1-130395`, `1-130428`) and hid them at 0% as recoverable rollback geometry. The canonical hands are rigid children of their hand bones.
- Bound all retained character construction: arm bases/sleeves/deep roots/wraps, continuous leg bases/trousers/cuffs, pelvis/torso/tunic/sash, neck, and rigid head/face/bandana/hair. Boots are rigid children of their foot bones; original hip/thigh/shin/foot chains were preserved.
- Verified representative arm and leg bases have non-zero two-bone influence; reparent operations preserved world positions. All old retirement candidates remain undeleted and unbound.
- Started a bone-only `idle` clip: a 60-frame cubic, two-cycle breathing/settle loop on pelvis, spine, head and upper arms. `walk` deliberately remains empty because the rebuilt file currently has no IK targets/constraints; a convincing planted-foot walk must first restore leg IK and add the missing symmetric `bone-L-toe`.
- Remaining validation: high-resolution artwork-only elbow/shoulder/hip/knee/ankle pose captures, particularly to check seam coverage visually. Do not claim visual sign-off merely from the numerical skin audit.

---

## 2026-08-12 — Muscle group icon asset folder

- Added `apps/mobile/assets/icons/muscle-groups/README.md` and the `muscle-groups/` folder as the dedicated home for custom muscle-group artwork.
- Intended filenames are the eight `MUSCLE_GROUPS` keys: `chest.png`, `back.png`, `shoulders.png`, `arms.png`, `legs.png`, `core.png`, `full-body.png`, and `cardio.png`.
- This folder is intentionally separate from `apps/mobile/assets/exercises/`, which remains the generated individual exercise thumbnail library driven by `scripts/generateExerciseAssets.cjs`.
- Next: drop generated transparent PNGs into this folder, then wire them into the muscle-group overview cards when the set is ready.

---

## 2026-08-12 — Generated domain and app-area PNG icons wired

- Updated `DomainIcons.tsx` from the previous single-weight vector marks to transparent PNG wrappers for the new generated eight-Domain artwork in `assets/icons/domains/`.
- Discipline now uses the wrapped mala replacement; Missions now resolve to the generated mountain destination artwork through the existing project icon wrappers.
- Updated `CollectionIcons.tsx` and `TaskNoteIcon.tsx` so Habits, Routines, Skills, Tasks, To Get and Workouts use the newer generated app-area PNGs where available, while Archive, Potential and Achievements keep their approved collection PNGs.
- Documentation synced in `AGENTS.md` and `apps/mobile/CLAUDE.md` so future icon work treats these PNGs as the current runtime baseline rather than reverting to generic vectors.
- Verification: `git diff --check` passes. `npm run typecheck` still fails with the existing TypeScript compiler `RangeError: Maximum call stack size exceeded`, so it did not provide a targeted check for this icon-only change.

---

## 2026-08-12 — Domains progress indicator refinement

- Adjusted `RiverStoneProgress` with a `showZeroFill` option so 0% states can render as genuinely empty recessed tracks instead of showing a minimum-width accent pill.
- Updated `AreasScreen.tsx` so Domain-grid progress uses quiet empty tracks at 0%, restrained brass for actual progress and vermilion only for Focus/active emphasis.
- Lightly rebalanced Domain cards for the new PNG icon baseline: slightly larger icon display, calmer score badge and a little more card padding/height so titles and artwork have room.
- Documentation synced in `AGENTS.md` and `apps/mobile/CLAUDE.md`.
- Verification: `git diff --check` passes. `npm run typecheck` still fails with the existing TypeScript compiler `RangeError: Maximum call stack size exceeded`, so it did not provide a targeted check for this visual/progress change.

---

## 2026-08-12 — RKA destination PNG refresh: Skills, Potential, Achievements, Routines

- Added transparent PNG artwork under `apps/mobile/assets/icons/collections/` for four destination concepts: `skills-nodes.png`, `potential-core.png`, `achievement-medal.png`, and `routine-steps.png`.
- Updated `CollectionIcons.tsx` with RN Image wrappers for those files and wired `MenuScreen.tsx` to use them in the Collections grid, replacing the temporary vector/SVG implementation.
- Current directions: Skills = connected capability nodes, Potential = simplified core/orbit mark, Achievements = restrained medal, Routines = ordered numbered steps. Existing PNG/object icons for Habits, Workouts, Medications, To Get and Archive are unchanged.
- Briefly tested a richer standalone generated PNG set, but it was too detailed and game-object-like. The runtime files were then regenerated as individual transparent PNG icons matching the simpler approved mockup-sheet style: rounded, softly dimensional, clean silhouettes, normalized 1254px transparent canvases and consistent active artwork bounds. Illustrator/vector-master exports can still replace the PNG files later without changing the app wiring.
- Verification: `git diff --check` passes. `npm run typecheck` still fails only on known pre-existing errors: Expo web `.web.tsx` module-resolution entries and the unrelated `src/db/database.ts(1201,11)` `"skill"` type mismatch.
- Next: review the four icons on-device in the Collections grid at real size; if they read well, replace the provisional PNGs with polished Illustrator exports using the same filenames or wrappers.

---

## 2026-08-11 — Warm-depth River Stone material pass promoted to production tokens

- Promoted the approved cool graphite/warm-depth material direction into the shared native material tokens instead of repainting screens one by one. `RiverStoneSurface` now uses a cooler charcoal base, stronger broad upper-left illumination, deeper lower-right/contact shadowing and larger radii for list/card/hero/tray variants.
- Adjusted the River Stone layer geometry so ambient highlight and lower occlusion extend well outside the clipped face. This specifically targets the prior task-row horizontal banding problem: the user should no longer be able to point at where the highlight layer terminates on short list rows.
- Follow-up seam fix after on-device screenshots: River Stone now renders its main light **and** lower thickness as full-face continuous gradients in `RiverStoneSurface`, rather than finite shaped upper/lower slabs. The extra localized upper glow and lower corner slabs were removed from the render stack, and list/card/hero/tray edge-catch strokes were reduced so repeated cards do not expose a visible horizontal layer boundary.
- Follow-up colour correction after dark/light screenshots: the full-face light/shade gradients now scale the palette colour's own rgba alpha instead of replacing it with absolute token opacity. This keeps dark surfaces graphite rather than silver/washed-out and keeps light-mode surfaces softly warm instead of muddy.
- Final dense-surface correction: `RiverStoneSurface` now treats `list` and `card` as "everyday stone" with **no internal vertical face gradients and no edge-catch strokes at all**. Dense repeated rows/tiles rely on base graphite/stone colour, silhouette, stronger backing/contact shadows and a subtle full-perimeter boundary; larger hero/tray surfaces can still carry broader continuous lighting. This is the hard rule for avoiding visible two-layer bands in grids and task lists.
- Kept icon treatment intentionally unchanged in this pass. Collection/destination icons still keep their semantic object colours; the material system governs the stone/iron surfaces around them, while brass/vermilion remain sparse state/action accents.
- Synced the older `theme/riverStone.ts` tray/header constants with the same depth direction so the bottom navigation and header chrome stay visually related to the updated cards.
- Cooled the dark app background tokens from purple-black toward sumi blue-black (`#0B0E16`) and updated dark stone surface to `#181B21`.
- Small Tasks screen cleanup: the filter/status chip now uses a cooler iron-like fill, subtle inactive boundary and soft depth instead of a flat dark rectangle.
- Verification: `git diff --check` passes. `npm run typecheck` still fails only on known pre-existing errors: Expo web `.web.tsx` module-resolution entries and the unrelated `src/db/database.ts(1201,11)` `"skill"` type mismatch.
- Next: review Collections, Tasks, Potential/Profile and the bottom dock on-device; tune token strength if the shadows feel too heavy, then do a separate controlled icon-standard pass rather than bundling icon replacement into material adoption.

---

## 2026-08-11 — Material Sheet workbench for RKA.OS material-language exploration

- Added `apps/mobile/src/components/dev/MaterialSheetWorkbench.tsx`, a contained native dev workbench for comparing the proposed Washi/Sumi, River Stone, Blackened Iron, Urushi Lacquer and Gold/Brass material roles against real RKA.OS content patterns.
- Wired it into `SettingsScreen.tsx` under the existing `__DEV__` "DEV TOOLS" section as an expandable "Material sheet" panel, alongside the existing Hero environment registration workbench.
- The sheet intentionally does **not** change production surfaces yet. It includes repeated River Stone task rows for seam/banding checks, collection tiles using existing collection artwork, a TimelinePaper washi sample, and first-pass iron/urushi/brass swatches for discussion/tuning.
- Verification: `npm run typecheck` still fails only on pre-existing project errors: Expo web `.web.tsx` module-resolution false alarms and the unrelated `src/db/database.ts(1201,11)` `"skill"` type mismatch. The new Material Sheet error found on the first run was fixed.
- Next: review the sheet on-device in dark mode first, tune material physics/tokens, then decide whether to prototype a reusable `MaterialSurface` API before applying changes to real screens.

---

## 2026-08-10 — Calendar and Timeline planning-drawer refresh

- `CalendarScreen.tsx` now keeps the Month grid compact and shows a selected-day mini agenda below it. Date selection remains in the Calendar instead of immediately switching modes; the agenda opens Timeline only when the user chooses it.
- Replaced the top, full-height Timeblocking overlay with a River Stone bottom planning drawer: a compact persistent `Plan your day · N unscheduled` control above the global dock expands into a lower-half sheet with a grab handle, `Unscheduled` and `Anytime Today` groups, a clear collapse control and restyled, compact planning-queue rows. Rows now show type/status (`Task · Unplanned`, etc.), a restrained type mark and a drag grip instead of repeated `No date` labels.
- A selected day with no timed blocks now gets an in-grid "Your day is open" prompt and a direct `Plan a block` path instead of a featureless empty timeline.
- Timeline now stays on one selected day; its header arrows step one day at a time. Drag behavior is unchanged within that day: while dragging, the drawer yields to the 15-minute timeline grid.
- Removed the continuous-timeline remnants: the between-day paper wave, `Block now` header and category-lane icon strip. Scheduled items now occupy one clean timeline column, while their accent colour still communicates type.
- Refined the day chrome: the header now reads as one compact date (`Tue, Aug 11`), Calendar/Timeline is a restrained segmented control, midnight is no longer clipped, and a `23:59` end marker closes the grid. Timeline events now render as compact labelled blocks with icon, title and time rather than isolated pins.
- Verification: `git diff --check` and `npx expo export -p ios` pass (the export still prints the existing React Native package-exports warnings). `npm run typecheck` still stops on the pre-existing Expo-web extension/module-resolution errors and the unrelated `database.ts` skill contribution type mismatch; it reports no CalendarScreen error.
- Next: validate the compact queue and one-day drag behavior on an iPhone development build with real long task titles and Dynamic Type.

---

## 2026-08-10 — App-wide lag / cold-start-hang hardening

A pass to eliminate the "app hangs a beat or two after open" symptom on a proper (swipe-closed) relaunch, on `feature/routines-quantified-habits`. Root discipline established: **nothing heavy runs on the critical path; background work yields to interaction.** The JS thread is single-threaded and the data layer is 100% synchronous SQLite (186 sync calls, 0 async), so any heavy work on mount/render is felt directly.

### Changes
- **Deferred sync startup:** `useBackup.ts` no longer attaches the 6 Firestore `onSnapshot` listeners inline when auth resolves — it defers via `InteractionManager.runAfterInteractions` (with a 3s hard-cap fallback via a local `scheduleWhenIdle` helper, so a starved interaction queue can't leave sync permanently unstarted). This was the main cold-start hang: applying the first full-collection snapshot competed with first-frame render and first taps.
- **Batched sync reads:** `firestoreSync.ts`'s listeners applied one synchronous SQLite `SELECT` *per changed doc* to read local timestamps for the newer-wins comparison — a full-collection first sync meant hundreds/thousands of native-bridge round trips on the JS thread. Now one batched `WHERE id IN (...)` read per snapshot (`loadLocalTimestamps`, chunked at 500). Write path/conflict logic byte-for-byte unchanged.
- **Subtle sync indicator:** new `services/syncStatus.ts` (framework-free store, `beginInitialSync`/`markInitialSyncListenerDone`/`resetSyncStatus`, 12s safety timeout) + `hooks/useSyncStatus.ts` (useSyncExternalStore) + `components/header/SyncIndicator.tsx` (a small pulsing dot in `AppHeader` beside the "RKA" wordmark, reduce-motion aware, `pointerEvents="none"`). Shows only during the initial post-cold-start catch-up; clears when all 6 listeners have delivered their first snapshot.
- **`computeOverallPotential` N+1 removed** (`database.ts`): was 2 SQLite queries *per Domain* (`getPotentialStatsForArea` + `getActiveContributionsForArea`) — ~16 across the 8 canonical Domains, on every Home refresh/item-save. New batched `getPotentialStatsForAreas`/`getActiveContributionsForAreas` (one query each); threaded through `computeDomainScore`/`computeDomainMaintenance`/`getPotentialStatResultsForArea` via optional precomputed params (single-area callers like `AreaDetailScreen` unchanged).
- **Render-time DB query storms removed** (were re-running on *every* render, not just mount): `ProjectsScreen` (2–4 queries/row → precomputed `rowDataById` memo), `AreaDetailScreen` (`getProjectItemCount` ×2/row → `projectCounts` memo), `AreasScreen` (`getAreaProjectCount`/row → folded into the focus-effect precompute), `TasksScreen` (`getProjectTitle` + up-to-2 `getBlockingTask`/row, during drag → `projectTitleById`/`blockerIdById` memos), `MedicationsScreen` (`getLastTakenLog`/med → `lastLogByMedId` memo; `computeFocusState` stays per-render so the 60s timeline still advances).
- **Home mount de-duplication:** removed the redundant second mount-refresh in `HomeScreen` (the `useHomeData`/`useUpcomingPreview`/`useTodayHabits` hooks already self-refresh on mount) and the duplicate `refresh()` in `PlanBackwardsCountdownWidget`; memoized Home's derived list filters. `WeatherWidget` now always renders its card shell with a placeholder while loading (no more row height jump). Removed an eager boot-time `requestLocationPermission()` from `App.tsx` (it requested the throttled "Always Allow" upgrade and its delayed prompt read as a mid-navigation hang; geofencing still requests lazily in `addGeofence`).
- **Dev guardrail:** `getDb()` wraps the sync SQLite methods in `__DEV__` only (`instrumentDbForDev`) and `console.warn`s with the offending SQL whenever a call blocks the JS thread ≥16ms — a tripwire so future N+1s/scans surface at write time. Compiled out in production.

### Verification
- `npx tsc --noEmit` — no new errors from any touched file. The single remaining `database.ts` `skill`/`mission` arg error is pre-existing and untouched.
- `node --test` on `potential.test.ts` + `domainScoring.test.ts` — 24/24 pass (scoring math unchanged; only the DB-read shape around it changed).
- **On-device follow-up (same day): the guardrail caught the real culprit.** A physical relaunch still froze ~10s on first navigation. The `__DEV__` db-perf guardrail printed the smoking gun in Metro:
  ```
  [db-perf] withTransactionSync blocked the JS thread 162ms / 182ms / 306ms / 330ms
  FirebaseError: [code=resource-exhausted]: Write stream exhausted maximum allowed queued writes.
  [backup] background push failed [FirebaseError: Missing or insufficient permissions.]
  ```
  1. **The freeze is Firestore sync applying a whole subcollection in ONE synchronous `withTransactionSync`** (160–330ms per listener; several back-to-back = the multi-second hang). The batched-READS fix above didn't cover it because the dominant cost was the WRITE volume in one transaction. **Fixed:** `firestoreSync.ts`'s six listeners now apply changes through a shared `applyDocChangesInChunks` helper — 100 writes per short transaction, yielding the JS thread (`setTimeout 0`) between chunks so no single synchronous block exceeds a frame. Same newer-wins/write logic and `markFirst` sync-indicator wiring, just chunked. `tsc` clean, potential/domain tests still pass.
  2. **⚠️ SEPARATE BACKEND ISSUE — NOT FIXED, needs action outside the RN client.** Firestore is **rejecting** the sync/backup writes (`Missing or insufficient permissions`) so they queue, retry, and exhaust the write stream (`Write stream exhausted`). This is constant background churn and explains why there's so much to re-apply each launch. **Action:** review/deploy Firestore security rules so the authenticated user can write their own `users/{uid}/{items,itemInstances,itemRelations,itemOrder,appSettings,activityLogs}` subcollections + backup doc, and confirm `auth.currentUser.uid` matches the rules' path. Until then sync never persists to the cloud and the app keeps retrying.
- **Still to confirm on next relaunch:** with chunking in place, the on-navigation freeze should be gone even while the (still-failing) writes churn in the background.

### 2026-08-10 (later) — freeze root cause corrected; redundant backfill removed
Instrumented `firestoreSync.ts` with `[sync-perf]` logging and did a clean swipe-closed relaunch. The evidence **corrected two claims above**:
- **The chunking fix (point 1) worked.** Worst JS-thread block this run was **26ms** (one `SELECT * FROM items`); the 2528-row `activityLogs` apply spread 398ms across 26 yielded chunks. The 162–330ms `withTransactionSync` blocks are gone.
- **Point 2 (rules/permissions) was a dead end.** The deployed Firestore rules already match `firebase/firestore.rules` and cover every path the client writes (verified: `firebase deploy --only firestore:rules` was a no-op "already up to date"; composite `backups` index is deployed). The `Missing or insufficient permissions` / `Write stream exhausted` messages were a *downstream symptom* of the SDK write queue backing up, not a real rules rejection.
- **The actual "hangs a couple seconds after open" culprit: `backfillLocalToRemote`.** Commented "one-time reconciliation" but nothing gated it — every cold start it did three sequential full-collection `getDocs` (items/itemInstances/itemRelations), re-downloading exactly what the six `onSnapshot` listeners already fetch. Measured: **23.3s wall, 0 pushes.** Pure redundant network + double deserialization on the JS thread.
- **Fix:** deleted the standalone `backfillLocalToRemote`. The push-local-only-rows step is now folded into each listener's *first snapshot* via `pushLocalOnlyRows` + `buildRemoteVersionMap`, reusing the remote collection the listener already delivered — zero extra `getDocs`. Pushes are sequenced one-at-a-time (`setTimeout` between each) so a large reconciliation can't re-trigger `Write stream exhausted`. Existence-only semantics preserved for `itemRelations`. `tsc` clean, 24/24 potential+domain tests pass. Instrumentation removed. **Recommend removing the stale "SEPARATE BACKEND ISSUE" action item — no backend change is needed.**

### 2026-08-10 (later still) — residual lag traced to activityLogs re-sync; watermark fix
The prior fixes helped but the user still reported *slight* cold-start lag + a delayed first FAB tap, and — crucially — framed it as a **regression** ("app was seamless until a couple days ago"). Worked it with on-device `[boot]`/`[db-perf]` logging over a live Metro tail, isolating each suspect with reversible A/B flags rather than guessing. Findings, in order:
- **SQLite was in the default rollback-journal mode**, which `fsync`s the main DB file on *every* COMMIT — a fixed ~15–25ms per write transaction on iOS flash *regardless of transaction size* (confirmed: a single-row INSERT blocked the thread as long as a multi-row chunk). **Fix:** `getDb()` now runs `PRAGMA journal_mode = WAL` right after `openDatabaseSync`, before schema/migration. WAL appends to a `-wal` file on commit and checkpoints separately, so writes stop paying a synchronous fsync tax. This alone removed the steady stream of `[db-perf]` COMMIT/withTransactionSync warnings.
- **`firestoreSync.ts`'s `buildRemoteVersionMap` walked the entire collection calling `.data()` on every doc** — forcing Firestore proto→JS deserialization for the whole `items`/`itemInstances`/`itemRelations` collection in one unyielded pass *outside* `applyDocChangesInChunks`' chunking (and, for items/instances, a *second* deserialization on top of the chunked write pass). Invisible to `[db-perf]` since it never touches SQLite. **Fix:** the version map is now accumulated inside the already-chunked `applyChange` callback — one pass, chunked, no duplicate deserialization. `applyDocChangesInChunks` also shrunk its chunk 10→5 and swapped the `setTimeout(16)` yield for `requestAnimationFrame` (guarantees a paint between chunks instead of just yielding the event loop).
- **Home stripped to reduce mount-time query load:** per user request, removed all Home widgets except `MedicationQuickLogWidget` (Journey/Potential strip, Daily Check-In, Weather, Plan Backwards countdown, Habits — deleted from the tree, not hidden, so nothing queries for them on cold start) and the nested Today/Upcoming segmented control inside `TodayCard` (redundant with Home's top-level Today/Upcoming/Anytime/Someday/Logbook chips). Home's secondary views are now strictly **task-only** (`getTodayItems`/`getCompletedItems` aren't type-scoped at the query level, so Today + Logbook filter `type === 'task'` client-side; Anytime/Someday already SQL-scoped). Dropped `useUpcomingPreview`/`useTodayHabits`/`useDailyCheckIns`/`computeOverallPotential`/`getFocus` from `HomeScreen`, plus the `onViewUpcoming` prop + its `App.tsx` wiring.
- **`requestNotificationPermission` re-requested every boot** (`useNotifications.ts`) — `requestPermissionsAsync()` is a ~295ms native round-trip even when already granted (no prompt shown, just a status query). **Fix:** read the cheap `getPermissionsAsync()` first and only escalate to a real request while status is `undetermined`. Dropped the `[boot]` number from ~295ms to ~7–14ms.
- **THE main culprit — `activityLogs` cold-start re-sync (a data-growth regression).** `activityLogs` is append-only and only grows; the sync code is 2 weeks old but the *data* crossed a pain threshold recently. On every cold start Firestore delivered the *entire* collection as "added" and the chunked apply loop re-processed all of it across many frames — running a few seconds post-launch, exactly when the user reached for the FAB. Confirmed by A/B-gating the listener off (FAB became instant). **Fix (watermark):** the `activityLogs` listener now uses `query(ref, where('createdAt', '>', watermark))` instead of the full collection, where `watermark` is a **device-LOCAL** value (`_local.activityLogsSyncWatermark` key in `appSettings`, written directly in `firestoreSync.ts` so it is never pushed to Firestore — must not sync across devices). It seeds from the local table's `MAX(createdAt)` when unset, so a device that already holds history is cheap on the very first post-fix launch. `onComplete` advances + persists the watermark. This turns cold-start cost from O(all history) back to O(rows since last launch) — it cannot creep back the way it did. **Tradeoff (accepted by user):** a cross-device EDIT or DELETE of an *old* activityLog (createdAt ≤ watermark) won't propagate through this listener; a full backup/restore still reconciles it. Fine for a mostly single-user app.

**Architecture note (came up with the user):** the lag was never a *network* problem, and enabling Firestore's own offline cache would not have helped — SQLite *is* the local cache (dual-write: SQLite primary + durable, Firestore layered on top only for cross-device sync). The cost was the JS thread re-*applying* remote docs into SQLite each launch, not fetching them. (Also: this app uses the JS `firebase` SDK with plain `getFirestore` — no `persistentLocalCache`; on RN that SDK's Firestore persistence is memory-only regardless.)

**Verification:** on-device, cold start + FAB + navigation all instant with the watermark fix and the full River Stone material restored (a brief flat-material A/B confirmed the material was a minor contributor, not the cause). `tsc` clean on all touched files. Temporary `[boot]` instrumentation and both A/B experiment flags removed (the `RIVERSTONE_FLAT_EXPERIMENT` flag remains in `RiverStoneSurface.tsx`, defaulted `false`, as a dormant escape hatch). The permanent `[db-perf]`/`[startup-perf]` `__DEV__` guardrails in `database.ts` are unchanged.

---

## 2026-08-10 — Daily Check-In / Daily Log v1

Built the native-first structured daily logging ritual from the approved design/spec (`docs/superpowers/specs/2026-08-10-daily-check-in-design.md`) and implementation plan (`docs/plans/2026-08-10-daily-check-in.md`).

### Changes
- **Schema:** new dedicated `dailyCheckIns` SQLite table (`dateKey`, `phase`, `answers`, timestamps, unique `(dateKey, phase)`) plus `DailyCheckInRow` type and repository functions (`upsertDailyCheckIn`, `getDailyCheckIn`, `getDailyCheckInsForDate`, `getDailyCheckIns`). This table is intentionally separate from `items`: check-ins are logs, not tasks.
- **Pure logic:** new `src/utils/dailyCheckIn.ts` (+ tests) covers local date assignment, including the `12:00 AM - 2:00 AM` previous-day Evening Debrief rule, Home prompt-window selection, safe answer parsing, editability (today/yesterday only), and explainable priority suggestion ranking.
- **Native UI:** Home now renders `DailyCheckInCard.tsx` under the Journey summary. It shows Morning Check-In, midday catch-up, Evening Debrief, or Today Logged based on time windows and saved entries.
- **Stepper flow:** `DailyCheckInFlowScreen.tsx` implements onboarding-style morning/evening flows with label chips, optional notes, explainable suggested priorities, freeform priorities, evening priority outcomes, friction/helped chips and review/save.
- **History:** `DailyLogScreen.tsx` shows reverse-chronological daily summaries, reachable from Home and Profile. Today/yesterday are editable; older rows are read-only.
- **Web compatibility:** `database.web.ts` exposes in-memory Daily Check-In functions only so shared hooks remain bundle-safe. Desktop web UI parity is not built yet and is documented as a gap.
- **Docs:** updated `apps/mobile/SCHEMA.md`, `apps/mobile/CLAUDE.md`, and `AGENTS.md` with the feature contract and the hard rule that saving a check-in never mutates task status/order/schedule, Potential, Domain scoring, Focus weights, habits, routines or achievements.

### Verification
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/dailyCheckIn.test.ts` — 10/10 passing.
- `npm run typecheck` — no new Daily Check-In errors surfaced; still reports the existing Expo web `.web.tsx` resolution false alarms plus the pre-existing `database.ts` skill contribution type error.
- Full `npm test` still expected to show the pre-existing missing Ronin authoring manifest failure unless that separate Ronin cleanup lands first.

### Next steps
- On-device pass through the Home card, morning save/edit, evening save/edit, Profile → Daily Log, and post-midnight date behavior.
- Future pass: assistant read-only context and suggestion flow; desktop web Daily Log parity if prioritized.

---

## 2026-08-08 — Plan Backwards v1 (new deadline/anchor-based planning workspace)

Implemented the full v1 of Plan Backwards end-to-end in one sweep on `feature/routines-quantified-habits` — a standalone screen (`Menu` → "Plan Backwards", not folded into Today yet, per spec) where the user sets a Goal Time and works backwards to see what must happen before it.

### Changes
- **Schema:** two new tables, `planBlocks`/`planBlockSteps` (`apps/mobile/src/db/database.ts`'s `initSchema`), plus a new `items.type` value `'backward-plan'`. Plan components (Routine/Task/Travel) are dedicated rows, not `items`, because their placement/buffer/completion state is plan-instance-specific — adding an existing Routine template to a plan **copies** its steps (`addPlanBlockRoutine`), never links live, so completing a step today never mutates the reusable template. See `apps/mobile/SCHEMA.md`'s new `planBlocks`/`planBlockSteps` section and `backward-plan` entity row for the full column reference.
- **Domain math:** `apps/mobile/src/utils/backwardPlanCalc.ts` — pure, tested functions (`calculateTimeRemaining`, `calculateRoutineRemainingDuration`, `calculatePlanRequiredDuration`, `calculateUnallocatedTime`, `calculateLeaveBy`, `buildBackwardsSchedule`, `formatDurationMinutes`). `apps/mobile/src/utils/backwardPlanMeta.ts` holds the metadata shapes (`BackwardPlanMeta`, `TravelConfig`, `PlacementBehavior`).
- **Repository:** ~20 new functions in `database.ts`'s "Plan Backwards" section (create/update/delete plan, add/update/delete/reorder blocks and steps, toggle completion, default-departure-point setting).
- **Hook:** `useBackwardPlans`/`useBackwardPlan` in `useDb.ts` (minute-tick recalculation).
- **UI:** `PlanBackwardsScreen.tsx` (list + empty state), `PlanBackwardsDetailScreen.tsx` (anchor card, three-metric time budget, backwards-ordered plan blocks with expandable routine steps, over-capacity warning, notes), `AnchorEventEditSheet.tsx` (create/edit anchor incl. optional device-calendar link — read-only, never writes back), `AddPlanBlockSheet.tsx` (tabbed Routine/Task/Travel add flow). Registered in `MenuStack.tsx` + `MenuScreen.tsx`.
- **Travel/routing:** manual-duration fallback only for v1 — no live Apple Maps/MapKit routing wired up (`TravelConfig`'s shape is structured so that can be added later without a data-model change). This is the one spec item deliberately deferred; everything else in the spec was implemented.
- **Tests:** `backwardPlanCalc.test.ts`, 17 new passing tests (completed-step exclusion, buffer inclusion/exclusion, deficit, Leave By, backwards ordering, zero-width completed-block slot).

### Verification
- `cd apps/mobile && npm test` — 203/204 passing; the 1 failure (`roninJourneyAnimation.test.ts`, missing `storybook-journey-rig.manifest.json`) is pre-existing and unrelated — that asset was already deleted in the working tree per the 2026-08-08 Ronin Rive entry below, before this work started.
- `npx tsc --noEmit` — no new errors from any touched file. Fixed two pre-existing `Record<ItemType, string>` maps (`ArchiveScreen.tsx`, `HomeScreenExperimental.tsx`) that were already missing a `skill` entry from an earlier change; added both `skill` and `backward-plan` while there. Three remaining errors (`database.ts` skill/mission arg, `AreaDetailScreen.tsx` `absoluteFillObject`) are pre-existing and untouched by this work.
- Not yet verified in a running dev client — next step is an on-device pass through the "Today test scenario" from the spec (see below).

### Next steps
- On-device verification: open Plan Backwards from Menu, tap "Add Event", set title "Friend's dinner" + Goal Time 8:00 PM, add a "Get Ready" routine (Shower/Shave/Hair/Get dressed), a "Wrap present" task, and a Travel block — confirm the three metrics update live, and that completing a step (e.g. Shave) immediately drops it from Time Required while staying visible struck-through.
- Desktop web port — not yet ported (`apps/mobile/CLAUDE.md`'s screen-parity list tracks this).

## 2026-08-08 (later same day) — Live Apple Maps routing for Plan Backwards' Travel block

Closed the one deferred spec item from the entry above: Travel blocks can now fetch a real ETA from Apple's Maps Server API instead of manual-duration-only. User explicitly chose Apple over Google Maps Platform (avoids a GCP billing dependency, stays in-ecosystem) after being asked to weigh the tradeoffs.

### Architecture
- **New `functions/` package** (Firebase Cloud Functions, 2nd gen, TypeScript) — `getAppleMapsToken`, an `onCall` function that signs an ES256 JWT (`iss`=Team ID, `kid`=Key ID, `exp`=15 min) with a private key held only as a Cloud Functions secret, exchanges it via Apple's `GET /v1/token`, and returns `{ accessToken, expiresInSeconds }` to the client. **The private key never leaves the server** — this is the whole reason a Cloud Function exists here rather than signing on-device; a mobile app bundle is not a safe place for a long-lived signing key (it can be extracted and abused to mint unlimited tokens under this project's identity).
- **Client** (`apps/mobile/src/services/appleMaps.ts`): caches the short-lived access token in memory, then calls Apple's `GET /v1/geocode` (address → coordinates) and `GET /v1/etas` (coordinates + `transportType` → `expectedTravelTimeSeconds`/`distanceMeters`) directly — no further server round-trip needed once it has a token. `estimateTravel(start, destination, mode)` is the one entry point `AddPlanBlockSheet.tsx`'s Travel tab calls; it geocodes both ends then fetches the ETA, returning `null` at any failure point (bad address, no network, no token, Apple 401/429/500) so the UI falls back to manual entry exactly as if live routing didn't exist — never blocks the feature, never fakes a number.
- Response parsing (`parseGeocodeResponse`/`parseEtaResponse`) lives in `apps/mobile/src/utils/appleMapsParsing.ts` — split out from the service on purpose, since that file imports Firebase/React Native and can't run under this repo's plain-Node test runner; the parsing logic itself has no such dependency and is fully unit-tested (6 passing tests).
- `TravelConfig` (`apps/mobile/src/utils/backwardPlanMeta.ts`) gained `source: 'manual' | 'live'`, `distanceMeters`, `estimatedAt`. Editing any travel input after a live estimate (start/destination/mode/duration) resets `source` back to `'manual'` in `AddPlanBlockSheet.tsx` — a stale "Live" tag is worse than none. The Plan Backwards detail screen shows "· Live · X km" next to Leave By for travel blocks with a live estimate.
- Verified Apple's exact endpoint/field names (`/v1/token`, `/v1/geocode`, `/v1/etas`, `expectedTravelTimeSeconds`, `distanceMeters`, `transportType` enum values) against Apple's live developer documentation before writing the integration, rather than from memory.

### What you (the user) need to do before this actually works
Nothing here can be done by the agent — they require your Apple Developer and Firebase account access:
1. **Apple Developer** (developer.apple.com → Certificates, Identifiers & Profiles): create a **Maps ID**, then a **Maps Server API key** (a private key, downloaded once as a `.p8` file) associated with it. Note the **Team ID** (top-right of the account page) and the **Key ID** (shown when you create the key).
2. **Upgrade the `rka-os` Firebase project to the Blaze (pay-as-you-go) plan** if it isn't already — Cloud Functions require Blaze even for low-volume usage (there's still a generous free tier within it).
3. From `functions/`, run `firebase functions:secrets:set APPLE_MAPS_TEAM_ID`, `firebase functions:secrets:set APPLE_MAPS_KEY_ID`, and `firebase functions:secrets:set APPLE_MAPS_PRIVATE_KEY` (paste the full `.p8` file contents, including the `-----BEGIN/END PRIVATE KEY-----` lines, when prompted for the last one).
4. `cd functions && npm install && firebase deploy --only functions`.
5. Until steps 1-4 are done, the "Get live ETA from Apple Maps" button in the app will silently fail and fall back to manual entry — this is expected, not a bug, and requires no code change once the above is complete.

### Verification
- `cd functions && npm install && npx tsc --noEmit && npm run build` — clean, no errors, `lib/index.js` produced.
- `cd apps/mobile && npm test` — 209/210 passing (same 1 pre-existing, unrelated Ronin-asset failure as the entry above), including 6 new `appleMapsParsing.test.ts` cases.
- `npx tsc --noEmit` (apps/mobile) — no new errors.

### Live deploy (done same session, with the user)
User provisioned the Apple Developer Maps ID/key and upgraded `rka-os` to Blaze themselves; ran the actual `firebase functions:secrets:set` (×3) and `firebase deploy --only functions` commands together in-session. `getAppleMapsToken` is live in `us-central1`; also fixed a `firebase functions:artifacts:setpolicy` warning (container image cleanup) surfaced during that deploy. Not yet confirmed with a real on-device tap of "Get live ETA" — the code path is live end-to-end but hasn't been exercised from the app itself yet.

## 2026-08-08 (later still) — Apple Maps location search-as-you-type

Follow-up to the entry above: replaced plain free-text Location/From/To fields with a real search-and-select flow, now that Apple Maps is wired up.

- **New:** `apps/mobile/src/components/LocationSearchField.tsx` — debounced (300ms, 3+ char minimum) dropdown backed by `searchLocations()` (`services/appleMaps.ts`, hitting Apple's `/v1/searchAutocomplete`). Each result carries its own `{latitude, longitude}` from Apple, so picking a suggestion never needs a follow-up geocode call. Stale slower responses are dropped via a request-id guard so a fast second keystroke's results can't be overwritten by a slow first keystroke's. Typing without picking a suggestion still works as plain free text — same fail-soft principle as the rest of the Apple Maps integration (empty/no-network/no-token just means no dropdown, never a blocked field).
- **Changed:** `AnchorEventEditSheet.tsx`'s Location field and `AddPlanBlockSheet.tsx`'s Travel From/To fields now use `LocationSearchField` instead of a plain `TextInput`.
- **New pure parser:** `parseSearchAutocompleteResponse` in `apps/mobile/src/utils/appleMapsParsing.ts` (3 new tests, verified against Apple's live current docs for the endpoint's exact field names before implementing).

### Verification
- `cd apps/mobile && npm test` — 212/213 passing (same 1 pre-existing, unrelated Ronin-asset failure), including the 3 new autocomplete-parsing tests.
- `npx tsc --noEmit` — no new errors (fixed two real type errors surfaced while building this: a `useRef` needing an explicit generic default, and a `.filter` type-predicate mismatch in the parser).

### On-device bug found + fixed same session
User tested on-device: dropdown was empty for every query, no visible error (fails soft by design, which made this silent). Diagnosed by minting a real token from the deployed Cloud Function via curl and hitting Apple's live endpoints directly — `geocode`/`etas` matched their docs exactly, but `/v1/searchAutocomplete`'s `location` field is actually `{latitude, longitude}` at runtime, not the `{lat, lng}` shape Apple's own documentation shows. `parseSearchAutocompleteResponse` now reads both shapes defensively. Confirmed working on-device afterward (real results with distances, matching native Maps' behavior once the location-bias entry below also landed).

### Verification
- `cd apps/mobile && npm test` — 213/214 passing (same 1 pre-existing failure), tests updated to assert the real `latitude`/`longitude` shape as primary with `lat`/`lng` as a secondary accepted case.
- `npx tsc --noEmit` — clean.

## 2026-08-08 (final) — Rank location search results by proximity, like native Maps

User compared against the native Apple Maps app's search (screenshot showed "9.7 mi", "4.7 mi" distance-ranked results) and asked for the same. Apple's `/v1/searchAutocomplete` supports `userLocation`/`searchLocation` params for exactly this.

- **New:** `apps/mobile/src/services/deviceLocation.ts` — `getApproximateLocation()`, same `expo-location` foreground-permission pattern as `services/locationReminders.ts`, tries `getLastKnownPositionAsync` first (instant) before a fresh GPS fix, cached 5 min module-wide (so multiple `LocationSearchField`s on one screen — e.g. Travel's From and To — only prompt/fetch once), fails soft to `null` on denial/error.
- **Changed:** `searchLocations(query, near?)` in `services/appleMaps.ts` now accepts an optional bias coordinate, sent as both `userLocation`/`searchLocation` query params. `LocationSearchField.tsx` fetches the device location lazily on first focus (no permission prompt until the field is actually used) and passes it through.
- Updated `NSLocationWhenInUseUsageDescription` in `app.json` to mention both existing purposes (location-based reminders + now, search ranking) — **requires a new dev-client build to take effect**, since Info.plist strings are baked in at build time, not hot-reloadable.

### Verification
- `npx tsc --noEmit` (apps/mobile) — clean, same 3 pre-existing unrelated errors as every other entry above.
- `npm test` — 213/214 (unchanged; no new pure-function surface added here to test beyond what's already covered).
- Not yet re-verified on-device after this specific change (bias params) — worth confirming search results now favor nearby places the way the native Maps comparison showed.

## 2026-08-08 (final, final) — Per-result ETA badges in the Travel search dropdown

User asked for one more thing from the native Maps comparison: showing estimated travel time next to each search result once a start point is set.

- **New:** `parseEtasResponse` (`appleMapsParsing.ts`) — batched-response counterpart to the existing single-destination `parseEtaResponse`, position-aligned array output (never drops/reorders, `null` for a malformed entry) so callers can zip it against their own results by index. `getEtasBatch(origin, destinations[], mode)` (`services/appleMaps.ts`) calls `/v1/etas` once with up to 10 pipe-separated destinations (Apple's own cap) rather than one request per row.
- **Changed:** `LocationSearchField` gained optional `etaOrigin`/`etaMode` props — when both are present, one batched ETA call fires per settled results list, and each dropdown row shows its own duration badge. `AddPlanBlockSheet.tsx`'s Travel "To" field now passes these, sourced from a `travelStartCoords` state captured for free via the "From" field's `onSelectPlace` (no extra geocode call) and cleared on any manual edit to "From" — a badge is never left showing numbers computed from a since-changed origin.
- Live-verified the batched endpoint directly via curl (2 destinations in one `/v1/etas` call, response order matched request order) before wiring it into the UI.

### Verification
- `cd apps/mobile && npm test` — 216/217 passing (same 1 pre-existing, unrelated failure), including 3 new `parseEtasResponse` tests.
- `npx tsc --noEmit` — clean, same 3 pre-existing unrelated errors.
- Not yet exercised on-device.

## 2026-08-08 (truly final) — Weather widget on Home, using the banked WeatherKit credentials

User asked to set up WeatherKit while already in the Apple Developer certificates flow (separate tangent from Plan Backwards' Maps work); once the key was banked, asked to actually build a plain weather widget on Home now (hero-background-matches-weather explicitly deferred to later).

### Architecture
- **`functions/src/index.ts`**: new `getWeather` onCall function — a full proxy, unlike `getAppleMapsToken`. WeatherKit has no token-exchange step (Maps' `/v1/token` has no WeatherKit equivalent); the self-signed JWT itself is the bearer token, so the function signs it AND calls `weatherkit.apple.com/api/v1/weather/en/{lat}/{lng}?dataSets=currentWeather&timezone=...` itself, relaying the JSON straight to the client. One call site meant a client-side token cache (like Maps has) would've been pure overhead. Verified WeatherKit's JWT shape against Apple's live docs before implementing — it genuinely differs from Maps': header needs `id: "{teamId}.{bundleId}"`, payload needs `sub: "{bundleId}"` (`com.rahul.rkaos`, since WeatherKit was enabled directly on the App ID rather than via a separate Services ID). `jsonwebtoken`'s TS types don't know about WeatherKit's `id` header field — needed a type-cast, documented inline as intentional, not a mistake.
- **`apps/mobile/src/utils/weatherParsing.ts`**: pure `parseCurrentWeather`/`describeConditionCode`/`getWeatherEmoji` (6 tests) — same split-for-testability pattern as `appleMapsParsing.ts`.
- **`apps/mobile/src/services/weather.ts`**: `getCurrentWeather(lat, lng)`, ~1km-rounded-coordinate cache, 20 min TTL, fails soft to `null`.
- **`apps/mobile/src/components/home/WeatherWidget.tsx`**: square `RiverStoneSurface` card, same slot/sizing convention as `MedicationQuickLogWidget` (now sits next to it in `HomeScreen.tsx`'s widget row — the row's own comment already anticipated "how much room is left for more widgets"). Renders nothing at all until real data lands; no loading placeholder, no error state — a denied-permission or WeatherKit-down device just doesn't see the widget, same fail-soft principle as every other Apple integration in this app. Tap re-fetches, bypassing cache.
- Reuses `getApproximateLocation()` (`services/deviceLocation.ts`, built for the location-search bias work above) — no separate permission prompt for weather.

### Deploy
- `firebase deploy --only functions` — clean deploy, both `getAppleMapsToken` (updated) and `getWeather` (created) live in `us-central1`.
- **Live-tested via curl immediately after deploy and hit a real, expected issue:** `401 {"reason":"NOT_ENABLED"}` from WeatherKit. This is a known Apple-side activation lag — after first enabling the WeatherKit capability on an App ID and generating its key, the service can take minutes to a few hours to actually activate, even though the portal shows everything saved. The auth itself succeeded (Apple recognized the JWT/key/app correctly — a signature or config error would've been a different failure, not `NOT_ENABLED`), so no code changes needed; it should just start working once Apple's backend catches up. Not yet re-verified after the propagation window.

### Verification
- `cd functions && npx tsc --noEmit && npm run build` — clean after fixing the `jwt.JwtHeader` cast.
- `cd apps/mobile && npm test` — 222/223 passing (same 1 pre-existing, unrelated failure), including 6 new `weatherParsing.test.ts` cases.
- `npx tsc --noEmit` (apps/mobile) — clean, same 3 pre-existing unrelated errors as every entry above.
- Not yet confirmed rendering real data on-device — pending the WeatherKit activation window above.

### Resolved (2026-08-09)
WeatherKit activated on Apple's end — confirmed via curl, `getWeather` now returns real `currentWeather` data (temperature/conditionCode/humidity/etc, London test coords). `WeatherWidget.tsx`'s temporary placeholder (dimmed "--°" card, added purely so the widget's shape was visible on Home during the activation wait) has been reverted to the originally-intended fail-soft-to-nothing behavior (`if (!weather) return null`), matching `MedicationQuickLogWidget`'s convention.

### Next steps
- Hero-background-matches-weather (explicitly deferred by the user) — `conditionCode` is already available client-side (`CurrentWeather.conditionCode`) whenever that's picked up.

## 2026-08-08 (actually truly final) — Travel selection bug fix, default departure setting, Maps deep-link stopgap

User hit a real bug testing Travel's location search (tapping a suggestion did nothing, field stayed as typed text) and asked for two more things: a way to set a default departure location outside the Travel flow, and a map preview.

- **Bug fixed:** `AddPlanBlockSheet.tsx`'s Travel tab's own nested `<ScrollView>` (separate from `BottomSheet`'s built-in one, needed because this sheet has tab-switched content) was missing `keyboardShouldPersistTaps="handled"` — classic RN gotcha: the first tap on a location suggestion just dismisses the keyboard instead of firing the row's `onPress`, requiring a second tap that the user never got to try. Fixed on both tab ScrollViews.
- **New:** `apps/mobile/src/components/DefaultDepartureSheet.tsx` + a "PLAN BACKWARDS" section in `SettingsScreen.tsx` — set the default departure location explicitly instead of only implicitly (via typing it once in a Travel block). Backed by the already-existing `getDefaultDeparturePoint`/`setDefaultDeparturePoint`.
- **Map preview:** confirmed (live docs, not memory) Apple's Maps Server API has no static-map-image endpoint — a real in-app preview needs `expo-maps` (native module, needs an EAS dev-client rebuild, can't be tested with a simple reload). User's call: skip the rebuild for now, use a Maps-app deep-link stopgap instead, **and make sure `expo-maps` is included whenever the next dev-client rebuild happens for any other reason** — noted prominently in `apps/mobile/CLAUDE.md`'s Plan Backwards section so it isn't lost. Shipped now: `apps/mobile/src/utils/appleMapsLink.ts`'s `buildAppleMapsDirectionsUrl` (Apple's documented `maps.apple.com` URL scheme, 4 tests), wired as an "Open in Maps" button in `AddPlanBlockSheet.tsx`'s Travel tab and a long-press action on travel blocks in `PlanBackwardsDetailScreen.tsx`.

### Verification
- `cd apps/mobile && npm test` — 226/227 passing (same 1 pre-existing, unrelated failure), including 4 new `appleMapsLink.test.ts` cases.
- `npx tsc --noEmit` — clean, same 3 pre-existing unrelated errors as every entry above.
- Not yet re-tested on-device — the selection bug fix in particular should be confirmed by repeating the exact repro (Travel tab, type 3+ chars in From, tap a suggestion).

### Next steps
- **Remember `expo-maps` for the next EAS dev-client build** — this is the one action item most likely to get lost since it's contingent on a future, unrelated rebuild.
- On-device re-test of the Travel selection fix.

## 2026-08-08 (the actual final one) — Travel redesigned as a toggle; fixed a real "0m required" bug

User's on-device testing of the fix above surfaced two more things: 3 duplicate "Travel to Grasso" blocks appeared (each showing "0m" instead of the real duration), and direct product feedback that Travel shouldn't be an "Add" flow at all — "it should be just a thing built in that we choose to enable or not."

### The bug (found by inspection, not guessing)
`addPlanBlockTravel` wrote `durationMinutes`/`bufferMinutes` only inside the `travelConfig` JSON blob, never into the `planBlocks` row's own same-named columns. `calculateBlockRequiredDuration`/`buildBackwardsSchedule` (`backwardPlanCalc.ts`) are intentionally type-agnostic — they read those row columns for every block type, no per-type branching. So every travel block silently contributed `0m` to Time Required, while "Leave By" still looked right only because the detail screen computed that separately, straight from `travelConfig`. This is exactly the kind of bug the pure-function test suite couldn't catch, since the calc functions themselves were already correctly tested — the bug was in what got handed to them.

### The redesign (user chose: toggle lives in the anchor card)
- **`functions`-side unaffected** — this was all client/DB.
- **`apps/mobile/src/db/database.ts`**: `addPlanBlockTravel` replaced by `upsertPlanBlockTravel(planId, title, config)` + `getTravelBlockForPlan(planId)` — finds-or-updates the plan's one travel block instead of always inserting, and writes duration/buffer to both the row columns (fixing the bug above) and `travelConfig` (for `startLocation`/`destination`/`mode`/`source`/`distanceMeters`/`estimatedAt`, which no other block type has).
- **New `apps/mobile/src/components/TravelToggleCard.tsx`**: a `Switch` + inline fields (reusing `LocationSearchField`, the mode chips, Get-live-ETA, Open-in-Maps — same building blocks as before, just relocated), debounced (500ms) auto-save on every field change, no separate Save button. Seeds its local state from the DB row exactly once per block id (a ref guard) specifically so its own debounced saves triggering a parent refresh can never clobber whatever the user is mid-typing.
- **`AddPlanBlockSheet.tsx`**: Travel tab removed entirely — only Routine/Task remain, both still genuinely repeatable.
- **`PlanBackwardsDetailScreen.tsx`**: renders `TravelToggleCard` directly under the anchor card; `handleAddBlock` lost its travel branch (unreachable now that `NewPlanBlockInput` no longer has a `'travel'` variant — TS confirmed this compiles clean with the branch gone). The backwards-ordered block list below is untouched — a travel block, once toggled on, still appears there with its own Leave By, same as before.
- This also directly answers the "why doesn't it re-check the ETA" question from the same message — Get-live-ETA is now available any time on the toggle card itself, not just at first creation, so refreshing an estimate later never requires re-adding.

### Verification
- `npx tsc --noEmit` (apps/mobile) — clean, same 3 pre-existing unrelated errors as every entry above; confirmed zero leftover references to the removed `addPlanBlockTravel` anywhere in `src/`.
- `npm test` — 226/227 passing (same 1 pre-existing, unrelated failure) — no new pure-function surface here to add tests for (the fix was DB-integration-level, and this repo has no DB test harness, consistent with every other DB-layer change in this Plan Backwards work).
- Not yet re-tested on-device — worth confirming: toggling Travel on/off in the anchor card creates/removes exactly one block (no duplicates), editing fields updates the same block, and Time Required now actually includes the travel duration+buffer.

## 2026-08-08 (genuinely the last one today) — Plan Backwards countdown widget on Home

User asked for a Home-screen widget showing live time-remaining for a plan, "so we can see how much time." Landed in the third slot of the widget row Medication/Weather already sit in — that row's own comment ("3 square widgets fit side by side") had been anticipating exactly this since before Plan Backwards existed.

- **New:** `apps/mobile/src/components/home/PlanBackwardsCountdownWidget.tsx` — picks the soonest plan with a future Goal Time across all plans, shows Time Remaining live (60s tick, same granularity as everywhere else in Plan Backwards) and either the plan's title or "`X` short" in red once Unallocated goes negative. Tap navigates into that plan. Renders nothing with no qualifying plan (same fail-soft convention as Medication/Weather).
- **Refactor enabling it:** `dateTimeFromParts` and a new `planBlockRowToCalc` (3 new tests) moved from being private helpers inside `PlanBackwardsDetailScreen.tsx` into exported functions on `backwardPlanCalc.ts`, so the widget and the detail screen share one implementation instead of the widget needing its own copy. `planBlockRowToCalc` takes a duck-typed row shape rather than importing `PlanBlockWithSteps` from `db/database.ts`, preserving `backwardPlanCalc.ts`'s "never touches SQLite" property.

### Verification
- `npx tsc --noEmit` (apps/mobile) — clean, same 3 pre-existing unrelated errors as every entry above.
- `npm test` — 229/230 passing (same 1 pre-existing, unrelated failure), including 3 new tests for the extracted functions.
- Not yet exercised on-device.

## 2026-08-08 — Ronin Rive rig rebuilt; ALL prior Ronin/Rive docs deleted

**`RONIN RIG 1` is now the only Ronin/Rive project, and `apps/mobile/RONIN_RIVE.md` is its single source of truth.** Read that file and nothing else for rig state.

Deleted deliberately, and **not to be revived or reconstructed**: `RIVE_AUTOMATION_PLAYBOOK.md`, `RONIN_RIVE_HANDOFF.md`, `apps/mobile/RONIN_{ART_V5_NOTES,HERO_BUILD_PLAN,RIG_PARTS_BRIEF,STATE_MACHINE_DESIGN,V3_GENERATION_SPEC}.md`, five `docs/**/*ronin*` design/plan specs, `ronin-cat-walk-rig-notes.md`, and eight `apps/mobile/assets/ronin/for-rive/*.json` geometry/manifest/recovery dumps (including `storybook-journey-rig.manifest.json` and `ronin-v3-skeleton.json`). They described art, bone ids and migration plans that no longer exist; keeping them caused repeated re-derivation of dead plans. `AGENTS.md`, `apps/mobile/CLAUDE.md` and the project memory were rewritten to point only at `RONIN_RIVE.md`.

**Rig state:** 2340×1080 artboard matched to the donor cat. 19 bones, 2-bone IK on both shins to targets outside the chain, `ronin-travel` → `ronin-scale` (feet-pivoted) → `ronin-anchor` transform chain. `Ronin` ViewModel drives absolute-coordinate travel through an interpolating converter (`characterX`/`characterY`/`depthScale`/`walktime`/`facing`/`gait`/`station`). Nine clips: `idle`, `walk`, `run`, `sit`, `lift`, `coffee`, `kick`, `face-center/left/right`. A click-to-walk room with couch/coffee/weights/ball stations plus free floor clicks via `alignTarget` on a `toSource`-bound probe, with depth scaling by station.

**Known gaps** (all listed in `RONIN_RIVE.md` §9): free floor clicks don't set `facing` (needs a comparator converter, GUI-only); `walktime` is fixed regardless of distance; `breathe`/`idle-variation`/`wave` states reference deleted clips; leg art is skinned to thigh+shin only so foot bones drive nothing; nothing has been watched at speed by an agent.

**Unchanged:** the shipping app still loads `assets/rka_journey_rig.riv`. `RONIN RIG 1` has not been exported over it, so `RoninJourneyRiveWalker.tsx` and `src/domain/ronin/journeyAnimation.ts` remain as they were.

## 2026-08-07 — RepCount CSV import + Workout Trends screen, and a docs-drift fix (desktop web app)

### Changes
- **RepCount CSV import** (`scripts/repcount-import/`, `scripts/import-repcount.mjs`): a Mac-side, dependency-free Node CLI that parses a RepCount workout-history CSV export and writes `workout-session` items + `workout-set-logged` activityLogs to Firestore under the signed-in user's own uid via the app's own Firebase client SDK (real account sign-in, not Admin SDK) — the existing on-device Firestore sync (`firestoreSync.ts`) then pulls it into SQLite automatically, no app code changes needed. Dry-run by default; `--commit` to write; re-runs are idempotent (dedupes by `metadata.sourceStartAt` tagged on each imported session). User ran it successfully against a real ~3,500-row export (197 sessions, 2,408 sets, 47 exercises, Jan 2022–Oct 2025).
- **Workout Trends screen** (native iOS only — see docs-drift note below): new `WorkoutTrendsScreen.tsx`, reachable via a "Trends →" link on `WorkoutsScreen.tsx`, registered in `MenuStack.tsx`. Four visualizations: `WorkoutFrequencyHeatmap.tsx` (16-week GitHub-contributions-style grid), `ExerciseProgressionChart.tsx` (searchable exercise picker + top-set-weight-per-session line chart), `VolumeBarChart.tsx` (week/month toggle, `reps*weight` sum per period), `MuscleBalanceList.tsx` (reuses `RiverStoneProgress`, not a new widget, per the design system's reuse-over-invention rule). Backed by three new SQL queries in `database.ts` (`getWorkoutSessionDates`/`getExerciseSetLogHistory`/`getWorkoutSetLogsInRange`) and pure aggregation functions in new `utils/workoutTrends.ts` (6 passing unit tests). Full design spec: `docs/superpowers/specs/2026-08-07-repcount-import-and-workout-trends-design.md`; implementation plan: `docs/superpowers/plans/2026-08-07-repcount-import-and-workout-trends.md`.
- **Docs-drift fix — the desktop web app was undocumented in the "current state" docs.** While scoping whether Trends should also appear on web, discovered that `apps/mobile/src/webApp/` (a real, separate, actively-developed Expo-web desktop target, built 2026-07-30–08-01, sharing the same SQLite data layer as iOS) was never mentioned in `CLAUDE.md`/`AGENTS.md`/`README.md`/this file's status banner — those all still only described the *different*, already-retired Vite/Dexie PWA, which one of the specs (`docs/superpowers/specs/2026-08-01-web-exercise-library-and-template-builder-design.md`) had already flagged as stale but the fix never landed. Updated `CLAUDE.md`, `AGENTS.md`, `README.md`, `apps/mobile/CLAUDE.md` (new "Desktop Web App" section with current screen-parity list), and this file's status banner to describe both apps accurately and distinguish them by name everywhere the retired PWA is mentioned. Also added an "ARCHIVED" banner to `docs/AGENT_HANDOVER.md`, which was a full stale doc describing the old Dexie/Supabase architecture as current.
- Workout Trends was deliberately **not** ported to the desktop web app in this pass — user chose to defer that; `apps/mobile/CLAUDE.md`'s screen-parity list now tracks it as a known gap.

### Verification
- `node --test scripts/repcount-import/parse.test.mjs` — 4/4 passing (quote-aware CSV parsing, session grouping, per-exercise set numbering).
- `cd apps/mobile && npm test` — 180/180 passing, including 6 new `workoutTrends.test.ts` cases.
- `npx tsc --noEmit` — no new errors from any touched file (pre-existing unrelated errors elsewhere, including expected false-alarm `.web.tsx` resolution errors, left untouched).
- Real dry-run + `--commit` run against the user's actual CSV export, confirmed idempotent on re-run (0 net-new sessions second time).
- Not yet verified in a running dev client/browser this session — next agent or the user should confirm the Trends screen renders real imported data on-device, and check empty states for exercises/periods with no logs.

### Next steps
- On-device check of Workout Trends against the newly-imported RepCount history (see above).
- If desktop web parity is ever prioritized, build the equivalent screen in `apps/mobile/src/webApp/` reusing `utils/workoutTrends.ts` and the same SQL queries (no data-layer work needed, only new `.web.tsx` screen + wiring).
- Register the desktop web app in `../rka-launcher/` (currently only "RKA OS Mobile" is registered) — separate session against that repo.

---

## 2026-08-07 — Medication focus timeline (onset/peak/fade curve, as ranges)

### Changes
- Inspired by another app's stimulant timeline screenshots the user shared. Per-medication opt-in — `MedicationMeta` gained `focusCurveEnabled?` plus six range fields: `onsetMinHours?`/`onsetMaxHours?`/`peakMinHours?`/`peakMaxHours?`/`fadeEndMinHours?`/`fadeEndMaxHours?` (`apps/mobile/src/db/database.ts`) — shipped first as single hour values, then revised same-session to ranges per the user's follow-up ("could be 1h30–2h30 to kick in, peak 3.5–5h, runs out 6–12h") since real onset/peak/wear-off varies dose to dose.
- `MedicationsScreen.tsx`'s `MedFormSheet` gained a "Track focus timeline" toggle plus three min–max range rows (Onset / Peak / Wears off), validated so Save is blocked unless all six are set, each min <= max, and the three ranges' midpoints are ordered onset <= peak <= fadeEnd.
- New `apps/mobile/src/utils/focusCurve.ts`: pure `computeFocusState(item, meta, lastLog)` derives a `building` / `peak` / `fading` phase from wall-clock time elapsed since the last dose, using range midpoints for the phase transition; returns `null` once elapsed passes the *latest* fade-end estimate (`fadeEndMaxHours`) or the feature isn't enabled/fully configured.
- New `apps/mobile/src/components/FocusTimelineCard.tsx`: renders one card per medication with an active state — an SVG onset/peak/fade hill with shaded uncertainty bands over the peak and fade-off windows, a live "now" dot, and a plain-language range summary (e.g. "Building — peak between 8:30pm and 9:30pm"). Self-ticks every 60s since the phase depends only on the clock. Mounted at the top of `MedicationsScreen.tsx`, above "Needs Attention".
- Documented in `apps/mobile/CLAUDE.md`.
- Scoped via a brainstorming pass with the user; no separate spec doc was written since the user asked to skip straight to implementation once the two questions (per-medication opt-in vs. global, three-number onset/peak/fade-end model) were confirmed. The range revision came as a same-session follow-up, implemented directly without re-opening brainstorming.

### Verification
- `npx tsc --noEmit` shows no new errors from the touched files (pre-existing unrelated errors elsewhere in the repo untouched).
- Not verified in a running dev client this session (RN/Expo app, no browser preview available) — user will test on-device: enable the toggle on a medication with a range per stage, log a dose, confirm the card appears with the right phase/labels and bands, and disappears after `fadeEndMaxHours`.

---

## 2026-08-07 — Medication "too soon" override with required reason

### Changes
- The `minHoursBetweenDoses` gate (`computeMedicationEligibility.canTake`) is now a caution the user can consciously override, not a hard block. New shared helper `apps/mobile/src/utils/medicationOverride.ts` (`promptTooSoonOverride`, `computeMinutesUntilNextDose`) shows the real wait time with a "Wait" / "Override…" choice; Override forces a typed reason via `Alert.prompt` (e.g. "advised by doctor", "exam tomorrow") — declining or leaving it blank re-prompts, there is no silent-allow path.
- Wired into both take paths: `MedicationsScreen.tsx`'s `TodayRow.handleTake` and `MedicationQuickLogWidget.tsx`'s `promptTake` (Home quick-log).
- `logMedicationTaken(itemId, takenAt?, startTimer?, amount?, overrideReason?)` (`apps/mobile/src/db/database.ts`) gained a 5th param, stored as `details.overrideReason` on the `medication-taken` activity log row; `useMedications().takeMedication` (`apps/mobile/src/hooks/useDb.ts`) passes it through.
- `LogDoseSheet.tsx`'s `LogEntry` now renders a small orange "Taken early — `<reason>`" caption under any dose log that has one, so the override stays visible in history, not just at confirmation time.
- Documented in `apps/mobile/CLAUDE.md`.

### Verification
- `npx tsc --noEmit` shows no new errors from the touched files (pre-existing unrelated errors elsewhere in the repo untouched).
- Not verified in a running dev client this session (RN/Expo app, no browser preview available) — exercise on-device: trigger "Too soon" on a medication with `minHoursBetweenDoses` set, confirm Override requires non-empty text, confirm the reason shows up in the dose log history.

---

## 2026-08-06 — Approved negative-space logo reference crops

### Changes
- Cropped the four accepted logo directions (A3, F2, F3 and F4) out of the broad exploration board into `apps/mobile/assets/branding/logo-reference-crops/`.
- Documented F3 as the structural base and the critical invariant that `RKA` is dark negative space formed between exactly eight light blocks, not separate foreground lettering.

### Verification
- Visually checked each crop contains one approved icon direction without neighbouring rejected concepts.
- Reference-only change; no runtime logo or app icon changed.

### Next step
- Use the four crops together for a tightly constrained refinement generation, then test shortlisted geometry in monochrome and at 29pt before selecting production artwork.

---

## 2026-08-06 — Header icon pack v2 wired into AppHeader

### Changes
- Added `apps/mobile/assets/icons/header-v2/` with six transparent 512×512 runtime assets: Inbox empty/active/full, Settings, theme light and theme dark. Locked the selected visual directions: Inbox F simplified scroll tray, Settings H universal River Stone gear and Theme A sun/crescent medallion. Adjacent README documents count-state mapping, intended 34–36pt rendering and the non-runtime `source/` sheet.
- Wired the v2 assets into `AppHeader.tsx`: `SettingsMedallionIcon.tsx` now points at `settings.png` (was the retired `assets/icons/header/settings-medallion.png`); a new `header/ThemeToggleIcon.tsx` stacks `theme-light.png`/`theme-dark.png` and crossfades between them on toggle via Reanimated opacity, collapsing to an immediate swap under Reduce Motion (`useReducedMotion`) — replaces the old heroicons `Moon`/`Sun` glyphs; `inboxIllustration()` swapped from `assets/illustrations/inbox/` to the `header-v2` set at the same 0 / 1–10 / >10 thresholds.
- All three header buttons are now 44×44pt touch targets (was 36–40pt) with ~34pt artwork, `resizeMode="contain"`, no tinting; badge logic, haptics and accessibility labels preserved (theme button's label now states the target mode, e.g. "Switch to dark mode").
- `InboxScrollCard.tsx` on Home's Today view intentionally still uses the older `assets/illustrations/inbox/` set — out of scope for this pass.

### Verification
- `npx tsc --noEmit` shows no new errors from the touched files (pre-existing unrelated errors elsewhere in the repo untouched).
- Not verified in a running dev client this session (RN/Expo app, no browser preview available) — test both themes, all three Inbox states and Dynamic Type on-device before merging.

---

## 2026-08-05 — Routines and quantified-habits product brief

### Changes
- Consolidated the previously recorded Routinery and habit-tracker research into `docs/design/routines-and-habits-product-brief.md`.
- Captured the intended feature set, light architectural direction, delivery order and design guardrails without turning it into a detailed implementation plan.
- Apple Health remains documented as a future measurement source but is explicitly excluded from the initial implementation.

### Working state
- Documentation only; no runtime code, schema, dependencies or configuration changed.

### Next step
- Claude can inspect the current app, create its own implementation plan from the brief and begin with manual quantified habits/core routines. This Codex chat can remain focused on design exploration.

---

## 2026-08-05 — App-wide UI refinement v1 implementation

### Changes
- Implemented the approved `app-wide-ui-refinement-v1` concept family (see the two entries below) across Tasks/Logbook, Inbox, Collections/More, and Edit Item. Calendar/Timeline was reviewed and found already substantially compliant (brass `CALENDAR_GOLD` selected segment, preserved blue "now" line, restrained paper-texture grid) — no structural changes needed there.
- New theme tokens in `src/theme/colors.ts`: `ivory`/`greige` (primary/secondary text on River Stone surfaces) and `antiqueBrass`/`vermilion` (+ `Soft` variants), both modes. `itemComposer.ts`'s existing brass `accent` (`#D4B078`/`#8B6936`) and Calendar's `CALENDAR_GOLD` (`#D4B078`) were already the same brass family — left as-is rather than forced onto the new token to avoid an unnecessary rename across a large already-compliant file.
- Removed the one teal active-state in the app: `App.tsx`'s `TAB_ITEMS` Menu-tab dock color changed from `#4E9E86` (jade/teal) to vermilion `#C1503A`. Since Tasks/Logbook and Collections are both reached through the Menu stack, this single change gives both their vermilion active-dock treatment for free.
- `TasksScreen.tsx`: task/completed rows now render through `RiverStoneSurface` (`variant="list"`) instead of a flat colored `View` — denser padding (row `paddingVertical` 6→4, cell gap 8→6), ivory/greige text. Segmented control (Tasks/Logbook) restyled as an inset stone chip with a brass border on the selected tab. `LensSurface` title set to `titleStyle="editorial"` (new prop, Newsreader). Empty states (no tasks / logbook empty) got a small monochrome `CheckCircle2` symbol with a brass tint, Inter copy (no serif).
- `InboxScreenV2.tsx` + `TaskSwipeItem.tsx`: title switched from Georgia italic to Newsreader (matches Tasks). Count badge changed from a filled deeperBlue pill to a vermilion-outlined one. Row surface swapped to `RiverStoneSurface` (`variant="list"`, `shape="regular"`) in place of the old fillStrong/separatorStrong-or-flat-surface split; container corner radius 999→18 to match (swipe-reveal clipping still works, just a rounded rect instead of a full pill now); row padding/gap trimmed (~25%) for the same denser read as Tasks. Empty state got a small brass `Check` glyph.
- `ItemEditorSheet.tsx`: footer Save button changed from a solid brass fill to a brass-outlined button (was reading as "a large flat mustard block" per the design brief). Section `card` surfaces and every chip/segment/duration/bucket/priority control dropped their default hairline border — border now only appears on the *selected* state, which is what was creating the "boxes inside boxes" look. No fields, scheduling logic, validation, or keyboard behavior changed.
- `MenuScreen.tsx` (Collections): tile aspect ratio 1 → 1.14 and grid `rowGap`/content `gap` trimmed slightly for a shorter, denser tile per the brief. All 12 destinations and their existing artwork are unchanged.
- No changes to database, navigation architecture, dock icon artwork, FAB, or any interaction/gesture logic anywhere in this pass.

### Verification
- `npx tsc --noEmit` clean for every file touched (remaining errors are all pre-existing, in the already-retired `src/webApp/*` PWA remnants, unrelated to this change).
- Not yet verified on-device/in-Expo-Go — do that before calling this fully done, especially dark/light contrast on the new ivory/greige/vermilion/brass tokens and Dynamic Type/truncation on the denser rows.

### Next step
- On-device visual pass (both color schemes) to confirm contrast and touch targets, then update `apps/mobile/DESIGN_CHECKLIST.md` screen-status checkboxes for the touched screens (done in this same commit — see below) and graduate any settled tokens into `docs/design-system/reference/` per that file's promotion rule once genuinely reviewed on a real device.

---

## 2026-08-05 — Habit-tracker research catalogue

### Review
- Catalogued two additional screenshot batches from a configurable habit tracker. Feature references include build/quit habit polarity, daily/weekly/monthly/custom goal periods, quantitative units and Health links, time ranges, multiple reminders, completion memos, configurable row gestures, progress charts, date-bounded habits, weekly grid reports, monthly rate/calendar analytics, numeric/duration goal entry, undo/reset, filters and empty states.
- Recommended product takeaway: add a small set of explicit habit measurement modes (`binary`, `count`, `duration`, `health-derived`) and period-based targets, rather than exposing the source app's full settings density. RKA already has streaks, target days, time buckets, reminders/notifications and a HealthKit dependency, but its documented habit metadata does not yet model these generalized targets.
- Strongest transferable interaction patterns: direct progress bars with current/target values, context-sensitive completion actions (done/add value/enter value), reversible completion, compact status/time filters, and restrained weekly/monthly review. Avoid copying the source app's dense form hierarchy, excessive toggles, colourful report grid, or instructional popups.

### Working state
- Research/catalogue only; no runtime code, schema, packages, assets or configuration changed.

### Next step
- Continue collecting references. Before implementation, consolidate all research into a prioritized product brief separating Routine execution, Habit measurement, analytics, reminders and Apple Health integration.

---

## 2026-08-05 — Canonical exercise movement families

### Changes
- Added a tested 32-family exercise taxonomy in `apps/mobile/src/utils/exerciseLibrary.ts`. All 183 starter exercises resolve with no fallback; equipment, angle and grip variants remain separate exercises but share a stable parent movement such as `chest-press`.
- Updated `scripts/generateExerciseAssets.cjs` and regenerated `starterExercises.ts` so every starter persists `movementFamily`. Existing/custom database rows remain compatible through title-based inference; no destructive migration or exercise rename was required.
- `ExerciseMuscleGroupScreen.tsx` now presents family sections with variation counts, `ExercisePickerSheet.tsx` uses the same family hierarchy, and exercise search matches both exact variation titles and parent-family names.
- New and edited exercises persist the inferred/stored family through the existing metadata JSON. Updated `SCHEMA.md`, `apps/mobile/CLAUDE.md`, `AGENTS.md`, and `DESIGN_CHECKLIST.md` with the new contract.

### Verification
- TDD red/green cycle recorded in `exerciseLibrary.test.ts` and `starterExercises.test.ts`: stored-family parsing, bench-press coalescing, full 183-item classification, exact 32-family count, legacy inference, family grouping and family-aware search.
- `npm test`: 160/160 passing.
- `npm run typecheck`: no new mobile errors; command remains non-zero only for the known retired-web files importing already-removed web modules.

### Next step
- On-device review of section density in the muscle-group browser and the 32-section exercise picker. Before importing RepCount history, create an explicit mapping from its 48 legacy names to these families and exact RKA variations.

---

## 2026-08-05 — Exercise catalogue family audit

### Review
- Confirmed the generated starter catalogue contains 183 unique exercise records/assets. Current muscle-group distribution is highly upper-body weighted: arms 69, chest 62, back 33, full-body 6, shoulders 5, legs 4, core 4.
- The schema currently treats every named variation as an independent exercise and stores no canonical movement-family relation, so an exact “unique movements vs variations” count does not exist yet.
- Example counts from a practical name-based grouping: 8 explicitly named Bench Press variations, 15 broader chest-press variations, 39 push-up variations, 34 curl variations, 29 triceps isolation variations, 15 row variations, 14 pull-up/chin-up/pulldown variations, 7 dip variations and 5 fly variations. These groups can overlap and are evidence of a variation-heavy catalogue, not an additive total.

### Working state
- Audit only; no generated catalogue, exercise assets, schema or runtime code changed.

### Next step
- Introduce a canonical movement-family taxonomy separately from exercise/equipment variants, then map both the 183 starter exercises and the 48 RepCount legacy names to it. This would support family-level history while preserving exact-machine and gym-specific variants.

---

## 2026-08-05 — RepCount workout export assessment

### Review
- Inspected `repcount_export_5 Aug 2026.csv` supplied outside the repo: 3,527 set rows grouped reliably into 199 sessions from 2022-01-03 through 2025-10-17, covering 48 legacy exercise names and 24 workout names. 197 sessions contain at least one logged set; 2,389 rows contain both weight and reps; 1,119 rows contain no performance metric and appear to be unlogged/planned set slots.
- Historical import is feasible because RKA already has `workout-session` items and `workout-set-logged` activity rows with session ID, set number, reps, weight and unit. A safe importer must preserve historical timestamps directly, retain repeated identical sets, skip/flag blank planned rows, map legacy exercise aliases deliberately, and be idempotent.
- Important feature signals: per-set notes, persistent machine/setup notes, exercise aliases and gym/location variants, workout-history/backdating, import/export, session start/end duration, template evolution, progression/volume/PR views, and explicit warm-up/failure markers. None were implemented.

### Working state
- Analysis only; no CSV data was imported and no database, runtime code or schema changed.

### Next step
- Before importing, produce a dry-run mapping report for all 48 legacy exercise names, confirm weights are kilograms and resolve ambiguous total-vs-per-side reps. Then implement a backup-first, idempotent importer with an import ledger/fingerprint and post-import reconciliation totals.

---

## 2026-08-05 — Quantified-habit research capture review

### Review
- Reviewed the second supplied research batch as feature/UI reference only: build-vs-quit habit types, daily/weekly/monthly/custom goal periods, quantified goals and units, Apple Health-linked progress, reminder windows, completion memos, configurable row actions, swipe completion and progress-bar list presentation.
- Strongest fits for RKA are quantified habit values, period-based targets, Health-sourced automatic progress and action-specific row controls. These extend the existing `activityLogs`/streak/Potential model without requiring a separate product area.
- Current code supports binary habit occurrence logs, recurrence, streaks, Potential target days, notifications and hold-to-confirm. It does not yet model numeric habit samples/period aggregation. `app.json` contains Health usage descriptions, but `apps/mobile/package.json` currently has no active HealthKit library, so Health sync is configured only at the permission-copy level, not implemented.

### Working state
- Research review only; no runtime code, schema, dependencies, configuration or UI changed.

### Next step
- Keep these references for later feature prioritisation. If selected, define a small goal model (`build`/`quit`, aggregation period, target value/unit, manual vs Health source) before designing screens or changing habit completion behaviour.

---

## 2026-08-05 — Routinery feature/architecture assessment

### Review
- Identified the supplied research captures as Routinery: guided routine onboarding, ordered timed steps, per-step settings/quick add, a sequential routine player, and Lock Screen/Dynamic Island presentation.
- Audited the active RKA architecture against the concept. Existing reusable foundations include task `durationMinutes`, checklists, tags/context/time buckets, recurrence, manual ordering, timeline scheduling, `activityLogs`, notifications, the medication timer controller, and `expo-widgets` Live Activities.
- Recommended a first-class Routine domain rather than reusing Missions or plain task checklists. Missions carry Harada/Potential semantics, while checklists lack independent step timing, reuse, session state and analytics. A production implementation would need Routine/step persistence plus a durable routine-session state machine; the existing timer and Live Activity code can then be generalized.

### Working state
- Architecture review only; no runtime code, schema, packages or configuration changed.

### Next step
- If pursued, scope an MVP around routine templates, ordered timed steps, foreground player, pause/skip/complete and session logging; add notifications/Live Activity second, then suggestions/onboarding/voice/Watch features later.

---

## 2026-08-05 — App-wide UI refinement concept family

### Changes
- Extended the approved Tasks/Logbook direction into five additional high-fidelity concepts under `docs/design-system/concepts/app-wide-ui-refinement-v1/`: `inbox-refinement-v1.png`, `calendar-timeline-refinement-v1.png`, `edit-item-refinement-v1.png`, `collections-refinement-v1.png`, and `logbook-empty-state-v1.png`.
- The set now tests the shared language across dense list rows, calendar/time hierarchy, utility forms, artwork-led destination tiles, section headings, and a deliberately quiet empty state.
- The family consistently uses compact charcoal River Stone surfaces, warm ivory type, muted greige secondary information, restrained brass state emphasis, and vermilion navigation emphasis. Production UI remains unchanged.

### Verification
- Confirmed all five new PNGs are valid portrait assets at approximately 853×1844 and saved alongside the original Tasks concept.
- Visual review note: the Calendar concept generator selected the Tasks dock position instead of Calendar, and the empty-state concept used an editorial serif for its main message despite the intended sans treatment. Treat both as presentation-generator drift, not implementation guidance.

### Next step
- Choose whether this family is the app-wide target. If approved, codify typography, row density, River Stone variants, section labels, selected-state accents, and empty-state rules before screen-by-screen implementation.

---

## 2026-08-05 — Tasks/Logbook visual-refinement mockup

### Changes
- Added `docs/design-system/concepts/app-wide-ui-refinement-v1/tasks-logbook-refinement-v1.png`, a high-fidelity Tasks screen concept based on the current app capture.
- The concept establishes a candidate shared grammar for the wider refresh: denser River Stone rows, warm ivory hierarchy, Newsreader-style editorial screen title, tracked section labels, lacquer check controls, restrained brass state emphasis, and vermilion active dock treatment.
- Production UI and navigation remain unchanged; this is approval-stage concept artwork only.

### Verification
- Confirmed the saved PNG is valid at 853×1844 and visually retains the original Tasks/Logbook information architecture and five-position dock.

### Next step
- Collect direction on density, serif usage, and brass/vermilion balance; if approved, translate the direction into shared tokens/components before applying it across Inbox, Calendar, and forms.

---

## 2026-08-05 — App-wide screenshot visual audit

### Review
- Audited the 13 current iPhone captures under `Screenshots (from App)/` as a single product system: Profile, Inbox, Tasks/Logbook, Calendar/Timeline, More, Settings, Quick Add, medication logging, and the full edit-item sheet.
- The clearest app-wide gap is coexistence of the newer River Stone / warm ivory / restrained brass shell with older oversized blue-purple list cards and generic productivity-screen styling.
- Highest-leverage follow-up: define one shared visual grammar for typography hierarchy, surface depth, list density, section labels, and accent roles before polishing individual screens. Tasks/Logbook is the best representative first mockup because its patterns will transfer directly to Inbox, collections, and form rows.

### Working state
- Review only; no runtime assets, styles, components, dependencies, or app configuration changed.

### Next step
- Create a focused Tasks/Logbook refinement mockup, then use the approved direction to propagate shared tokens/components across the remaining screenshots.

---

## 2026-08-05 — App-wide fontFamily/fontWeight fix

### Changes
- Found and fixed a real, app-wide rendering bug: ~105 style blocks across ~40 files set `fontWeight` (`'500'`/`'600'`/`'700'`/`'800'`) with no matching `fontFamily`. Per the note already in `App.tsx` (RN doesn't synthesize bold for custom fonts), every one of these was silently rendering as `Inter_400Regular` regardless of the requested weight — the actual root cause of "every label shouting at the same volume" that started the Home typography pass. Ran a mechanical sweep adding the matching `Inter_{weight}` family to every affected block.
- The first pass of this sweep (a Python script) had a bug of its own on single-line style objects (e.g. `text: { fontSize: 12, fontWeight: '500' }` all on one line) — it inserted the new `fontFamily` line in the wrong place, corrupting ~50 files' `StyleSheet.create()` calls. Caught immediately via `tsc --noEmit`, repaired with a second script, one file needed a manual fix (`WorkoutSessionScreen.tsx`'s `cardTarget` had gotten double-inserted). Confirmed no corruption pattern remains anywhere in `src/` via grep, and `tsc --noEmit` + the domainScoring/potential unit tests (24/24) are clean.

### Next step
- The mechanical bug fix is done app-wide. The qualitative parts of the typography brief from the Home pass — capping title weights at 600 instead of 700/800, dimming inactive nav/segment text, warm off-white beyond Home, deciding if any other screen's heading deserves Newsreader — are per-screen judgment calls, not yet applied beyond `HomeScreen`/`TodayCard`/`RoninJourneyPrototype`/`AppHeader`. Continue screen-by-screen on request.

---

## 2026-08-05 — Home River Stone + typography refinement pass

### Changes
- Started migrating Home's remaining flat surfaces to the existing `RiverStoneSurface`/`RiverStonePressable` material (already used app-wide — tab bar, Settings, Profile, several Home widgets — but not `HomeScreen.tsx` itself). Converted the Today/Upcoming/Anytime/Someday tab row (`HomeScreen.tsx`) and the Today/Upcoming toggle (`TodayCard.tsx`) to the `chip` variant, which is designed as an inset/pressed treatment — only the active tab gets the stone material, matching how the tab bar itself distinguishes the active icon. Note: `RiverStoneSurface`'s `face` layer is `flex: 1` and needs an ancestor with an explicit height to resolve against (every prior usage passes a fixed `style={{ width, height }}`) — omitting it caused the chip to collapse to nothing in a horizontal scroll row and to stretch to fill the whole remaining screen height in a vertical list. Fixed by giving both an explicit `height: 30`.
- Removed `TodayCard`'s old `palette.fill` track background + `padding: 3` inset now that the active segment carries its own material contrast — it read as a mismatched second boxed layer once the chip was added.
- Fixed a real bug in `RoninJourneyPrototype.tsx`: the `TODAY'S PATH` eyebrow was written as literal JSX text `TODAY’S PATH` (not inside a JS string), so React Native rendered the raw backslash-u-escape characters instead of an apostrophe. Wrapped in `{'...'}`.
- Typography pass, motivated by "every label shouting at the same volume": added `@expo-google-fonts/newsreader` (`Newsreader_600SemiBold`, loaded in `App.tsx`'s `useFonts`) reserved *only* for the Journey card's title (`RoninJourneyPrototype.tsx`'s `progressLabel`) and the `RKA` wordmark (`AppHeader.tsx`) — everything else stays Inter. Inactive tab labels (both Home rows) dropped to `Inter_500Medium`/12px/`textTertiary` so only the active tab reads bold; several components (`TodayCard` row/empty-state text, `HabitHoldButton` pill title/streak) had `fontWeight: '600'`/`'700'` with no matching `fontFamily`, which — per the existing note in `App.tsx` about RN not synthesizing bold for custom fonts — silently rendered as Regular; added the matching `Inter_600SemiBold` family so the weight actually applies. `TodayCard`'s empty-state heading was deliberately kept Inter (not Newsreader) rather than serif, per the call that Newsreader should stay exclusive to the Journey card's one line of emotional copy. `RoninJourneyPrototype` text swapped from pure `#ffffff` to a warm off-white (`#f5efe4`, matching the app's existing dark-mode `text` token) plus an added top-down `LinearGradient` scrim behind the heading row for legibility.

### Verification
- `npx tsc --noEmit`: clean except the pre-existing retired-web errors.
- Newsreader is a JS-only font asset (no native module) — no EAS/dev-client rebuild needed, just a Metro restart.
- Not yet verified: on-device visual check of the gradient scrim and Newsreader rendering (can't drive the physical dev-client remotely).

### Next step
- Continue the River Stone migration to Home's remaining flat surfaces (Log Medication card, stat pills) and audit other screens for the same gap, per `src/components/riverstone/MIGRATION_GUIDE.md`.

---

## 2026-08-04 — Harada Setup walkthrough (onboarding)

### Changes
- New `apps/mobile/src/screens/OnboardingScreen.tsx`: first-launch, skippable guided setup for the full Journey/Domains/Missions/Potential model (see below). 4-step flow — intro (real `hero-dawn.png` art) → Domain chip picker (suggested + custom, tap to select) → per-Domain loop (optional Mission + optional Potential Stat, each independently skippable) → Focus selection with a live `KatanaProgress` preview of `computeOverallPotential()`. Pure UI over existing `database.ts` functions (`createItem`, `setRelation`, `createPotentialStat`, `setFocus`) — no schema changes.
- `App.tsx`: registers an `Onboarding` root-stack screen and gates `RootStack.Navigator`'s `initialRouteName` on `getItemsByType('area').length === 0`, computed once at boot (native only — web has no SQLite).
- `SettingsScreen.tsx`: new "Redo Setup" row (SETUP section) re-enters the same flow at any time; existing Domains/Missions/Stats are untouched, it only adds more.
- `src/icons.tsx`: added `Briefcase`/`Users`/`Banknotes`/`PuzzlePiece`/`ChartBar`/`Star`/`Trophy` heroicon re-exports for the new screen's chip/card glyphs.
- Design doc: `docs/superpowers/specs/2026-08-04-harada-onboarding-design.md`. Flagged follow-up (not done): a bespoke Domain-glyph icon set (torii/cherry-blossom/coin-stack/crane) in the same rendered-3D style as `icons/collections/*.png`, to replace the heroicon-outline stand-ins.

### Verification
- `npx tsc --noEmit`: clean except the pre-existing retired-web `App.web.tsx`/`src/webApp/*` errors.
- `domainScoring.test.ts` + `potential.test.ts`: 24/24 pass (no logic changed, sanity check only).

### Next step
- On-device smoke test: fresh-install trigger, chip selection, per-domain skip vs. fill, Focus selection, Settings → Redo Setup re-entry.

---

## 2026-08-04 — Journey/Domains/Missions/Potential scoring model

### Changes
- New DB table `domainContributions` (`apps/mobile/src/db/database.ts`): one row per completion-event's live, decaying effect on a Domain score, separate from permanent `items` history so scoring can be re-tuned without touching Mission/Achievement records. Soft-disable only, via `excludedAt` (never deleted).
- New `ItemType`s: `potential-stat`, `achievement`, `focus` (`apps/mobile/src/db/types.ts`). Potential Stats and Achievements link to a Domain via new relationTypes `potentialStatArea`/`achievementArea` (kept distinct from `project -> area`'s `'area'` relationType so Mission rollups never pick them up).
- New pure scoring module `apps/mobile/src/utils/domainScoring.ts`: exponential half-life decay, product-of-complements diminishing-returns lift combinator (capped at `MAX_ACHIEVEMENT_LIFT = 30`), `domainScore = min(100, maintenance + lift)`, weighted `overallPotential`. Defaults: ordinary Mission contribution `magnitude 0.25 / halfLife 14d`; Achievement contribution `magnitude 0.6 / halfLife 60d`. 15 unit tests.
- `apps/mobile/src/utils/potential.ts` migrated from a fixed 4-stat enum to DB-backed `potential-stat` items (`computePotentialStats` now keyed by stat item id). One-time idempotent migration (`migratePotentialStats` in `database.ts`, runs on every `getDb()` first-open) seeds the 4 legacy stats and rewrites any habit's `metadata.potentialStat` from the old literal string to the new item id.
- Mission completion (`completeMission`) and achievement-eligibility toggling (`setMissionAchievementEligible`) implement the mutually-exclusive Mission-vs-Achievement contribution rule: a Mission's `metadata.achievementEligible` flag decides whether completion produces an ordinary Mission-tier contribution or a permanent `achievement` trophy + Achievement-tier contribution — never both for the same completion event. Upgrading/downgrading after completion preserves the original completion date and never deletes a trophy once created.
- New screens: `AchievementsScreen.tsx` (trophy case + manual/retrospective add), `FocusScreen.tsx` (Current Focus label + per-Domain weight overrides — changing it never resets Domains/Missions/Achievements/history). `PotentialScreen.tsx` rewritten as a Domain-grouped overview (Overall Potential, Focus, per-Domain scores). `AreaDetailScreen.tsx` gained Domain score + Potential Stats management + Achievements list. `ProjectDetailScreen.tsx` gained a "Mark Mission Complete" action and an achievement-eligible toggle. `ProfileScreen.tsx`'s Potential card simplified to Overall Potential + per-Domain scores. `HabitDetailScreen.tsx`'s stat chips now read from the DB instead of the old fixed enum.
- `RoninJourneyPrototype.tsx` gained an optional `potentialPercent` caption; `HomeScreen.tsx` now computes and passes Overall Potential. Journey itself stays presentation-only, per the agreed architecture (permanent framework, not a named data object).
- `apps/mobile/SCHEMA.md` updated with the new table, types, relations and the scoring formula summary — treat it as the canonical reference for this model.

### Verification
- `domainScoring.test.ts` (15/15) and rewritten `potential.test.ts` (9/9) pass via `node --experimental-strip-types --test`.
- Full architecture was worked through conversationally (Journey/Domains/Missions/Potential audit → three-layer model → maintenance+achievement scoring philosophy → baseline+capped-decaying-lift formula → permanent Achievements/Trophies → mutually-exclusive Mission/Achievement contributions) before implementation — see conversation history for the full design rationale if extending this further.

### Next step
- Full `npx tsc --noEmit` + on-device smoke test of the new screens/flows (Complete Mission, achievement toggle upgrade/downgrade, Focus weighting, manual Achievement add) still pending at time of writing.

---

## 2026-08-03 — Storybook Ronin production animation pipeline started

### Changes
- Added `docs/plans/2026-08-03-ronin-storybook-animation-system.md`, covering contract, rig authoring, modular outfits/props, Rive integration and on-device acceptance.
- Added `apps/mobile/src/domain/ronin/journeyAnimation.ts` and exported it from the Ronin domain. It fixes production names and semantic state for activity, mood, outfit, cat state, progress, Reduce Motion, tap and completion.
- Added `apps/mobile/assets/ronin/for-rive/storybook-journey-rig.manifest.json`, mapping every approved reference to Side, Front, Rear, Seated, Sleeping, Training and Cat rig families and defining modular slots, draw order, continuous motion policy and acceptance gates.
- Added `apps/mobile/src/utils/roninJourneyAnimation.test.ts`, validating stable authoring names, defaults, progress normalization, manifest parity and source-art resolution.
- Left the active `apps/mobile/assets/rka_journey_rig.riv` and its runtime renderer unchanged. The replacement target `apps/mobile/assets/rka_journey_storybook.riv` will only become active after authoring and device verification.

### Verification
- Targeted production contract suite: 5/5 passed.
- Full mobile test suite: 129/129 passed.
- `git diff --check`: passed before documentation sync and will be rerun at handoff.
- Full TypeScript check remains blocked only by the pre-existing retired-web imports under `App.web.tsx` and `src/webApp/`; no new Ronin contract errors were reported.

### Next step
- Use the corrected gear-free stretching/training artwork when it arrives, update the two manifest sources, then vectorise the approved Side and Front neutral rigs first. Author the production file against the fixed `Journey` View Model contract rather than extending the experimental `State Machine 1` interface.

---

## 2026-08-03 — Canonical front-facing Ronin and cat reference

### Changes
- Generated and saved `apps/mobile/assets/ronin/model/ronin-cat-front-reference-v1.png`, a 1254×1254 straight-on identity reference with simplified app-like shapes, clean outlines and clear limb separation.
- Generated `apps/mobile/assets/ronin/model/ronin-cat-master-identity-sheet-v2.png`, then rejected it after clarification that the desired visual target was specifically the softer side-on artwork already present in the Fuji scene, not the later clean-anime turnaround style.
- Saved `apps/mobile/assets/ronin/model/ronin-cat-side-style-reference-v3.png` as the canonical source-only identity reference. It is an exact duplicate of the approved transparent `journey/ronin-cat-walkers-v1.png`, preventing regeneration drift while giving future generation work an unambiguous reference path. The v1 and v2 generated sheets remain rejected explorations; the active runtime character is unchanged.
- Preserved the six accepted storybook-style outputs in `apps/mobile/assets/ronin/reference/approved-storybook-v1/` with semantic filenames: side-neutral, rear, three-quarter, cat turnaround, front expressions and side expressions. These are reference-only and do not alter the runtime bundle.
- Preserved the six-image structural batch in `apps/mobile/assets/ronin/reference/approved-structural-v1/`. Front rigging, cross-legged, sleeping, working/journaling and celebration are approved; the rear view is explicitly named `rear-rig-needs-sword-correction.png` because its duplicated sword/scabbard arrangement is not rig-safe.
- Saved the successful rear correction as `approved-structural-v1/rear-rig-corrected-approved.png`: both hands are empty and only one attached sheathed sword remains.
- Saved the second activity batch under `apps/mobile/assets/ronin/reference/approved-activities-v1/`. Tea break, petting, reading and tired/comfort are approved; stretching-with-travel-gear is retained as a distinct travel concept, and training-with-travel-gear is marked for a gear-free correction before it defines the Workout state.

### Verification
- Confirmed the saved asset is a valid 8-bit RGB PNG at 1254×1254.
- Confirmed the v2 master sheet is a valid 8-bit RGB PNG at 1536×1024 and visually contains the required Ronin turnaround, cat turnaround and six-expression set.
- Confirmed the v3 reference is a 1254×1254 RGBA PNG with alpha and has the same SHA-256 hash as the approved journey walker artwork.
- Confirmed all six approved reference files are valid RGB PNGs and recorded their SHA-256 hashes. The rear view remains concept-only due to headband/backpack drift, and the cat turnaround needs a standing front correction before rigging.
- Confirmed all six structural outputs are valid 1254×1254 RGB PNGs and recorded their SHA-256 hashes. Visual review found no blocking identity/style drift in the five approved images.
- Confirmed the corrected rear and all six activity outputs are valid 1254×1254 RGB PNGs and recorded their SHA-256 hashes. The style, character scale and storybook texture remain consistent across the batch.

### Next step
- Generate gear-free waking/stretching and Workout/training variants, then decide whether the accumulated reference coverage is sufficient to begin vector reconstruction before expanding into modular outfit concepts.

---

## 2026-08-03 — Rive journey runtime activated

### Changes
- Exported the upgraded Rive editor file as the valid 250 KB runtime binary `apps/mobile/assets/rka_journey_rig.riv`.
- Connected `State Machine 1` entry directly to the looping `Walk` state and verified changing leg poses in Rive preview.
- Mounted the runtime through `RoninJourneyRiveWalker` inside `RoninJourneyPrototype`; the PNG now serves only as a loading/error fallback while the existing Reanimated path progress and tap reaction remain intact.
- Added `riv` to Metro's asset extensions in `apps/mobile/metro.config.js`.

### Verification
- Confirmed the asset starts with the `RIVE` binary header and contains the expected `Walk`, `Idle`, and `State Machine 1` names.
- Targeted TypeScript check for both Home journey components passes.
- Full mobile test suite: 124/124 passed. Metro configuration check and `git diff --check` passed.
- Initial Expo Cloud build `4d7ecc9a-0c01-46aa-93df-0a156e3022ac` compiled but crashed before JavaScript startup. A paired-device console reproduction identified the exact `dyld` failure: `ExpoLocation.framework` referenced a missing Swift symbol in `ExpoModulesCore.framework`.
- `npx expo install --check` confirmed the project had been partially moved to Expo `57.0.9` while 23 native dependencies still used earlier SDK 57 patches. `npx expo install --fix` aligned the full supported matrix, including `expo-location ~57.0.7`, `expo-dev-client ~57.0.10`, React Native `0.86.2`, Reanimated `4.5.1`, Screens `~4.26.0`, Worklets `0.10.1` and Widgets `~57.0.7`.
- After alignment, `npx expo install --check`, all 124 tests and `git diff --check` pass. Replacement Expo Cloud development build `9c105bf8-be26-4409-b3f3-a1b48150c651` completed successfully and was installed on the paired iPhone.
- A normal device launch remained alive in the iOS process table after 29 seconds, confirming the original instant-close `dyld` crash was resolved. The first JavaScript load then reported Worklets JavaScript `0.10.1` versus Babel plugin `0.10.0`; the Metro process had been running since before dependency alignment. Restarting Metro on port 8082 with `--clear` rebuilt all 2,906 modules and launched the app without the Worklets error.
- First on-device visual review found the Rive artboard's `#282828` fill rendering as a square over the Fuji scene, an under-authored `Walk` state cycling only the rear leg, and system Reduce Motion suppressing the app-level tap hop. Set the artboard fill opacity to 0% in Rive, removed the malformed `Walk` state from `State Machine 1` so Entry now uses `Idle`, and re-exported the runtime asset. The React Native wrapper now explicitly uses a transparent non-interactive Rive surface, while all deliberately restrained bob/progress/reaction timings use `ReduceMotion.Never` so functional feedback remains visible.

### Next step
- Visually recheck the transparent Idle-based journey and tap hop on the paired iPhone after unlocking it. Keep the current clean Metro server running on port 8082; after native dependency changes, restart Metro with `npx expo start --dev-client --port 8082 --clear` before judging the new build.

---

## 2026-08-02 — Ronin + cat Rive rig, motion and native adapter

### Changes
- Renamed Rive editor file `2478489` to `RKA Journey Rig` and preserved the structured `ronin-cat-walk-rive-source` vector import.
- Added Ronin spine, arm, leg and sword skeletons plus cat spine, tail and leg skeletons. Bound and auto-weighted the body art, then verified representative leg and tail deformation before restoring the exact rest pose.
- Bound the separate rear boot, sword, hair/bandana and backpack artwork to their relevant bones.
- Authored looping `Idle` and `Walk` animations. `Idle` gently moves the Ronin torso and cat tail; `Walk` adds alternating Ronin leg motion, torso motion and cat-tail movement.
- Installed `@rive-app/react-native@0.4.19` and `react-native-nitro-modules@0.35.10` and added `apps/mobile/src/components/home/RoninJourneyRiveWalker.tsx`, a local `.riv` state-machine adapter with a safe fallback.
- Rive Agent was visibly placed in Build mode, but the beta repeatedly replied that it could not manipulate the file. The working rig and timelines were therefore completed directly in the editor.

### Verification
- Verified Ronin leg art follows its weighted leg bone and the cat tail follows its tail chain, undoing both test rotations back to rest.
- Previewed both looping timelines in Rive and confirmed the character/companion remain in continuous motion.
- Confirmed the Rive Nitro packages satisfy the current React Native/Expo requirements. A targeted TypeScript check of `RoninJourneyRiveWalker.tsx` passes. The full mobile typecheck remains blocked by the pre-existing retired-web imports under `App.web.tsx` and `src/webApp/`; no Rive adapter errors were reported.
- Full mobile test suite: 124/124 passed. `git diff --check` passed.

### Resolved follow-up
- The export gate was resolved on 2026-08-03: the valid runtime asset is now active at `apps/mobile/assets/rka_journey_rig.riv`, with the PNG retained only as the adapter fallback.

---

## 2026-08-05 — A/F negative-space RKA monogram attempt

### Changes
- Explored integrating `RKA` into the empty channels of the selected A/F Harada crest families rather than overlaying conventional lettering.
- Saved the generated concept board at `docs/design-system/concepts/ronin-harada-negative-space-v1/negative-space-rka-attempt-v1.png`; no production assets changed.

### Verification
- The pass preserved A/F geometry, styling and small-size previews, but failed the primary acceptance criterion: the negative spaces still read as generic channels rather than a genuinely legible `RKA` monogram.
- Marked this direction as requiring deliberate vector counter/stroke construction rather than further unconstrained image-generation averaging.

### Next step
- Construct a small number of deterministic black-and-white vector skeletons where R, K and A counters are explicitly drawn first, then derive the eight contribution objects around those locked spaces.

---

## 2026-08-05 — A/F Harada crest colour and depth finalists

### Changes
- Expanded monochrome hybrid concepts A and F into five refinements per family while restoring the established RKA OS lacquer, washi, vermilion and restrained brass styling.
- Preserved the clean small-size geometry: A uses an eight-contribution 3×3 discipline grid around a central life ensō; F uses eight explicit contribution paths feeding the central ensō.
- Saved the concept-only board at `docs/design-system/concepts/ronin-harada-af-finalists-v1/af-colour-depth-10up-v1.png`; no production icon or app configuration changed.

### Verification
- Confirmed the board contains A1–A5 and F1–F5 with simulated 16 px and 32 px previews.
- A5 reads most like a finished Apple icon, F2 communicates Current Focus most clearly and F5 provides the strongest premium layered-system treatment; A3/F3 lose too much brand warmth.

### Next step
- Choose between A5, F2 and F5, then produce deterministic vector geometry and real Apple default/dark/clear/tinted appearance tests.

---

## 2026-08-05 — Monochrome Harada/Ronin crest simplification

### Changes
- Generated a strict monochrome simplification board after rejecting the detailed symbolic crest direction as unsuitable for Apple icon sizes.
- Generated a second ten-option hybrid board combining the successful monochrome reduction with the earlier Daily Grid and Orbit System semantics: eight contributions, a central life/Overall Potential ensō and one weighted Focus.
- Saved both concept-only boards under `docs/design-system/concepts/ronin-harada-monochrome-v1/`; no production icon or Expo configuration changed.

### Verification
- Both boards include ten labelled concepts plus simulated 16 px and 32 px previews.
- Hybrid concepts A, D, F and I best retain the many-contributions-to-one-core meaning without reading primarily as targets or scientific orbit symbols.

### Next step
- Select hybrid finalists, reduce them to deterministic vector paths and test real iOS/macOS default, dark, clear and tinted appearances.

---

## 2026-08-05 — Unified Ronin principles crest exploration

### Changes
- Generated a ten-option unified Ronin crest board integrating five agreed symbols: an overall crest for chosen principles, central ensō for life/wholeness, sunrise for purpose, bamboo for resilient continuous improvement and a musubi-derived interlock for harmony.
- Matched the established app treatment with ink/lacquer backgrounds, washi-ivory forms, vermilion sunrise and restrained brass accents.
- Saved the concept-only board at `docs/design-system/concepts/ronin-principles-crest-v1/ronin-crest-symbolism-10up-v1.png`; no production icon or app configuration changed.

### Verification
- Confirmed the board contains ten labelled options in one 5×2 image with simulated small-size previews.
- Identified E/J as strongest at app-icon size, I as the richest full crest and H as the clearest independent-Ronin silhouette; A–D are comparatively intricate at small sizes.

### Next step
- Select one or two crest constructions, then simplify their vector geometry and test real default/dark/tinted Apple appearances before production asset replacement.

---

## 2026-08-05 — Harada logo finalist family boards

### Changes
- Expanded the four selected Harada-inspired concepts—1 Eight-Point Compass, 7 Domain Crest, 9 Daily Grid and 10 Orbit System—into four separate boards of ten variations each.
- Each board explores Focus weighting, central-goal hierarchy, flat/tactile treatments and small-size Apple-platform readability.
- Saved the four concept-only boards under `docs/design-system/concepts/harada-logo-finalists-v1/`; no production icon or Expo configuration changed.

### Verification
- Confirmed each board contains ten labelled variations in a 5×2 grid with a simulated 32 px preview per concept.
- Confirmed all families preserve the shared meaning: Domains, Missions and daily actions contributing toward one central Overall Potential goal, with optional Current Focus emphasis.

### Next step
- Select finalists across the four boards, then compare only those finalists in default/dark/tinted iOS and macOS contexts before deterministic vector construction.

---

## 2026-08-05 — Harada-inspired logo exploration

### Changes
- Generated one ten-concept app-icon board exploring completely new brand metaphors derived from the app's Harada model: balanced Domains, daily Potential Stats, Missions, weighted Focus and Overall Potential.
- Concepts cover an eight-point compass, rising potential, focused sun, mission path, balanced stones, katana measure, domain crest, potential vessel, daily grid and orbit system.
- Saved the concept-only board at `docs/design-system/concepts/harada-logo-exploration-v1/harada-logo-concepts-10up-v1.png`; no production logo or app configuration changed.

### Verification
- Confirmed the board contains ten numbered concepts in one 5×2 image with a small-size preview for each.
- Shortlisted concepts 1, 3, 7, 9 and 10 as the clearest expressions of balanced Domains and focused potential.

### Next step
- Select one or more concepts for deeper silhouette, Apple appearance and Home-header exploration before any deterministic vector construction.

---

## 2026-08-05 — Apple-platform logo refinement concepts

### Changes
- Generated six refinements of the existing RKA ensō monogram, focusing on clearer R/K/A construction, fewer heavier strokes, removal of the ambiguous underscore and small-size recognition.
- Generated an Apple-platform application board showing the shortlisted D/F direction in default, dark, tinted, Spotlight, macOS Dock, title-bar, Home-header and three-layer Icon Composer contexts.
- Saved both concept-only boards under `docs/design-system/concepts/logo-refinement-v1/`; the configured runtime app/splash/Android icons remain unchanged.

### Verification
- Visually checked the concepts at large and simulated 32 px sizes and across light/dark/tinted Apple contexts.
- Confirmed the proposed construction keeps one consistent core silhouette and separates lacquer background, ensō and monogram into three potential layers.

### Next step
- Select a monogram direction, redraw it deterministically as vector geometry, then build real default/dark/tinted Icon Composer layers and validate actual iOS/macOS rendered sizes before replacing production assets.

---

## 2026-08-05 — Home typography hierarchy mockup

### Changes
- Generated a Home-screen refinement mockup preserving the centred `RKA` future-logo position and current River Stone/navigation layout.
- Explored lighter Inter UI hierarchy, Newsreader Journey/empty-state headlines, warmer off-white text, quieter inactive tabs, corrected `TODAY’S PATH` copy and improved Journey text contrast.
- Saved the concept-only board at `docs/design-system/concepts/home-typography-v1/home-hierarchy-newsreader-v1.png`; no runtime code, fonts or assets changed.

### Verification
- Visually confirmed that the supplied Home structure, Journey artwork, widgets, controls and navigation remain represented while the typographic hierarchy is more differentiated.
- The generated image is an art-direction reference rather than a pixel-accurate implementation specification.

### Next step
- Review the hierarchy direction, then apply selected type/contrast changes to the real Home components and validate on-device.

---

## 2026-08-04 — Onboarding typography mockup set

### Changes
- Generated five four-screen onboarding typography boards from the supplied Harada setup reference: Inter only, Inter + Newsreader, Manrope + Newsreader, Nunito Sans + Newsreader and Inter + Shippori Mincho.
- Saved the concept-only boards under `docs/design-system/concepts/onboarding-typography-v1/`; no runtime artwork, font packages, typography tokens or onboarding code changed.

### Verification
- Confirmed every board includes the introduction, Domain selection, Workout setup and Focus screens and preserves the dark/vermilion product direction.
- These generated boards are art-direction comparisons, not glyph-accurate or layout-locked implementation proofs; image generation introduced some secondary layout/icon variation.

### Next step
- Select one or two finalists, then typeset the real onboarding implementation with actual font files for a controlled device screenshot comparison before adopting a typography change.

---

## 2026-08-02 — App typography comparison mockup

### Changes
- Generated a five-direction Home-screen typography comparison covering Inter only, Inter + Newsreader, Manrope + Newsreader, Nunito Sans + Newsreader and Inter + Shippori Mincho.
- Saved the non-runtime art-direction board at `docs/design-system/concepts/rka-os-type-study-v1.png`; no fonts, packages, tokens or app code were changed.

### Verification
- Visually checked that each panel holds the UI structure, content and palette constant so the display/body typography relationship remains the main variable.
- This generated board is directional rather than a glyph-accurate typesetting proof.

### Next step
- Choose one or two directions, then build a deterministic in-app comparison using the real font files before changing the established Inter typography system.

---

## 2026-08-02 — Ronin navigation portrait concept set

### Changes
- Generated a six-option portrait navigation concept board derived from the active Journey Ronin identity.
- Explored simplified full-colour, painted, lacquer-medallion, two-tone mon, dark illuminated badge and ensō-framed treatments.
- Saved the non-runtime selection board at `apps/mobile/assets/ronin/navigation/concepts/ronin-navigation-portrait-options-v1.png`; no active navigation asset or app code was replaced.

### Verification
- Visually checked all six options for character continuity and navigation-scale suitability.
- Shortlisted D for maximum small-size clarity, E for premium presence and F for strongest ensō continuity.

### Next step
- Choose a direction, then generate and validate isolated active/inactive transparent exports at the actual tab-bar size before replacing `icons/nav/ronin-mon-portrait.png`.

---

## 2026-08-02 — Illustrator SVG to Rive source cleanup

### Changes
- Inspected the user's `Rka-OS avatar 1.svg` Illustrator export and confirmed its artwork contains 166 editable vector paths alongside a removable embedded raster reference.
- Added `tools/illustrator/prepare_rive_svg.py` to non-destructively extract the generated vector, remove the raster and white artboard, preserve its original draw order, crop it to a 1255-square transparent canvas, and assign stable names to every group and path.
- Created `apps/mobile/assets/ronin/for-rive/ronin-cat-walk-rive-source.svg` plus its JSON structure manifest. Primary branches are named for the rear boot, sword, body, hair/bandana, cat and backpack; useful nested branches now identify face/eye details, clothing, bandana tails, cat tail/head and backpack/bedroll structure.
- Added a rig-readiness audit, suggested Ronin/cat joint coordinates and `ronin-cat-walk-rig-notes.md`, including the intended Rive bone hierarchy and current View Model/data-binding contract (`progress`, `tap`, `reducedMotion`).
- Documented the repeatable SVG conversion command in `tools/illustrator/README.md`.

### Verification
- Parsed the cleaned SVG successfully and rendered it with ImageMagick; the complete Ronin and cat match the Illustrator vector with transparency intact.
- Confirmed the cleaned SVG contains no embedded `<image>` element or background `<rect>` and retains all 166 artwork paths. Re-rendered the semantic version and confirmed that naming changes did not alter the illustration.

### Next step
- Import `ronin-cat-walk-rive-source.svg` into Rive. The generated main-body branch still contains nested anatomy, so assign bones, pivots and constraints in Rive rather than treating the generated nesting as a finished skeletal rig.

---

## 2026-08-02 — Illustrator rig organisation assistant

### Changes
- Added `tools/illustrator/RKA_Rig_Organizer.jsx`, a modeless Illustrator panel for safely organising the AI-generated Ronin and cat vectors into animation-facing groups.
- On first run the script duplicates the selected generated artwork into a hidden, locked `GENERATION_BACKUP`, creates `RKA_RIG/RONIN` and `RKA_RIG/CAT`, and presents the complete part assignment checklist.
- Each assignment groups, names, moves and locks the user's selected shapes rather than guessing anatomy from geometry. Added clipping warnings, correction/unlock controls, progress tracking and a missing-group audit.
- Added `tools/illustrator/README.md` with installation, operation, safety and limitation guidance.

### Verification
- Stripped the Illustrator `#target` directives and passed the remaining script through JavaScript syntax validation.
- Confirmed the expected backup, rig hierarchy, assignment, clipping-warning and audit paths are present. Runtime canvas verification remains to be completed in the user's Illustrator document.
- First Illustrator run exposed error 8705 because the script locked a group/layer before clearing its selected items. Reordered backup creation, part assignment and bulk locking to clear selection before locking; added recovery guidance for the already-created backup.

### Next step
- In Illustrator, select the complete working generation and run the script through **File → Scripts → Other Script…**. Test `Front Boot`, `Front Shin` and `Front Thigh` first, then review the resulting Layers panel before assigning the remaining parts.

---

## 2026-08-01 — Illustrated Ronin rig build manual

### Changes
- Created a 13-page LEGO-style Figma construction guide for manually rebuilding the Ronin and cat as animation-ready vector layers.
- The manual teaches the small Figma toolset once, then provides ten visual construction stages with highlighted new pieces, expected end states and per-stage checkpoints.
- Added final joint-overlap, layer-order, phone-scale legibility and Rive handoff checks.
- Source builder and generated diagrams live under `docs/artifacts/`; the verified deliverable is `docs/artifacts/ronin_rig_build_manual.pdf`.
- After review found that the beginner manual's mascot diverged too far from the supplied PNG, added `ronin_rig_build_manual_advanced.pdf`: a 16-page faithful reconstruction guide using actual PNG close-ups, suggested Bézier anchors/handles, Pen and node-editing techniques, colour sampling, boolean/mask guidance, rotation tests, simplified three-tone depth, and a detailed Rive layer gate.

### Verification
- Rendered the DOCX to 13 page PNGs and PDF using the bundled document renderer.
- Inspected a full contact sheet: no clipped text, overflow, broken tables or unintended page breaks.
- Rendered and inspected the advanced manual twice; corrected reference/overlay scaling and arrow direction, then verified all 16 final pages.

### Next step
- Follow the manual in Figma, then review a screenshot of the completed canvas and Layers panel before beginning the Rive animation rig.

---

## 2026-08-01 — Animated Ronin journey prototype

### Changes
- Added `RoninJourneyPrototype.tsx` above the Today content on Home, using the existing `todayItems` completed/total ratio as its only progress source.
- Iterated the original side-profile walker twice after visual review rejected the first detailed 3D render and then the still-too-illustrative intermediate. The active asset is now the ultra-simple, six-color app mascot at `apps/mobile/assets/ronin/journey/ronin-walker-flat-v3.png`.
- Expanded the card into a layered illustrated landscape with mountains, hills, a travelled/untravelled five-waypoint route and destination gate. The larger Ronin continuously idles, advances along the rising trail, and gives a haptic hop when tapped.
- Reduce Motion retains a slower progress translation and minimal idle so the functional walking metaphor remains visible, while rotational movement is removed.
- After on-device review reported that both idle and taps appeared inert and the generated SVG landscape looked poor, replaced that visual revision rather than tuning it. Used the user's supplied Fuji sunset/Ronin/cat composite as the new source of truth, producing `sunset-trail-background-v1.png` with the characters removed and `ronin-cat-walkers-v1.png` as a transparent grouped layer.
- Rebuilt interaction reliability: the entire journey card is now the `Pressable`, while the animated character is pointer-events-free. Tap is deliberately unmistakable (medium haptic, 18pt hop, scale pulse and temporary phrase bubble). Continuous motion now uses a simple reversible `withTiming` repeat; Reduce Motion still gets a slower two-point bob and progress travel without rotation.
- Recorded the component, prototype status, artwork path, and exact shipped generation prompt across the app guide, design checklist, component reference, prompt library, and root agent guide.

### Verification
- Targeted TypeScript check for `RoninJourneyPrototype.tsx`: passed.
- Targeted TypeScript check after the supplied-art rebuild: passed.
- Full mobile test suite after the supplied-art rebuild: 109/109 passed.
- `git diff --check`: passed before documentation updates.
- Full `tsc --noEmit`: still blocked by the existing TypeScript compiler `Maximum call stack size exceeded` crash, with no source diagnostic.

### Next step
- Rive migration requested after PNG motion remained unsatisfactory. `@rive-app/react-native` and `react-native-nitro-modules` are installed successfully. Sign in to the Rive editor tab left open by Codex, then author/export a local `.riv` state machine with continuous idle/walk, tap, numeric progress and completion states; wire it over the existing Fuji background and make a fresh native development build.

---

## 2026-08-01 — High-detail collection artwork

### Changes
- An initial filled-SVG pass was rejected after on-device review because it lacked the detail and material depth of the existing 3D entity artwork.
- Generated four replacement transparent 1254×1254 PNG identities using the existing Task note, Project portfolio and Medication bottle as direct style references: black lacquer kettlebell (Workout), wooden prayer beads with lacquer tally (Habit), indigo/rose furoshiki parcel (To Get), and black lacquer/brass scroll chest (Archive destination).
- Added the final assets under `apps/mobile/assets/icons/collections/`; `CollectionIcons.tsx` now provides consistent RN Image wrappers rather than drawing simplified SVGs.
- Replaced generic collection glyphs in `MenuScreen.tsx` and reused the entity icons in Calendar, Habit creation, To Get placeholders and the Home practice card.
- Removed the collection cards' tinted rounded-square icon badges and enlarged every transparent object to 42pt, leaving the artwork directly on the River Stone card surface.
- Kept generic archive glyphs for swipe actions, settings and other universal commands; the custom chest identifies the Archive destination only.
- Updated the custom-icon audit, design checklist, reference iconography, `AGENTS.md`, and `apps/mobile/CLAUDE.md`.

### Verification
- Targeted TypeScript check for all six touched TSX files: passed.
- Full mobile test suite: 109/109 passed.

### Next step
- Check the four replacement objects together on-device in dark and light mode; tune subject scale if one reads smaller than its siblings.

---

## 2026-08-01 — Animation-ready vector FAB

### Changes
- Rebuilt `apps/mobile/src/components/fab/FabControl.tsx` from idle/pressed PNG swapping into one layered SVG/Reanimated control.
- Preserved the blue lacquer disc, washi paper and calligraphy brush identity while separating disc, paper, ink, handle, ferrule and brush tip into independently animated layers.
- Added press compression, brush lift/sweep, ink reveal, long-press pose, haptics and Reduce Motion handling without changing the shared tap or route-aware long-press APIs.
- Updated `AGENTS.md`, `apps/mobile/CLAUDE.md`, `apps/mobile/DESIGN_CHECKLIST.md`, and the design-system references. The previous PNG frame pack remains as source/reference art and can be removed separately after an on-device visual sign-off.

### Verification
- Isolated TypeScript check for `FabControl.tsx`: passed.
- `git diff --check`: passed.
- Expo web production export: passed (existing Tamagui static-extraction warnings remain).
- Full project `tsc --noEmit`: blocked by a TypeScript `Maximum call stack size exceeded` compiler crash with no source diagnostic; this is distinct from the isolated FAB check.

### Next step
- View the 52pt dock and 56pt capture variants on-device and tune brush angle/travel if desired; then remove the unused raster frame pack in a separate cleanup.

---

## Platform Overview

| Platform | Location | Status | Run Command |
|----------|----------|--------|-------------|
| **React Native iOS** | `apps/mobile/` | Active development | `cd apps/mobile && npm start` |

---

## Session — Skills layer (2026-08-06)

### What Was Done
Added `Skill` as a first-class entity distinct from Domains — "Domains = areas of life you maintain, Skills = capabilities you develop, Habits/routines = repeated practice, Missions/projects = outcomes you pursue, Achievements = evidence of meaningful progress." Requested by the user as a new layer, not a redesign of an existing one — new schema, new scoring channel, new screens.

**Locked product decisions (confirmed with the user before building):** proficiency is a manual 0-100 self-rating, never derived from practice data. A Skill's only path to Domain scoring is a new capped/decaying `domainContributions` row (`sourceType: 'skill'`, `SKILL_CONTRIBUTION_DEFAULTS`: magnitude 0.3/halfLife 45d — deliberately smaller than the Mission 0.25/14d and Achievement 0.6/60d tiers) created from a skill-linked milestone/achievement — never merely by existing.

1. `apps/mobile/src/db/types.ts` — `ItemType` gains `'skill'`; `DomainContributionRow.sourceType` gains `'skill'`.
2. `apps/mobile/src/utils/domainScoring.ts` — `SKILL_CONTRIBUTION_DEFAULTS`.
3. `apps/mobile/src/db/database.ts` — Skill CRUD (`createSkill`, `getSkills`, `getSkillsForArea`, `updateSkillProficiency`), primary Domain via a real `skillArea` relation + secondary Domains via `metadata.secondaryAreaIds` (a plain array — `itemRelations` only supports one target per `(sourceId, relationType)`, and a skill can have several secondaries). Organizational links `habitSkill`/`routineSkill`/`missionSkill` — linked items keep contributing to Potential exactly as they already do via their own Potential Stat/Mission-area relation, no second contribution. `achievementSkill` (mutually exclusive with `achievementArea` — an achievement targets a Domain or a Skill, never both, which is the actual double-counting guardrail) + `createSkillMilestone`/`setSkillMilestoneContributesToScore`/`deleteSkillMilestone`, which can write/exclude MULTIPLE `domainContributions` rows for one achievement (primary Domain full weight, each secondary half weight) — a new `getSkillContributionRows` helper reads all of them, since the existing `getContributionForSource` only returns the single most recent row. `computeSkillPracticeSummary` — read-only 30-day aggregation of linked habit completions/routine sessions, not a scoring input.
4. `SkillsScreen.tsx`/`SkillDetailScreen.tsx` (new) — card grid list (matches the Domains grid pattern) and detail screen (5-level tap-stepper proficiency, no new dependency; primary/secondary Domain pickers; linked habits/routines/missions via action-sheet pickers; milestones mirroring `AchievementsScreen`'s add/toggle/delete flow but targeting the skill; 30-day practice readout). Registered in `MenuStack.tsx`, tile added to `MenuScreen.tsx`. `AreaDetailScreen.tsx` gained a Skills section (skills where the Domain is primary or secondary).

### Verified
- `npx tsc --noEmit`: clean across every touched/new file.
- Every commit manually diffed against its predecessor to confirm it contains only this feature's own changes.
- Not done: on-device verification (no simulator/device available in this environment).

### Next Steps
Not built: bulk-migrating existing habits/missions to Skills (the examples the user gave — Music Production, App Development, Guitar, Medicine, Strength Training — are illustrative, no seed data was created). No UI yet to unlink a habit/routine/mission from a skill (only linking) or to remove a Skill's primary Domain from the Skill detail screen's own picker flow beyond the "None" option already present. `getSkillContributionRows`/`computeSkillPracticeSummary` are O(all achievements)/O(all routine-sessions) scans — fine at current scale, would want indexing if either table grows large.

## Session — Journey/Domains/Potential/Focus visual redesign (2026-08-06)

### What Was Done
Restyled the Journey, Potential, Focus, and Domain-detail screens to the "warm midnight storybook" direction (deep midnight bg, ivory text, muted brass, restrained vermilion, River Stone surfaces) per a supplied reference board. Structural, not cosmetic-only — added a genuine Harada-method visual connective element. No scoring logic, navigation structure, or data model changed.

1. `apps/mobile/src/components/potential/HaradaWheel.tsx` (new) — center Overall Potential node + up to 8 Domain nodes on a circle, thin brass connecting lines, vermilion ring on the active Focus domain. Real RN touch targets (not SVG-embedded — those are unreliable for accessibility), each ≥44pt with `accessibilityLabel`/`Role`; only the connecting lines are SVG. Two sizes: compact (embedded in `PotentialScreen`) and full (behind a "View Harada Map" toggle).
2. `PotentialScreen.tsx` — River Stone hero card wrapping the wheel; Domains list kept below as the accessible flat fallback (VoiceOver users get real rows, not just the radial visual).
3. `AreaDetailScreen.tsx` — chapter-style header: full-bleed River Stone-cropped header reusing the existing Journey landscape art (tinted, not a new asset), score + a "current vs. maintenance-only baseline" directional cue (no fabricated time-trend, since no score history is stored). Missions/Pillars/Achievements sections restyled; Pillar rows now surface contributing habits inline.
4. `JourneySummaryStrip.tsx` (new) — compact Overall Potential + Current Focus readout below Home's Journey hero card; the hero itself stays about today's task completion, unchanged.
5. `FocusScreen.tsx` and `ProfileScreen.tsx`'s Potential card — token-level restyle only (brass/vermilion), no functional changes.

**Locked decisions from research before touching anything:** two `RiverStoneSurface` components exist in the repo (`ui/` = canonical/wired everywhere except Profile's header, `riverstone/` = older parallel one) — all new work here uses `ui/`. No dimensional "collection" icon exists for Domains/Mind/Career/etc. and none was generated in this pass — reused existing heroicon-outline glyphs restyled with brass/vermilion rather than fabricating 3D icons. Bottom nav (Home/Calendar/Menu/Profile) unchanged, no new tab — Potential/Focus/Achievements stay reachable via Menu as before. `Newsreader_600SemiBold` (already loaded) reused for section/screen titles per the "editorial serif sparingly" direction; all data/body text stays Inter.

### Verified
- `npx tsc --noEmit`: clean across every touched/new file.
- Every commit manually diffed against its predecessor to confirm it contains only this redesign's own changes.
- Not done: on-device verification (no simulator/device session available in this environment) — recommend checking both color schemes and VoiceOver on the new `HaradaWheel` nodes before considering this final.

### Next Steps
`ProfileScreen.tsx`'s header and the rest of the screen are still on the old visual system (only its Potential card was touched) — a full Profile pass is separate future work. Domain-specific dimensional iconography (matching the Workout/Habit/To Get/Archive collection set) would be the next visual upgrade if pursued. `RoninJourneyPrototype.tsx` itself remains "prototype awaiting on-device verdict" per the existing checklist note — untouched by this session beyond the new summary strip beneath it.

## Session — Domains/Potential/Achievements/Focus landing + fix (2026-08-05)

### What Was Done
A large body of work implementing the Harada-inspired "Domains -> Missions -> Potential Stats -> Achievements -> Focus -> Overall Potential" scoring system was sitting entirely uncommitted in the working tree (16 files, ~2000 lines — 5 of them never committed at all: `AchievementsScreen.tsx`, `FocusScreen.tsx`, `OnboardingScreen.tsx`, `domainScoring.ts`, `domainScoring.test.ts`). Audited it end to end (every `database.ts` function, the pure scoring math, every surfacing screen, navigation reachability, types), found it substantially real and correct — 24 passing unit tests, no dead-end buttons, no stub screens — then landed it as a proper commit.

1. `apps/mobile/src/utils/domainScoring.ts` — pure decay/lift/score math (exponential half-life decay, product-of-complements diminishing-returns lift, capped-at-100 Domain score, weighted Overall Potential). 15 tests.
2. `apps/mobile/src/db/database.ts` — `potential-stat` items + Domain linkage (`potentialStatArea` relation, kept separate from Mission's `area` relation); `domainContributions` table (soft-disable via `excludedAt`, never deleted); `achievement` items (permanent trophies, independent of their live scoring effect); `completeMission`/`setMissionAchievementEligible` (mutually-exclusive Mission-vs-Achievement-tier contribution, preserving the original completion date across eligibility toggles); `focus` singleton (read-time-only weighting, never touches history).
3. `PotentialScreen.tsx`/`AchievementsScreen.tsx`/`FocusScreen.tsx`/`AreaDetailScreen.tsx`/`ProfileScreen.tsx` — surface the above over real data; all reachable via `MenuStack.tsx`/`MenuScreen.tsx`.
4. `OnboardingScreen.tsx` — first-launch guided setup (Domains -> per-Domain Mission/Potential Stat -> Focus), gated in `App.tsx` on `getItemsByType('area').length === 0` at boot, skippable throughout. Confirmed this is why a fresh/empty install shows 0%/0% on Home — correct empty-state math, not a bug, and Onboarding is the intended fix for that cold start.

### Bug found and fixed
`createAchievement` only ever stored `contributesToScore` in metadata — it never inserted the `domainContributions` row that actually feeds Domain scoring. `completeMission`/`setMissionAchievementEligible` get this right by inserting their own contribution alongside the trophy, but the Achievements screen's manual "+ Add" flow (`source: 'manual'`) had no equivalent, so a retrospective achievement marked "contributes to score" silently did nothing to Potential. Added `setAchievementContributesToScore` (creates/reactivates/excludes the contribution row to match the flag) and `deleteAchievement` (excludes the contribution before soft-deleting, so a removed trophy stops counting); `AchievementsScreen` now calls the former right after creation, and rows gained a long-press menu (toggle contributes-to-score, delete) — previously there was no way to edit or remove an achievement after adding it.

### Verified
- `node --test` on `domainScoring.test.ts` (15/15) and `potential.test.ts` (9/9), before and after the fix.
- `npx tsc --noEmit`: clean throughout.
- Each commit manually diffed against its predecessor to confirm scope: the big feature landing first (isolated from the achievement-scoring bug fix, which is a separate commit on top), and both isolated from the large amount of unrelated dirty content still sitting in the same files (exercise library, calendar tray, visual refresh, etc. — left untouched, not this session's scope).

### Next Steps
Doc sync for this feature (this entry, plus `AGENTS.md`/`CLAUDE.md`/`SCHEMA.md`) closed out in the same session. Not investigated: `getAchievementForSource`'s full-table-scan-per-achievement pattern (fine at current scale, would want an index if achievements grow large); whether `completeMission` needs a DB-level (not just UI-level) guard against double-completion.

## Session — Routines and Quantified Habits (2026-08-05)

### What Was Done
Both phases of `docs/superpowers/plans/2026-08-05-routines-quantified-habits.md` shipped.

**Phase 1 — Quantified habits.** Binary habits are unaffected — the existing fast tap-to-complete flow is unchanged.
1. `apps/mobile/src/utils/habitMeta.ts` (new) — `HabitMeta` type, `parseHabitMeta`, `computeHabitPeriodProgress`; pure, unit-tested (`habitMeta.test.ts`, 6 passing via `node --test`).
2. `apps/mobile/src/db/database.ts` — `logHabitSample`/`getHabitSamples`/`undoLastHabitSample`, following the existing `activityLogs` event-sourcing pattern (`'habit-sample'` action type) rather than a stored counter.
3. `apps/mobile/src/components/home/HabitQuantifiedSheet.tsx` (new) + `apps/mobile/src/screens/HabitsScreen.tsx` — contextual completion control branching on measurement type (mark-done / add-one / enter-value sheet), undo via the existing long-press action sheet.
4. `apps/mobile/src/screens/HabitDetailScreen.tsx` — collapsed "Measurement" disclosure for intent/measurement/target value/unit/period; `QuickCreateSheet` stays single-field fast capture.

**Phase 2 — Routines.** A separate `routine`/`routine-step`/`routine-session` item domain — never Missions, no Harada/Potential semantics.
5. `apps/mobile/src/db/types.ts` — `ItemType` gains `'routine' | 'routine-step' | 'routine-session'`.
6. `apps/mobile/src/utils/routineMeta.ts` (new) — `RoutineStepMeta`/`RoutineSessionMeta` types and `computeStepRemainingSeconds`, pure and unit-tested (`routineMeta.test.ts`, 8 passing, including a simulated-relaunch scenario).
7. `apps/mobile/src/db/database.ts` — routine/step/session lifecycle functions (`createRoutine`, `addRoutineStep`, `getRoutineSteps`, `startRoutineSession`, `getActiveRoutineSession`, `advanceRoutineSession`, `pauseRoutineSession`/`resumeRoutineSession`, `addRoutineSessionStepTime`, `finishRoutineSession`). Step ordering reuses the existing manual-order table (`applyManualOrder`/`setManualOrder`), same as `WorkoutTemplateDetailScreen`'s blocks.
8. `apps/mobile/src/screens/RoutinesScreen.tsx`, `RoutineTemplateDetailScreen.tsx`, `RoutineSessionScreen.tsx` (new) + `apps/mobile/src/components/RoutineStepEditSheet.tsx`, `RoutineResumeBanner.tsx` (new) — template list/editor, and a durable session player whose remaining-time math is derived entirely from persisted timestamps (never a local counter), plus an `App.tsx`-mounted resume banner closing the relaunch-recovery gap that exists even for the app's existing WorkoutSession precedent.
9. Routes registered in `apps/mobile/src/navigation/MenuStack.tsx`; nav tile added in `apps/mobile/src/screens/MenuScreen.tsx`.

**Guardrail enforced throughout:** routine sessions never write to `domainContributions` and never touch `potentialStat` — only a linked habit's own maintenance math (streak-based) may affect Potential, so finishing a routine never double-counts alongside a habit it happens to reference. No Apple Health/HealthKit packages, permissions, sync, or UI were added anywhere in this work.

### Verified
- `node --test` on `habitMeta.test.ts` (6/6) and `routineMeta.test.ts` (8/8).
- `npx tsc --noEmit`: no errors introduced in any touched file (verified per-task throughout, plus a final full-project pass).
- Every commit on `feature/routines-quantified-habits` was manually diffed against HEAD to confirm it contains only this work's own changes, not concurrent unrelated in-flight edits already present in the working tree from another agent's session.

### Next Steps
Phase 3 (reminders, iOS Live Activity for the current routine step, more polished review views) is explicitly deferred, per the product brief's suggested order — not started. Apple Health/HealthKit remains explicitly out of scope for all of this work.

## Session 1 — PWA Fixes & Layout (2026-06-24)

### What Was Done
1. **Fixed Inbox sheet** — switched from Vaul (`NativeBottomSheet`) to custom `BottomSheet` primitive. All 7 items now visible.
2. **Redesigned bottom nav** — floating pill (Home | Calendar | Menu | Me) + separate FAB.
3. **Reorganised app header** — Profile icon (left) | RKA OS (centre) | Sync status (right).
4. **Removed Me from bottom nav** — moved to top-left of header.
5. **Compacted home page layout** — entire page fits on screen without scroll when collapsed.
6. **Added scroll behaviour** — `overscroll-behavior: contain`, scroll-padding, smooth scroll.

### Key Spacing Values (Web)
```css
.rka-page { gap: 12px; padding: 0; }
.rka-section { gap: 8px; }
.time-block-stack { gap: 4px; }
.rka-page-title { font-size: 24px; }
.rka-page-subtitle, .rka-page-kicker { display: none; }
```

---

## Session 2 — React Native Migration (2026-06-25)

### Decision
Migrated to React Native + Expo because the PWA cannot support:
- 3D Touch / context menus
- HealthKit
- Background sync
- Location-based reminders
- Home screen widgets

Strategy: **Expo managed workflow + EAS remote builds. No ejecting. No local Xcode.**

### What Was Built

#### Foundation
- Expo SDK 54 project at `apps/mobile/`
- `babel.config.js` with Reanimated plugin
- `eas.json` with dev/preview/production profiles
- `app.json` with all iOS permissions (location, health, background, notifications)

#### Design System (`src/theme/`)
Full RKA design token parity with web CSS custom properties:
- `colors.ts` — all `--rka-*` colour vars as TS constants
- `spacing.ts` — spacing, radius, font sizes, shadow objects

#### Database (`src/db/`)
- `types.ts` — Item, ItemInstance, ActivityLog interfaces (mirrors web Dexie schema)
- `database.ts` — SQLite init, schema creation, all CRUD + query functions

#### Hooks (`src/hooks/`)
- `useDb.ts` — `useInbox()`, `useHomeData()`, `useItems()`
- `useNotifications.ts` — permission, schedule, badge, daily reminders

#### Services (`src/services/`)
- `backgroundSync.ts` — 15-min background task, updates badge, stub for Firebase
- `locationReminders.ts` — geofencing, arrive/leave notifications, `addGeofence()` / `removeGeofence()`

#### Components (`src/components/`)
- `AppHeader.tsx` — Profile | RKA OS | Synced (mirrors web header)
- `SwipeableItem.tsx` — Reanimated swipe, drag-tracked opacity/scale on action buttons
- `ContextMenu.tsx` — long-press modal menu (3D Touch feel)

#### Screens (`src/screens/`)
| Screen | Status | Notes |
|--------|--------|-------|
| HomeScreen | ✅ Functional | Real DB data, inbox count, stats, time blocks |
| InboxScreen | ✅ Functional (Things 3 redesign) | Flat circle-checkbox rows + bottom capture row; swipe + long-press |
| QuickAddScreen | ✅ Functional (Things 3 redesign) | Modal sheet with title/notes inputs, toolbar (Cancel \| Save) |
| MenuScreen | ✅ UI only | Projects, Workouts, Medications (navigation pending) |
| CalendarScreen | 🔲 Placeholder | |
| ProfileScreen | 🔲 Placeholder | |

#### Recent Changes (Session 3)
- **Things 3 UI redesign** — QuickAddScreen and InboxScreen now match Things 3 aesthetic (flat rows, circle checkboxes, capture input at bottom, toolbar pattern)
- **LogDoseSheet toolbar** — replaced separate buttons with Things 3-style top toolbar (Cancel | Title | Save)
- **DB notes field** — `createItem()` now accepts optional `notes` parameter for inline storage
- **backgroundSync.ts fixed** — removed deprecated `expo-background-fetch`, now uses `expo-background-task` (dynamic import with Expo Go fallback)
- **BlurView removed** — replaced with semi-transparent `backgroundColor` in App.tsx (BlurView not available in Expo Go)

### Packages Installed
```json
"expo": "~54.0.0",
"expo-background-task": "^56.0.19",       // (was expo-background-fetch)
"expo-haptics": "~15.0.8",
"expo-location": "~19.0.8",
"expo-notifications": "^0.32.17",
"expo-sqlite": "~16.0.10",
"expo-task-manager": "~14.0.9",
"react-native-reanimated": "~4.1.1",
"react-native-gesture-handler": "~2.20.0",
"@shopify/react-native-skia": "^2.2.12",  // needs dev build
"rive-react-native": "^9.8.3"             // needs dev build
```

### Known SDK 54 Gotchas
- All `npm install` needs `--legacy-peer-deps`
- `lucide-react-native` must be `^1.21.0`+ (0.263 conflicts with React 19)
- `react-native-get-random-values` must be `~1.11.0` (not 2.x)
- tsconfig must NOT extend `expo/tsconfig.base` (base uses `"module": "preserve"` requiring TS 5.4+)
- Reanimated plugin must be in `babel.config.js` ONLY (not in `app.json` plugins — causes crash)
- `expo-background-fetch` is deprecated → use `expo-background-task` with dynamic import for Expo Go compatibility

## Session 3 — Quick Add polish + BottomSheet keyboard fixes (2026-07-07)

**Status of this session's work: all uncommitted in the working tree.** Nothing from
Sessions 1–3 has been committed yet — `git status` on `apps/mobile` is dirty. See
"Uncommitted state" below before doing anything destructive (`git checkout`, `stash`, etc.).

### Context
A prior session (Fable-audited, Sonnet-built, plan at
`~/.claude/plans/only-audit-plan-using-ticklish-hoare.md`) rebuilt `BottomSheet.tsx` with
`useAnimatedKeyboard` and started a 4-phase Quick Add polish round (When chip, dismiss-saves,
keep-adding, draft persistence). Phases 2–4 never actually landed (the agent that reported
"finished in 11s" hit a rate-limit error and wrote nothing). This session picked up from there.

### What was done
1. **Fixed the swipe-to-dismiss gesture conflict** — `GestureDetector`'s pan gesture no longer
   wraps the Cancel/Save `TouchableOpacity`s, only the drag-handle bar itself
   (`src/components/ui/BottomSheet.tsx`).
2. **Implemented Quick Add Phases 2–4** (`src/screens/QuickAddScreen.tsx`):
   - Phase 2: When chip (Today / This Evening / Tomorrow / Anytime / Clear), inline row, exact
     `scheduledDate`/`status`/`timeOfDay` mapping per the plan doc.
   - Phase 3: dismiss-saves (swipe/backdrop with text = silent save, success haptic, never a
     dialog); keep-adding (return key saves, clears title, keeps `when`, refocuses, single-line
     title).
   - Phase 4: draft persistence — new `src/utils/quickAddDraft.ts` (AsyncStorage), backgrounding
     with unsaved text saves a draft, reopening prefills once then clears.
3. **Fixed Inbox staleness bug** — `InboxScreenV2.tsx`'s `useInbox()` only fetched once on mount;
   items created via the global Quick Add FAB never appeared until app reload. Now refetches on
   `visible` becoming true.
4. **Rewrote BottomSheet's keyboard handling** — the `useAnimatedKeyboard`-based manual lift
   math raced against the entrance spring on autofocus (sheet never lifted on cold open). Reverted
   to native `KeyboardAvoidingView` (`behavior="padding"`), matching the already-proven pattern in
   `MedicationsScreen.tsx`'s Add Medication modal. Kept the swipe gesture/backdrop/entrance spring.
5. **Fixed a native crash on drag-handle swipe** — two compounding causes, both fixed:
   - `Keyboard.dismiss()` was firing in the gesture's `.onStart` on every touch-down, racing a
     native `KeyboardAvoidingView` layout pass against an in-flight Reanimated worklet. Moved it
     to only fire in `.onEnd` when the dismiss threshold is actually crossed.
   - The `onClose` callback (SQLite write + haptics + several `setState`s cascading into an
     unmount) ran synchronously inside the `runOnJS` bridge right as the native pan recognizer was
     tearing down. Deferred it with `setTimeout(onClose, 0)` so the recognizer finishes first.
   - Also regenerated the native iOS project (`npx expo prebuild --clean`) and shipped a fresh EAS
     dev-client build, since the installed binary predated a same-day `expo-dev-client` version fix
     (`^56.0.20` → `~6.0.21`, a bad/typo'd entry) — this turned out NOT to be the actual crash
     cause, but is still the correct, up-to-date state and worth keeping.
6. **Fixed a stale-KeyboardAvoidingView bug on fast dismiss→reopen** — `BottomSheet`'s outer
   mount-gate could reuse the same `SheetContainer`/`KeyboardAvoidingView` instance across a fast
   swipe-dismiss-then-reopen, leaving its native keyboard-frame tracking stale. Now keyed on an
   incrementing `openId` so every open mounts fresh.
7. **Fixed double keyboard-inset compensation** — the scrollable body's `ScrollView` had
   `automaticallyAdjustKeyboardInsets` stacked on top of the outer `KeyboardAvoidingView`'s own
   padding, which double-shifted content and scrolled the title out of view. Removed the
   `ScrollView` prop; `KeyboardAvoidingView` alone owns it now.
8. **Added a `topAnchored` mode to `BottomSheet`** — after iterating on "half page" vs "full page"
   with the user, landed on: content-sized (not stretched), anchored just below the safe-area top
   (`justifyContent: 'flex-start'`, `paddingTop: insets.top + spacing[6]`) instead of
   bottom-anchored. Applied to `QuickAddScreen` via the new `topAnchored` prop. (`fullHeight` is a
   separate flex-fill variant still used by other consumers like `LogDoseSheet`/`CalendarScreen`;
   not touched this session. `topAnchored` and `fullHeight` are orthogonal and were briefly
   combined mid-session before settling on `topAnchored` alone — see below.)
9. **Fixed a real layout bug this surfaced** — the scrollable body's `ScrollView` had
   `style={{ flex: 1 }}` unconditionally. That only resolves when the parent chain is flex-bound
   (true for `fullHeight`); in content-sized `topAnchored` mode the parent has no bound, so the
   `ScrollView` collapsed to zero height and the whole card appeared empty (title/notes/pills
   invisible). Fixed: `style={fullHeight ? { flex: 1 } : undefined}` — only flex when the parent
   actually gives it something to flex against.
10. **Restyled Quick Add as a Things-3-style floating card**, per Mobbin reference research
    ([Things 3 "Creating a new to-do"](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)):
    - Converted the inline When-picker row (Today/This Evening/Tomorrow/Anytime/Clear) into an
      absolutely-positioned popover overlay anchored below the "When" pill, so opening it doesn't
      grow the sheet's height (`whenPopover` in `QuickAddScreen.tsx`).
    - `topAnchored` sheets now render with `sheetCardRadius` (all four corners rounded — Things 3
      itself only rounds the bottom because its card is flush against the screen edge with zero
      gap above; ours has a visible top gap for status-bar breathing room, so square-top would
      look broken, not intentional) instead of the standard sheet's top-only radius.
    - Backdrop tap-to-dismiss is **disabled** for `topAnchored` cards (`onPress={topAnchored ?
      undefined : onClose}`) — the dimmed gap between a compact card and the keyboard is easy to
      tap by accident while typing mid-note; dismissal still works via the drag-handle swipe and
      Cancel/Save. The backdrop still blocks touches from reaching the app behind it, just no
      longer closes on tap.
    - Toolbar (Cancel/Save) deliberately stayed at the top, not moved to the bottom like Things
      3's actual layout — kept consistent with every other `BottomSheet` consumer in the app
      (LogDose, Medications). Flagged to the user as a scope call, not an oversight; revisit if
      full Things 3 parity is wanted later.
11. **Hardened position-reset on open** — `dragY` (the swipe-drag shared value) was never
    explicitly zeroed when a swipe crossed the dismiss threshold; it relied entirely on the
    `key={openId}` remount (item 6) giving every open a fresh shared value. Added an explicit
    `dragY.value = 0` at the top of the entrance branch in `SheetContainer`'s `visible` effect, so
    the reset is guaranteed regardless of remount timing, not just implied by it. (Deliberately did
    *not* reset `dragY` in the gesture's `.onEnd` dismiss branch — doing so mid-exit-animation would
    cause a visible snap/jump instead of a smooth continued slide-off.)

### Verified on-device (physical iPhone, EAS dev-client build)
- Quick Add keyboard lift on cold open — works.
- Swipe-to-dismiss on drag handle (with text, triggers save) — no longer crashes.
- Fast dismiss→reopen keyboard lift — works.
- Inbox shows items added via the global Quick Add FAB without reload — works.
- Card content (title/notes/pills) visible after the ScrollView flex fix — confirmed via
  screenshot.
- Card corners rounded on all sides, positioned with top breathing room — confirmed via
  screenshot.

### NOT yet verified on-device (pick up here)
- When chip: Today/This Evening/Tomorrow/Anytime mapping actually landing items correctly on
  Home's Today/Evening blocks. The new popover-overlay interaction itself also hasn't been
  screenshotted/confirmed yet.
- Keep-adding: return key 3× → 3 items, sheet stays open, `when` persists.
- Draft persistence: background app with unsaved text → reopen Quick Add → draft prefills once.
- Backdrop-tap-no-longer-dismisses for `topAnchored` — implemented, not yet confirmed on device.
- Position-reset hardening (item 11) — implemented in response to a user request for extra
  robustness, not a confirmed reproducible bug; user asked to stress-test rapid
  swipe-dismiss→reopen cycles, not yet confirmed done.

### Uncommitted state
Everything above is **uncommitted**. Also present in the working tree but **untouched by this
session** and unrelated to it: a large uncommitted diff removing the entire lyrics-player feature
and audio files, and a ~1700-line `CalendarScreen.tsx` rewrite. These predate this session and
were explicitly scoped out (see chat: user confirmed "1 yes definitely" to scoping this session to
the keyboard/Quick Add work only, leaving that other churn alone). Do not commit everything
together — separate these concerns before committing anything.

### Known gap, explicitly deferred (not this session's scope)
**There is no real sync/multi-device story.** `src/services/backgroundSync.ts` is a badge-count
updater with a `// TODO: sync with Firebase when online` that was never implemented.
`firebase` is a dependency (`firebase.ts`), but no realtime listeners exist yet. Everything is
100% local SQLite today — reinstall the app and all data is gone.

---

## Session 4 — Home Polish, Inbox Triage Modal, Backend Purge & Multi-Agent Protocol (2026-07-27)

### What Was Done
1. **Home Screen Timeline Polish** (`apps/mobile/src/components/TimelineSection.tsx`):
   - Surfaced parent project subtitles, checklist progress fractions (e.g. `1/2`), and dynamic `DeadlineBadge` indicators on daily timeline task rows.
   - Defaulted all daily time blocks (Morning, Afternoon, Evening, Anytime) to expanded mode on load.
   - Fixed React Rules of Hooks ordering bug in `TimeBlockItems` by moving conditional early returns after all hook declarations.
2. **Inbox Triage Modal Layering Fix** (`apps/mobile/src/components/triage/TriageOverlay.tsx`):
   - Wrapped `TriageOverlay` in a React Native `<Modal>` component so tapping an Inbox item immediately presents the full-screen guided triage session over the Inbox modal rather than underneath it.
3. **Purged Legacy Supabase References & Clarified Firebase**:
   - Audited the entire repository and verified that `firebase` (`src/lib/firebase.ts`) is the sole backend package.
   - Completely purged stale Supabase references in `AGENTS.md`, `HANDOVER_SUMMARY.md`, and `REACT_NATIVE_SETUP.md`.
   - Deleted obsolete Supabase plan/spec files (`2026-07-10-mobile-supabase-backup.md`, etc.).
4. **Multi-Agent & Developer Synchronization Protocol**:
   - Added a mandatory protocol section to `AGENTS.md` and `apps/mobile/CLAUDE.md` governing documentation synchronization, zero context drift, mandatory handover logging, and repository verification for all present and future AI agents (Claude, Codex, Antigravity) and developers.
5. **Firebase Real-time Sync Service** (`apps/mobile/src/services/firestoreSync.ts`):
   - Implemented real-time bidirectional synchronization service between local SQLite (`expo-sqlite`) and Cloud Firestore (`firebase/firestore`).
   - Wired `onSnapshot` listeners to `users/{userId}/items` and `users/{userId}/itemInstances`.
   - Wired local mutation hooks (`createItem`, `updateItem`) to automatically push local edits up to Firestore when signed in.

---

## Blocker: Apple Developer Account — RESOLVED

~~Cannot test until resolved~~ — Apple Developer Program is active, EAS dev-client builds work.
See "iOS Dev Build" — current flow:

```bash
cd apps/mobile
npx expo start --dev-client         # Metro; add --port <N> if 8081 is taken
# On the iPhone dev-client: Enter URL manually → http://<mac-ip>:<port>
```

To ship a fresh native build after changing native deps or running `expo prebuild`:
```bash
cd apps/mobile
npx expo prebuild --clean --platform ios   # regenerates ios/ (gitignored, safe to nuke)
npx eas-cli build --platform ios --profile development --non-interactive
# Install link printed at the end; same bundle ID so it overwrites in place (data preserved)
```

---

## Next Features (In Priority Order)

1. **HealthKit screen** — steps, workouts, sleep from Apple Health
2. **Skia charts** — progress rings on home stats
3. **Rive animations** — empty states, check animations, loading
4. **Calendar screen** — weekly view of scheduled items
5. **Profile + Settings** — notifications prefs, location reminders manager
6. **Firebase sync** — wire background task to real API
7. **Deep links** — `rkaos://inbox`, `rkaos://item/:id`
8. **Projects screen** — task management with Kanban view

---

## Quick Reference

### Run the App (Expo Go)
```bash
cd apps/mobile
npm start -- --clear    # always --clear after package changes
# Scan QR with iPhone
```

### Run Web PWA
```bash
npm run dev    # from project root
```

### File Locations
| Thing | File |
|-------|------|
| DB queries | `apps/mobile/src/db/database.ts` |
| State hooks | `apps/mobile/src/hooks/useDb.ts` |
| Notifications | `apps/mobile/src/hooks/useNotifications.ts` |
| Background sync | `apps/mobile/src/services/backgroundSync.ts` |
| Location | `apps/mobile/src/services/locationReminders.ts` |
| Design tokens | `apps/mobile/src/theme/` |
| Full setup guide | `docs/migration/REACT_NATIVE_SETUP.md` |

---

## Documentation Index

| File | Contents |
|------|---------|
| `CLAUDE.md` | Project config, skills, constraints, current status |
| `HANDOVER_SUMMARY.md` | This file — session history and quick reference |
| `docs/migration/REACT_NATIVE_SETUP.md` | Full RN setup guide, architecture, what works where |
| `docs/design-system/` | RKA.OS Design System — AI reference + human handbook |

PWA-specific docs (`FIX_LOG.md`, `AUDIT_LOG.md`, `SCROLL_*.md`, `IOS_BOTTOM_NAV.md`, `MOBILE_IMPLEMENTATION_GUIDE.md`) were removed when the web app was retired — see git history if you need them.

---

## 2026-08-03 — Storybook Ronin Rive preparation checkpoint

### Rive editor state

- Rive desktop project `2479241` is connected through the local Rive MCP server.
- Artboard `0-2` is named `Journey Ronin Side Prep`.
- Clean imported source `0-4814` is named `RONIN_SIDE_SOURCE`, centred at the original source position, and selected for the next rigging phase.
- Its hierarchy is labelled as source geometry (`RONIN_SIDE_ART`, `ILLUSTRATION_SOURCE`, `CHARACTER_RIG_WRAPPER_SOURCE`, `RONIN_AND_CAT_SOURCE`, and the broad body/accessory source groups).
- The cat remains visible but is explicitly labelled `CAT_SOURCE_UNRIGGED`; it must not be included in the first Ronin skeleton.
- The previous damaged duplicate `0-17` is hidden at 0% opacity and named `OLD_CORRUPTED_SOURCE_HIDDEN_DO_NOT_USE`.
- Empty bone `0-4813` is named `UNUSED_EMPTY_ROOT_BONE`; it can be reused as the production Ronin root after the skeleton proposal is approved.

### Findings and verification

- The clean import was verified to contain the full named `CAT` subtree and all broad Ronin source groups.
- Cat removal is blocked at the vector-source level: a large continuous outline path is shared by the Ronin and cat, so deleting the named CAT group leaves a black cat silhouette while hiding the shared path also damages the Ronin. Leave the cat intact until Illustrator geometry is split.
- The current SVG buckets are broad source groups rather than animation-ready anatomical parts. Rigging should begin with a conservative FK skeleton and bind only geometry that can be assigned unambiguously.
- Diagnostic evidence is stored in `apps/mobile/assets/ronin/for-rive/ronin-side-rive-prep-v1.audit.md` and `.audit.json`. The `-BLOCKED.svg` derivative is diagnostic only and must not replace the clean import.

### Immediate next step

- Approve the Ronin-only skeleton proposal, then create bones in Rive Design mode, verify their hierarchy through MCP, and bind/auto-weight each unambiguous vector group one operation at a time. Keep the cat static and unbound.
# 2026-08-03 — Ronin Rive coarse layer import pack

- Added `tools/build-ronin-rive-layer-pack.mjs` and generated `apps/mobile/assets/ronin/for-rive/side-layer-pack-v1/` from the preserved side-view SVG.
- The pack contains independently importable cat, legs/boots, hair/headband, torso/sash, face/front-hand, backpack, and back-hand/sword SVGs plus a manifest with Rive target names and import order.
- Verified all seven generated SVGs are well-formed with `xmllint`; the pack contains 319 retained paths in total.
- This supports independent rigid transforms in Rive. Mesh deformation remains blocked where the original traced artwork shares contours or fuses upper/lower limb geometry; those contours must be redrawn before weighting.
- Next: import the seven files into the `Journey` artboard in manifest order, rename them to the supplied Rive names, establish pivots/bones, and keep deformation disabled until the shared-contour redraw.

## 2026-08-03 — Ronin raster modular rig candidate

- Added `apps/mobile/assets/ronin/for-rive/raster-modular-v1/` as a faster raster alternative to redrawing the fused Illustrator contours.
- Generated identity-preserving chroma-key sheets from the canonical v3 side reference, then extracted 23 transparent PNG candidates covering the torso, head/hair/headband, backpack, sword/scabbard, sash, both three-part arms, and both three-part legs.
- Added `manifest.json` with back-to-front import order, anatomical groupings, recommended pivots, and explicit limitations; added `README.md` with Rive assembly acceptance checks.
- Verified every part has an alpha channel and transparent corners. Applied a one-pixel alpha contraction to reduce residual green antialiasing.
- This is an assembly candidate, not a production-approved replacement. The torso includes concealed hip stubs, the generated head still contains some hair/headband pixels, several core-sheet crops need seam/fringe review, and the first Rive assembly must confirm scale, draw order, and joint overlap at runtime size.
- No runtime code or active `.riv` asset was changed. Next: assemble only the core plus arm/leg pieces in a scratch Rive artboard, reject visibly mismatched candidates, repaint seams, then replace the current coarse SVG rig only after side-by-side approval.
- Cleaned all 23 candidates by retaining the principal connected silhouette, contracting the alpha matte, trimming empty margins, and despilling green edge pixels. Regenerated `contact-sheet.png` from the cleaned parts.
- Added `assembly-guide.png`/`.svg` with the proposed Ronin bone chains and joint pivots, plus `generation-prompts.md` so the built-in generation brief is reproducible.
- Revalidated the manifest JSON and confirmed every part remains non-opaque with an alpha channel. The next hands-on step is importing these PNGs into a scratch Rive artboard in manifest order and tuning overlap at the yellow guide pivots.
- Rive desktop assembly started after the user imported all 23 PNGs into Assets. Instantiated and visually aligned `torso-hips`, `head-face`, `front-hair`, `waist-sash`, `front-thigh`, `rear-thigh`, and `rear-shin` over the existing side character at 50.6% editor zoom.
- Instantiated `front-boot` near the ankle as a provisional placement; its final scale/seam must be tuned after `front-shin` is placed. The new raster objects are still root-level artboard children and have not yet been parented to `Side_Root` or bound to bones.
- Next Rive steps: place front shin and both boots, then arms/backpack/rear hair/accessories; validate draw order; parent the complete modular set beneath `Side_Root`; only then set joint origins and build the new limb bone chains.
- Fifteen-minute continuation: added and aligned the generated backpack and front forearm, scaled the forearm and set its transform rotation to 45 degrees. The visible raster reconstruction now covers the head/hair, torso/sash, backpack, both thighs, rear lower leg, provisional front boot and front forearm over the original reference.
- Grouped the placed modular raster objects into a root-level `Group` so they can be treated as one preserved-world assembly. A test reparent of the boot under the transformed `Side_Root` changed its world transform, so it was immediately undone; do not parent these pieces directly without first converting world coordinates to the parent's local space.
- No reliable raster-group animation track was added: a manual Y-key attempt entered Design mode, so the group was restored to its neutral Y value of 617.5. Existing `Side_Idle` and `Timeline 1`/Side_Root keys remain the only verified animations.
- Remaining production work: finish front shin/rear boot and full arm pieces, fix the visibly vertical forearm/hand seam as needed, add rear hair/headband/weapon layers, give the raster assembly a zero-transform parent or compensated local transforms, then animate that parent and establish actual limb pivots/bones.
- Ten-minute raster-only cleanup: hid the old `Side_Root` SVG Ronin non-destructively; verified that the separate cat remains visible. This exposes the true modular raster silhouette without duplicate hair, face, torso, limbs or sash.
- Moved the generated backpack inward so it reconnects with the raster torso. Added the generated sword as a root-level raster object, reduced its width and attempted grip alignment; its current vertical/ground-reaching placement is provisional and still needs uniform scale plus final rotation.
- The raster-only character is now visibly readable, but missing upper/lower arm coverage and incomplete boot/shin pieces are no longer masked by the SVG. Prioritize those missing anatomy pieces before animation or export.

## 2026-08-03 — Fresh Rive raster assembly retry

- Rebuilt the modular Ronin in the user's new untitled Rive file after all 23 cleaned PNG rasters had been re-added and instantiated.
- Used `torso-hips` as the fixed visual anchor, then brought the head/hair, waist sash, backpack, both arm chains and hands, both leg chains and boots, sword, scabbard, and headband elements into one readable standing silhouette.
- The current Rive canvas now shows a complete static Ronin instead of scattered parts. The backpack is behind the torso; the sash covers the waist seam; hands, trousers, shins, and boots are connected; sword/scabbard are aligned at the front hand.
- No runtime `.riv` export or app code was changed. The Rive file is still untitled and the assembled rasters remain root-level objects.
- Next: save/name the Rive source, establish a zero-transform `Ronin_Root`, preserve world transforms while parenting parts into anatomical groups, set joint origins, and test a small idle pose before creating a walk cycle.

## 2026-08-03 — Artwork-first approach retired; clean skeleton started

- The distorted raster assembly was rejected. Its failure was caused by independently generated tight crops with inconsistent anatomical scale and overlap geometry.
- The user cleared the Rive file, and a new artwork-independent neutral skeleton was created directly in the empty artboard.
- Current scaffold contains one central pelvis-to-head spine, two two-segment arm chains, two two-segment leg chains, a separate head bone, two hand bones, and two foot bones. It is visually centred and proportioned as a compact side-character puppet.
- All chains are currently root-level and retain Rive's default `Root Bone` names. No artwork, binding, animation, or runtime export has been added yet.
- Next: name bones by anatomical role, parent the head/limb roots under the correct spine or pelvis joints while preserving world transforms, then create simple capsule placeholders to validate Idle and Walk before drawing replacement vectors.

## 2026-08-03 — Skeleton naming and idle setup

- Named the visible skeleton controls in the clean Rive file: `Rig_Root`, `Spine_Tip`, `Head`, `Arm_Front`, `Forearm_Front`, `Hand_Front`, `Arm_Rear`, `Forearm_Rear`, `Hand_Rear`, `Leg_Front`, `Shin_Front`, `Foot_Front`, `Leg_Rear`, `Shin_Rear`, and `Foot_Rear`.
- Confirmed the arm and leg segment children are genuine bone-chain children in the Rive hierarchy. The separate head, hands, feet and limb roots remain root-level controls pending final parenting.
- Existing `Timeline 1` now contains a verified 60-frame root-position idle: neutral at frame 0, a raised midpoint at frame 32, and a return key at frame 60.
- Playback was tested with Space. The stage becomes blank during playback because Rive's final-playback view hides bones and no artwork has been attached yet; the playhead advances correctly.
- Existing `State Machine 1` retains the Entry-to-`Timeline 1` connection. Next: parent the root-level controls under `Rig_Root` with preserved transforms, add capsule/vector placeholders as bone children, then visually validate the idle and build the first walk pose.

## 2026-08-03 — Claude computer-control handoff prepared

- Stopped further Rive editing at the user's request and documented the exact current skeleton, hierarchy limitations, idle timeline state, locked chibi proportions, canonical/rejected references, and safe continuation sequence.
- Full handoff: `docs/plans/2026-08-03-ronin-rive-claude-handoff.md`.
- The last attempted built-in Rive Agent prompt was interrupted before submission; do not assume any agent-created placeholder shapes exist.
- One zero-sized root-level `Ellipse` may remain from a failed manual placeholder test. It is not part of the skeleton and can be explicitly selected and removed.
- No runtime code or `.riv` asset was changed during this handoff preparation.

## 2026-08-04 — Rive placeholder progress audit

- Read-only inspection confirmed that a visible large head ellipse, short torso and rounded arm placeholders have been added around the named skeleton.
- The current mannequin is compact but front-facing rather than the locked side-on Ronin silhouette. Legs, hands and large rounded feet are not visibly complete.
- Shapes remain root-level artboard children (`Ellipse`, `Rectangle`, `Rectangle 2`–`Rectangle 5`) rather than named bone children.
- `Timeline 1` still contains only the `Rig_Root` track with keys at frames 0, 32 and 60. Because the placeholder shapes are not parented or keyed, visible animation has not yet been proven.
- Updated `docs/plans/2026-08-03-ronin-rive-claude-handoff.md` with the observed state and revised next steps. No Rive edits, runtime code changes or asset exports were made in this audit.

## 2026-08-04 — Rive placeholder silhouette continuation

- Continued manually in the open untitled Rive source after its built-in Agent hit quota (`429`) without making changes.
- Renamed the existing head, torso, pelvis and arm shapes to `Placeholder_*` anatomical names.
- Added named front/rear leg and large flat front/rear foot placeholders, completing a visible full-body mannequin for structural testing.
- Tested hierarchy dragging once. The attempt targeted the `Head` bone rather than the head artwork and temporarily parented it under `Leg_Front`; the change was immediately undone and the original bone hierarchy was visually rechecked.
- Removed the accidental text layer created while establishing reliable keyboard shortcuts. No app runtime files or `.riv` exports were changed.
- Verified remaining blocker: placeholders are still root-level and the silhouette remains frontal. Next session should reshape it side-on, then parent exactly one named placeholder at a time with an indentation/world-position check after every drag before testing `Timeline 1`.

## 2026-08-04 — Rive placeholder naming audit

- Verified the user-parented head, upper-leg, torso/pelvis and arm placeholder hierarchy in the saved `Ronin Rig 1` Rive source.
- Identified and renamed the four remaining root-level shapes by their actual canvas geometry: `Placeholder_Shin_Front`, `Placeholder_Shin_Rear`, `Placeholder_Foot_Front`, and `Placeholder_Foot_Rear`.
- Corrected the rear-arm labels: the upper segment is now `Placeholder_Arm_Rear` and the child of `Forearm_Rear` is now `Placeholder_Forearm_Rear`.
- The shin and foot shapes are visually aligned but remain root-level. The rear forearm is parented but crosses the torso and needs its local transform corrected. No dedicated hand artwork exists yet.
- Next: parent the named shin/foot shapes one at a time while preserving world position, correct the rear forearm neutral pose, add simple hand shapes, and only then validate `Timeline 1` playback.
- Follow-up: the user added two hand circles. They were verified by canvas position and renamed `Placeholder_Hand_Front` (right/front side) and `Placeholder_Hand_Rear` (left/rear side). Both remain root-level pending safe parenting to `Hand_Front` and `Hand_Rear`.
- Arm hierarchy names are now internally consistent: each `Arm_*` owns its upper-arm placeholder and `Forearm_*` chain; each forearm owns its matching `Placeholder_Forearm_*`. Front arm placement reads correctly. Rear arm endpoints meet the rear hand, but its forearm remains too far inward/partly across the torso and needs a neutral-pose adjustment.

## 2026-08-04 — Positional naming audit exposed hierarchy corruption

- Audited placeholders from their visible canvas geometry rather than trusting their current bone parents.
- Verified and retained explicit names for head, torso, front/rear hands, front/rear shins and front/rear feet. Renamed visible upper-leg geometry to `Placeholder_Thigh_Front` / `Placeholder_Thigh_Rear` and restored the central body shape to `Placeholder_Torso`.
- Found that several previously parented shapes do not match their parent bones: a visible thigh is beneath `Arm_Rear`, a forearm-labelled object is beneath a leg chain, and the shape previously labelled `Placeholder_Pelvis` is visibly a left/rear arm capsule. That capsule is now named `Placeholder_Arm_Rear_Combined` based on its actual silhouette.
- The hierarchy can no longer be considered animation-safe merely because labels look anatomical. Do not add walk keys yet. Next: detach the mismatched shapes while preserving world transforms, assign each visible shape to a clean root-level anatomical inventory, then reparent one verified object at a time.
- Attempted the safe-detach workflow in both Animate and Design modes. The Animate-mode attempt was cancelled before deletion; the file was restored. In Design mode, cut/paste to Artboard changed the pasted object's world transform and moved it off-canvas, so both operations were undone. The visible mannequin and original thigh were restored.
- Direct hierarchy dragging also proved unreliable through computer control: the intended thigh row resolved to `Hand_Rear`. Do not continue bulk hierarchy mutation through coordinate automation. The current safe state is Design mode with the mannequin visually intact; use direct manual hierarchy dragging or Rive's own object API with explicit IDs for the next structural pass.

## 2026-08-04 — Shapes flattened to Artboard

- User manually moved all artwork shapes back to direct Artboard children. Verified that the bone chains no longer contain placeholder-shape children, removing the earlier hierarchy ambiguity.
- Current root-level visible inventory includes head, torso, front/rear thighs, front upper arm, multiple forearm candidates and a combined rear-arm capsule. Bone handles still provide the apparent lower legs, feet and hand circles; those are not independent artwork shapes.
- Attempted to create actual hand ellipses through computer control, but the editor unexpectedly changed from 34% to 5% zoom and produced zero-length ellipse objects. They are named `Placeholder_Hand_Front` / `Placeholder_Hand_Rear` but must be redrawn at normal zoom before parenting.
- Do not rebuild bone parenting until the missing hand, shin and foot artwork shapes exist and the duplicate `Placeholder_Forearm_Front` candidates are visually resolved.
## 2026-08-07 — Ronin raster modular v2 A-pose pack

- Added `apps/mobile/assets/ronin/for-rive/raster-modular-v2/` with chroma-source sheets, transparent isolated parts, an assembled alignment reference, `manifest.json`, and `README.md`.
- The pack follows the explicit requested names: one continuous arm per side (shoulder→wrist), one continuous trouser leg per side (hip→ankle), separate hands and boots, and no segmented limb or joint-patch tiles.
- The user’s headline count says 17 while the named list totals 18; this is recorded in the manifest without silently omitting a named piece.
- No runtime `.riv` asset or app component was changed. Next step is importing these transparent parts into a Rive authoring artboard and binding the listed assembly order.

## 2026-08-07 — Ronin v2 replacement core sheet

- Added `source/core-replacements-green.png` and transparent replacements for a sleeveless torso, shorts-only pelvis, and matched flat non-directional boots under `raster-modular-v2/replacements/`.
- Existing v2 parts remain intact; these are intended as drop-in replacements during Rive assembly.

## 2026-08-10 — Ronin production asset sheet 01

- Added `apps/mobile/assets/ronin/production-asset-sheet-01-core-body-geometry.png`, a high-resolution transparent PNG disassembly sheet containing exactly 15 front-facing core body components: neck, torso, pelvis, paired arm/sleeve pieces, paired wrapped forearms, paired hands, paired upper/lower trouser pieces, and paired boots.
- Added the flat chroma-key source as `production-asset-sheet-01-core-body-geometry-chroma.png` for reproducibility; the production deliverable is the alpha PNG.
- The sheet was generated from the supplied front-facing storybook Ronin reference and visually checked for separated pieces, restrained vector-friendly texture, hidden joint construction, and no head, sash, accessories, alternate pose, or assembled character.
- No runtime code, Rive file, schema, or component structure was changed. Next: import the transparent parts into the Rive authoring file and validate scale, pivots, overlap and mesh deformation against the existing skeleton.
# 2026-08-10 — Progression UI and custom identity system

- Added a custom, small-size vector identity for all eight canonical Domains (`DomainIcons.tsx` + tested `domainIconKey.ts`). The bonsai is now reserved for Overall Potential/fallback; Health uses an open hand with a leaf and Fitness uses a simplified bicep.
- Standardised Missions on one scalable target mark across lists, detail/context surfaces, calendar and creation; the Missions list no longer renders per-project emoji artwork.
- Added title-aware custom Skill identities and human-readable proficiency stages; expanded Skill cards to a calmer two-column layout and added the Skill identity to its detail summary.
- Separated Me from the full Potential screen: Me keeps the compact Harada balance summary, Focus, weekly guidance and recent achievement; Potential retains the full Domain detail and expandable Harada view.
- Constrained Domain Detail artwork to 220pt, added its Domain icon, improved fixed-Domain title wrapping, and replaced the empty Achievements page with a compact trophy-collection state.
- Verification: the 5 new icon/proficiency tests pass; the iOS Expo export completes; `git diff --check` passes. The full suite is 237/238 with only the pre-existing deleted Rive-manifest test failing. Full TypeScript remains blocked by pre-existing active-worktree errors in missing desktop-web modules and `database.ts`'s `"skill"` contribution type.

# 2026-08-10 — Cold-start lag investigation

- Reproduced the pasted Metro warning outside Expo with a minimal Babel transform: `@tamagui/babel-plugin` loads Tamagui's static extractor, which requires `@tamagui/core/dist/native.cjs`; that in turn requires React Native's untranspiled Pressability internals under Node 24 and throws `Unexpected token '{'`.
- Removed the optional Tamagui Babel extractor from `apps/mobile/babel.config.js`; runtime Tamagui remains provided by `TamaguiProvider`, and Reanimated stays last in the Babel plugin list.
- Added dev-only startup timing in `apps/mobile/src/db/database.ts` for `SQLite.openDatabaseSync`, `initSchema`, `migratePotentialStats`, and total `getDb` cold init so the next device launch reports whether synchronous SQLite boot is the remaining freeze source.
- Ran Metro with `npx expo start --dev-client --port 8082 --clear` and opened the app on-device. The cleared-cache bundle was slow (~99.7s, expected with `--clear`), but the Tamagui warning storm was gone. SQLite cold init was not the freeze: `SQLite.openDatabaseSync` ~8ms, `initSchema` ~12ms, total `getDb cold init` ~21ms.
- The actual remaining startup hitches were post-launch full-table/large sync work: automatic AppState background backup serialized `SELECT * FROM items` and `SELECT * FROM activityLogs` (activity logs ~48-54ms) and then failed with `[backup] background push failed [FirebaseError: Missing or insufficient permissions.]`; first Firestore sync chunks still produced back-to-back `withTransactionSync` blocks (~16-29ms).
- Removed the automatic AppState background backup from `App.tsx`. Manual Settings backup remains. Realtime Firestore sync is the live cross-device path; full snapshot backup should not serialize the whole SQLite DB during background/cold-start transitions.
- Tightened Firestore first-snapshot apply chunks from 100 -> 25 docs and deferred local-only reconciliation scans by 10s. The reconciliation scan now reads only `id`/`updatedAt` first and fetches full rows only if a local-only row actually needs pushing.
- Added `activityLogs(actionType, timestamp DESC)` and `activityLogs(entityId, actionType, timestamp DESC)` indexes for medication timer/recent-log startup queries. `SCHEMA.md`, `CLAUDE.md`, and `AGENTS.md` were updated with the performance/backup/index contract.
- Verification during hot reload: backup full-table `activityLogs` scan disappeared; no new `[backup] background push failed`; remaining startup warnings dropped to small sync chunks around 17ms and one indexed medication query. The one-time index creation bumped `initSchema` to ~33ms once, then quieted.
- Follow-up after the user still felt lag on clean cold reopen: Home was still preloading **all** secondary tabs (`Upcoming`, `Anytime`, `Someday`, `Logbook`) plus Potential on first mount even though the initial view is Today. Fixed by lazy-loading only the selected secondary tab, replacing `getItemsByType('task')` + JS filters with indexed `getAnytimeTaskItems`/`getSomedayTaskItems`, indexing the Logbook order (`status, deletedAt, completedAt DESC, updatedAt DESC`), and deferring the initial Potential/focus summary through `InteractionManager.runAfterInteractions`.
- App-wide follow-up scan found the same hidden-tab shape in two other places and one broad task scan in an interactive flow. `HomeScreenExperimental` now matches Home's lazy secondary-list behavior and skips its duplicate mount refreshes; `TasksScreen` no longer hydrates completed Logbook rows while the Tasks segment is active; `useTasks`/Daily Check-In suggestions now use indexed `getActiveTaskItems()` instead of fetching all task rows and filtering in JS.
- `npm test` remains blocked by the pre-existing deleted Ronin manifest fixture, and `npm run typecheck` remains blocked by pre-existing desktop-web module resolution errors plus the existing `"skill"` contribution type mismatch.

# 2026-08-11 — Ronin mountain-home Illustrator organisation and SVG export

- Preserved the organised Illustrator state as `Illustrator Documents/26-organized-scene.ai`, leaving the older saved `26.ai` untouched. The new source has a visible `SCENE_EXPORT_2340x1080` layer and a locked, hidden `ASSET_LIBRARY_HIDDEN` layer; off-artboard source groups and placed/raster references remain recoverable rather than being deleted.
- Renamed previously unnamed top-level scene and library objects with stable indexed identifiers while preserving existing internal Ronin part names and the assembled scene positions.
- Added `apps/mobile/ronin-artwork/exports/ronin-mountain-home-scene.svg`, exported at the Rive-matched 2340×1080 canvas with presentation attributes and a normalised SVG coordinate origin.
- Removed linked/raster content, hidden library artwork and Illustrator-only editability metadata from the deliverable; final SVG size is approximately 604 KB.
- Verification: rendered the local SVG in headless Chrome at 1170×540 and confirmed the sunset gradient, mountains, deck layers, Ronin and visible scene props retain the intended composition and stacking. Re-opened/audited the saved organised AI source: 2340×1080, two expected layers, 23 visible scene roots, 59 hidden library roots and 3,271 total Illustrator objects. The Rive file and runtime code remain unchanged.
- Next: provide Claude the scene SVG for inspection/import planning; import the Ronin geometry incrementally according to `RONIN_RESKIN_PLAN.md`, keeping environment artwork separate from the character rig where practical.

# 2026-08-12 — Ronin rigid-art draw-order recovery

- Diagnosed the missing face/hair/boots and apparently detached hands as a Rive hierarchy/draw-order regression: rigid artwork parented under the rebuilt root-bone tree was being occluded by the imported scene/character stack.
- Restored hands, boots and head artwork to the character's visual stack; hands are confirmed single-bone weighted to their hand bones. Boot and head-detail single-bone binding is in progress/being verified rather than relying on hierarchy parenting.
- Reconstructed the head draw order so the head base sits behind facial components, rear hair sits behind the head, and front hair remains on top. Restored the actual bright bandana and skin-tone ear detail shapes; changed the broad bandana base to rust red `#a9321b`.
- No rollback geometry was deleted. Walk authoring remains held until the complete idle/rig visual validation and leg IK/toe symmetry work are complete.
# 2026-08-12 — Ronin head-v2 live Rive attachment

- Audited the newly imported vector head in the open `RONIN RIG 1` artboard through the live Rive MCP.
- Confirmed one root assembly with eight direct visual children: hair/ears/bandana, neutral L/R eyes, nose,
  mouth, L/R brows, and skin base.
- Renamed the root to `head-v2-visual-assembly` (`1-177493`) and the generated mouth name to `mouth-neutral`
  (`1-182572`).
- Rigidly parented the complete head assembly to `bone-head` (`1-168972`) while preserving world placement;
  internal facial draw order was left untouched.
- Found that the old `head-visual-assembly` (`1-128131`) had not actually been removed and remained visible at
  100%; hid the complete old assembly at 0% non-destructively. Its artwork remains recoverable.
- Restored the head bone to its exact neutral rotation (`-0.9786318661156178°`).
- Updated `apps/mobile/RONIN_RIVE.md` with the replacement IDs and explicitly retired the removed old head stack.
- Verification remaining: inspect rendered idle and a controlled head rotation for draw-order correctness before
  facial-expression authoring; then finish body deformation validation and rebuild leg IK before walk animation.

## Follow-up — visible re-import and first walk pass

- The user re-imported the head after the earlier copy remained invisible. Audited the newest root as
  `1-188856`, including the previously omitted `neck-v2-base` child.
- Renamed it `head-v2-visual-assembly`, rigidly parented it to `bone-head`, sent the whole pelvis/skeleton branch
  to the artboard front, and hid both older head assemblies at 0% without deleting them.
- Found and removed three accidental frame-35 idle transform keys that moved the new head far off-canvas, plus
  two accidental frame-35 pelvis sampling keys. The intended idle keys remain.
- Authored the first 60-frame front-facing `walk` pass: 60 cubic keys, 12 skeleton objects, no artwork keyed.
  It includes pelvis bounce, torso/head stabilization, alternating thigh/knee motion, foot roll, R-toe motion,
  and counter-swinging arms.
- True planted-foot IK is still blocked by absent IK constraints, missing L toe, and no exposed safe constraint
  creation command in the live MCP. The authored walk is a visual locomotion prototype pending rendered review,
  not final foot-plant locomotion.

## Follow-up — head placement and retained-leg path audit

- Diagnosed the newest head root (`1-188856`) at artboard `(0,0)` after the user re-added it. Restored its known
  stage transform (x=1130.34, y=760.11, r=-90.455°, opacity 100). It is visible at the artboard root but still
  needs a final draw-order-safe head-bone-follow solution and rendered validation.
- Re-derived every live `PointsPath` from the retained leg groups instead of relying on stale Illustrator/Rive
  shape IDs. Confirmed 53/53 leg-base, trouser and shinband paths carry the intended same-side bone chains.
- Found `boot-R` partially cross-bound: one path used R-foot while fifteen used L-foot. Rebound and jointly
  rigid-weighted all 16 right-boot paths to `bone-R-foot`; boot-L remains correctly L-foot bound.
- No artwork or rollback geometry was deleted. Walk refinement remains held for controlled assembled-leg and
  head-follow visual tests, then symmetric toe/IK work.

## Follow-up — complete coverage-geometry correction

- User-provided walk screenshots proved that the retained-group audit was too narrow: concealed reconstruction
  shapes were remaining at their neutral positions while the rigged top artwork moved.
- Full live traversal found 51 currently visible, unbound paths across complete tunic underlayers, body coverage,
  sleeve details, lower tunic, legacy hand bases and legacy trouser/cuff groups. These are now explicitly
  unclassified coverage candidates; none should be retired merely because it looks redundant in neutral pose.
- Confirmed the deliberate sleeve deep roots are correctly skinned (5 right, 3 left).
- Removed three erroneous direct artwork keys (x/y/rotation at walk frame 4) from the artboard-root head-v2
  assembly. The head needs a draw-order-safe bone-follow solution before walk playback resumes.
- No coverage artwork was deleted or hidden in this correction. Next work must classify one region at a time
  through isolation plus extreme-joint deformation, then bind required coverage or hide proven duplicates.

## Follow-up — full Ronin rig coverage audit through step 8

- Completed the region-by-region live hierarchy/binding audit before resuming animation work.
- Classified the 51 previously ambiguous unbound paths. Old hand silhouettes, legacy trouser/cuff groups,
  flattened REVIEW composites/details, fragmented complete-tunic groups and the old lower-tunic path are retained
  as rollback geometry at 0% opacity rather than deleted or allowed to remain as stationary visible fragments.
- Kept the canonical visible clothing plus continuous torso, pelvis, arm and leg structural bases and deep sleeve
  roots. Confirmed the current arms, hands, legs, trousers, cuffs, boots, torso, pelvis and sash have their intended
  bone-follow strategy.
- Reparented newest `head-v2-visual-assembly` (`1-188856`) under `bone-head` while preserving its stage position;
  all face/hair/ears/bandana/skin/neck children now share the head transform. Earlier head stacks remain hidden and
  recoverable. Direct artwork keys were removed from `walk` so only the head bone drives it.
- Exercised extreme head/shoulder/elbow/hip/knee/ankle rotations with rollback-only geometry hidden, then restored
  every tested bone to its recorded neutral value.
- Step 8 is reached: animation work may resume. The existing walk is still a prototype; genuine foot planting is
  blocked on symmetric left-toe topology and creation of foot-target/IK constraints, so that is the next animation
  engineering task rather than further keyframe polish on the current non-IK cycle.

## Follow-up — live head, hand and draw-order correction

- Reopened the step-8 verdict after playback showed the head displaced/rotated, its face absent, a visible hand
  left behind and brown coverage geometry drawing over clothing.
- Removed three remaining accidental direct `walk` frame-57 transform keys from head-v2 and restored its proven
  local transform under `bone-head`. Reordered head children so neck/skin sit behind the face and the combined
  hair/ears/bandana overlay sits foremost.
- Removed accidental direct `walk` frame-3 transform keys from both visible hands and rigidly reparented them to
  their corresponding hand bones.
- Re-established the intended visual stack: structural torso/pelvis/arm bases and sleeve roots behind; canonical
  tunic, sleeves, trousers, cuffs, sash, wraps and boots in front. Rollback-only artwork remains recoverable at
  0%; no artwork or paths were deleted.

## Follow-up — neutral-construction audit reopened

- Rechecked the live artboard after the user removed the visible state work. `State Machine 1` and all ten linear
  animations are still present in the active file, and the editor remains in an evaluated state-machine preview.
  Consequently, structural transform writes can appear to snap back and the visible canvas is not a reliable
  neutral-pose reference.
- Completed a path-by-path Skin scan of the canonical arm bases, sleeves, deep sleeve roots, wraps, leg bases,
  trousers, cuffs, tunic and neck. All canonical deforming paths are bound; both visible hands remain rigid children
  of their hand bones. The problem is therefore not a wholesale absence of Skin on retained artwork.
- Reasserted visual draw order with structural torso/pelvis/arm/leg bases and deep roots behind the visible tunic,
  sleeves, trousers, cuffs, wraps and sash. Rollback-only geometry remains hidden and recoverable; nothing was
  deleted.
- Revoked the earlier step-7/step-8 animation-readiness verdict because the newest head remains displaced/ghosted in
  the evaluated preview. Next work must first enter a genuinely neutral Design canvas, lock the head assembly's
  neutral transform, and perform clean artwork-only deformation captures before any walk or IK authoring.

# 2026-08-12 — Tier 2 custom icon production batch

- Created production-ready transparent PNG assets under `apps/mobile/assets/icons/domains/` using the approved Tier 2
  soft sculpted object language and the Medication bottle as the quality benchmark.
- Domain icons added: Health & Wellbeing anatomical heart, Finance stacked coins, Career briefcase, Fitness &
  Performance simplified brown/orange bicep with red wrist wrap, Discipline target, Growth sprout, Creativity thin
  paintbrush, Relationships interlocking rings.
- Collection/navigation icons added: Skills skill tree, Missions mountain, Routines stone ring, Tasks clipboard,
  Workouts dumbbell, Habits red repeat arrows, To Get shopping trolley.
- Saved individual large keyed source renders in `apps/mobile/assets/icons/domains/source/`; contact sheets saved as
  `domain-icons-contact-sheet.jpg` and `collection-navigation-icons-contact-sheet.jpg` for visual QA only.
- Verification: every final PNG is RGBA `1254x1254`, has transparent corners, was trimmed to visible artwork, then
  normalized back to the standard square canvas with approximately `1050px` active artwork while preserving aspect
  ratio. No runtime component wiring was changed in this pass.
- Next steps: decide whether these new collection/navigation assets should replace the currently wired
  `apps/mobile/assets/icons/collections/` artwork and, if so, update `CollectionIcons.tsx`/web navigation artwork in a
  separate wiring pass with visual smoke tests.

## Follow-up — native regenerated semantic icon refinements

- Regenerated the semantic refinements as individual native image-generation passes, rather than relying on painted
  overlays on the previous masters.
- Regenerated and normalized: Health with integrated cream ECG line, Discipline wrapped mala, Creativity with one red
  paint stroke, Relationships with compact handshake above interlocking rings, Habits repeat arrows with integrated
  cord/bead, Skills tree with clearer connected nodes and distinct leaf/trunk greens, Tasks clipboard with stronger
  three-row checklist, To Get silver trolley, Workouts red-plate/black-handle dumbbell, Missions mountain/cloud
  arrangement, and Routines stone ring with more intentional red bindings.
- Unchanged-approved assets retained: Finance coins, Career briefcase, Fitness & Performance bicep and Growth sprout.
- Saved regenerated keyed sources as `apps/mobile/assets/icons/domains/source/*-native-regenerated-source.png`; previous
  finals are preserved as `source/*-before-native-regeneration.png` where replaced.
- Verification: regenerated `tier2-icons-native-regenerated-contact-sheet.jpg`; every final checked icon remains RGBA
  `1254x1254` with transparent corners and no baked background.

## Follow-up — Creativity brush reference replacement

- Regenerated only `creativity-thin-paintbrush.png` using the user-provided chunky painter's brush reference: dark
  navy/charcoal rounded handle, brass ferrule/end cap, red bristles and broad red paint swooshes.
- Kept the icon in the same Tier 2 smooth sculpted object language and preserved the production pipeline: chroma-key
  source, clean alpha, trim, and normalized `1254x1254` transparent PNG with approximately `1050px` active artwork.
- Saved provenance as `source/creativity-thin-paintbrush-reference-brush-source.png` and preserved the prior final as
  `source/creativity-thin-paintbrush-before-reference-brush-regeneration.png`.
- Verification: refreshed `tier2-icons-native-regenerated-contact-sheet.jpg`; all checked finals still have transparent
  corners and no baked background.

## Follow-up — Health two-colour reference replacement

- Regenerated only `health-wellbeing-heart.png` using the user-provided reference's simplified colour hierarchy:
  warm red heart body with warm cream/off-white vessels and ECG line.
- Kept it as a standalone transparent Tier 2 object, not the reference card/text treatment.
- Saved provenance as `source/health-wellbeing-heart-two-color-reference-source.png` and preserved the prior final as
  `source/health-wellbeing-heart-before-two-color-reference-regeneration.png`.
- Verification: refreshed `tier2-icons-native-regenerated-contact-sheet.jpg`; all checked finals remain RGBA
  `1254x1254` with transparent corners.

## Follow-up — Habits charm reference replacement

- Regenerated only `collection-habits-repeat.png` using the user-provided red repeat-arrow charm reference: dominant red
  repeat form, left-side red cord wrap, cream/brass bead charm with spiral bead and hanging red tassel.
- Saved provenance as `source/collection-habits-repeat-charm-reference-source.png` and preserved the prior final as
  `source/collection-habits-repeat-before-charm-reference-regeneration.png`.
- Verification: refreshed `tier2-icons-native-regenerated-contact-sheet.jpg`; all checked finals remain RGBA
  `1254x1254` with transparent corners.

## Follow-up — Relationships diagonal red/blue rings replacement

- Regenerated only `relationships-interlocking-rings.png` as diagonal interlocking rings with one muted red ring, one
  muted blue ring, and a compact central handshake at the overlap.
- Saved provenance as `source/relationships-interlocking-rings-diagonal-red-blue-handshake-source.png` and preserved the
  prior final as `source/relationships-interlocking-rings-before-diagonal-red-blue-handshake-regeneration.png`.
- Verification: refreshed `tier2-icons-native-regenerated-contact-sheet.jpg`; all checked finals remain RGBA
  `1254x1254` with transparent corners.

## Follow-up — Routines open stone-loop reference replacement

- Regenerated only `collection-routines-stone-ring.png` using the user-provided open standing stone loop reference:
  dark charcoal open loop, central balanced stone stack, mossy base and restrained red wraps at top/base.
- Saved provenance as `source/collection-routines-stone-ring-open-loop-reference-source.png` and preserved the prior
  final as `source/collection-routines-stone-ring-before-open-loop-reference-regeneration.png`.
- Verification: refreshed `tier2-icons-native-regenerated-contact-sheet.jpg`; all checked finals remain RGBA
  `1254x1254` with transparent corners.

## Follow-up — Archive and muscle-group icon staging

- Generated and normalized the Archive storage-box icon as `apps/mobile/assets/icons/domains/collection-archive-storage-box.png`
  with keyed source and QA sheet saved alongside the domain icon sources.
- Created new staged muscle-group asset families under `apps/mobile/assets/icons/muscle-groups/`: `3d/` for the
  sculpted mannequin icons and `gold/` for the tiny simplified yellow/gold pictograms.
- Added ten 3D mannequin PNGs: chest, back, shoulders, arms, core, legs, hamstrings, glutes, calves and full-body.
  The 3D finals are transparent `1254x1254` PNGs with roughly `1050px` active artwork.
- Added ten matching gold pictogram PNGs with the same semantic names. These are also transparent `1254x1254` PNGs,
  but intentionally use smaller active artwork for 16-32px UI legibility instead of filling the full icon bounds.
- Saved raw source renders under `apps/mobile/assets/icons/muscle-groups/source/` and visual QA sheets as
  `muscle-groups-3d-contact-sheet.jpg` and `muscle-groups-gold-contact-sheet.jpg`.
- Verification: all staged muscle-group finals are RGBA `1254x1254`, have fully transparent corners, and no baked green
  or checkerboard background. No existing approved Domain/Collection icons were overwritten during muscle-group work.

## 2026-08-14 — Ronin clean rebuild black coverage repair

- Inspected the live `RONIN RIG CLEAN REBUILD` Rive document and proved that the apparent full-body
  black overlay is two intentional 99-vertex copies divided by upper/lower clip masks.
- Kept the upper source and both masks unchanged. Added both complete leg chains to lower source
  path `1-30887`, which had previously been weighted only to pelvis/spine/chest.
- A broad auto-weight exposed cross-leg stretching as a black wedge under a lifted foot. Tightened
  the lower-source solve to blend `0.08`, two influences, smoothing off; no geometry was deleted,
  hidden, reordered, or split.
- Verified through MCP that all 13 intended lower-body tendons now influence vertices. Immediate
  next step: inspect every walk extreme at high zoom; if any wedge remains, preserve the intact
  clipped sources and split the lower coverage into independent per-leg pieces before animation work.
- High-zoom user frames confirmed residual tunic-side tabs and a viewer-left boot wedge. A diagnostic
  duplicated centre-split was not retained: the copy landed at the artboard root with a mismatched
  transform basis and its leg tendons influenced no vertices. Temporary copies and copied skins were
  removed, the original clip bounds/names were restored, and the original lower path was rebound to
  all 13 tendons with the tight `0.08`/two-influence solve. No diagnostic copy remains live.
- A later retry using the updated sibling-preserving duplicate operation succeeded. The original
  lower node `1-30884` and copy `1-63780` are both under `RONIN-BODY-ART` `1-25996` with identical
  local and computed-world transforms. Copy path is `1-63783`; its independent clip source is
  `1-63999`/path `1-64001`, referenced by clipping component `1-63998`.
- Lower coverage is now split with a small centre overlap into anatomical-R and anatomical-L halves.
  Each path is bound only to pelvis/spine/chest plus its own complete leg chain and tightly weighted
  at `0.08`/two influences/smoothing off. All intended tendons have nonzero influence and neutral is
  unchanged. Frame-8 inspection still shows a same-side rear boot wedge and tunic-side tabs, so the
  next repair is vertical per-region segmentation using the now-proven sibling/independent-clip
  method. A one-influence diagnostic was reverted after producing zero-influence tendons.
- Began the proven vertical segmentation on anatomical-R. Independent ankle/boot and sole coverage
  bands now overlap by four local units and are rigidly bound to `bone-R-foot`; their source paths
  (`1-64225`, `1-64655`) were discovered unbound on reconnect and corrected, with all 99 vertices
  confirmed at weight 1.0. The 16 visible `boot-R` paths are also rigid foot-bound and neutral remains
  clean. Exact frames 8/15/45/52 were inspected at 277%; the large wedge improved, but frame 15 still
  exposes detached black fragments, so this remains an in-progress diagnostic and must not yet be
  mirrored or treated as production-proven.
- A non-destructive 0%-opacity test of all five black coverage nodes was visually checked in neutral
  and at walk frames 8/15/45/52. No major anatomy disappeared and the detached fragments vanished.
  All nodes were restored to 100% and Rive was returned to neutral Design mode. Current recommendation:
  perform one final high-zoom full-loop joint audit, then remove the monolithic silhouettes if clean;
  use small correctly coloured bone-local patches only for any proven micro-gaps.
