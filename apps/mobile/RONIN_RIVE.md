# Ronin Rive Rig — canonical reference

**This is the only Ronin/Rive document. Everything before 2026-08-08 has been deleted, not
superseded-in-place.** If you find a reference elsewhere in the repo to `RONIN_RIG_PARTS_BRIEF`,
`RONIN_STATE_MACHINE_DESIGN`, `RONIN_V3_GENERATION_SPEC`, `RONIN_HERO_BUILD_PLAN`,
`RIVE_AUTOMATION_PLAYBOOK`, `RONIN_RIVE_HANDOFF`, the `storybook-journey-rig` manifest, Rive cloud
file `2478489`, `rka_journey_rig.riv`, or any `ronin-*-v1/v2/v3/v4` art spec — that reference is
stale. Delete it. Do not reconstruct those plans.

The **new front-facing artwork replacement** is specified in
[`RONIN_PRODUCTION_ARTWORK_SPEC.md`](RONIN_PRODUCTION_ARTWORK_SPEC.md) — the canonical asset spec
governing PNG generation, vectorisation, and reskinning onto this rig. The **migration runbook**
for actually swapping that artwork onto this skeleton (mapping, order, rollback) is
[`RONIN_RESKIN_PLAN.md`](RONIN_RESKIN_PLAN.md).

Durable *technique* learnings live in the `rive-character-rigging` skill's `LEARNING-LOG.md`
(`~/.claude/skills/rive-character-rigging/`). That file is append-only and still authoritative.
This file describes **the artefact**; the log describes **how to work on it**.

---

## ⚠️ CURRENT STATE (2026-08-11) — RIG IS BEING REBUILT FROM SCRATCH. §§2–8 BELOW ARE STALE.

### Clean rebuild skeleton reconciliation (2026-08-12)

The active Rive tab is now **`RONIN RIG CLEAN REBUILD`**, artboard `Artboard` `1-2`; do not apply
the older `RONIN RIG 1` ids below to it. A fresh live enumeration found **22 bones**, all now under
one root after geometry-led reconciliation:

`bone-pelvis 1-57666 → bone-spine 1-57667 → bone-chest 1-57668 → bone-head 1-57669`, with both
clavicle/arm chains under chest, both hip/thigh/shin/foot/toe chains under pelvis, and every
reparent preserving the audited world-space starts. The provisional arm labels were reversed by
anatomical side: the viewer-right chain is now `bone-L-*` (`1-57659`…`1-57662`) and the viewer-left
chain is now `bone-R-*` (`1-57655`…`1-57658`). Leg labels were already anatomically correct.

The initial audit found only four central bones. With explicit user approval, the former 69.434-unit
head run was split without deleting anything: duplicated `bone-head`, renamed the duplicate
`bone-neck 1-57670`, and formed the verified chain `bone-chest → bone-neck → bone-head`. Neck length
is 14.000 and head length is 55.434; both run at world rotation `-89.720°`, preserving the original
chest-to-hairline endpoint. The complete clean skeleton now contains **23 bones**. Timeline `1-6`
remains empty after the structural work. No artwork was changed.

The complete `RONIN-HEAD-ART 1-51970` assembly is now a rigid child of `bone-head 1-57669`.
Reparenting preserved its world origin `(1374, 151)` and the approved neutral silhouette. Its direct
children remain separate: combined hair/ears/bandana, both neutral eyes, nose, mouth, both brows and
the skin base. Timeline `1-6` remained empty and the head bone was restored to its neutral rotation
after a temporary follow test.

Torso/pelvis/neck construction binding is complete in the clean file. `torso-base` path `1-30162`
and both `tunic-upper-visible` paths `1-29856`/`1-29869` are jointly weighted to spine+chest with
healthy non-zero influence from both. `pelvis-base` path `1-30864` and all 21 named paths under
`sash-visual-assembly 1-26805` are jointly weighted to pelvis+spine; representative base, band,
knot and both tail paths have influence from both bones. The two `neck-base` paths `1-29470` and
`1-29482` initially auto-weighted entirely to chest, leaving neck inert; those two failed Skin
components were removed and the paths rebound rigidly to `bone-neck`, where all 17 vertices now
have full neck influence. A temporary spine/chest/neck lean test was restored to the exact neutral
rotations. All 27 target paths contain Skin components and Timeline `1-6` remains empty.

The anatomical right arm (viewer-left) is structurally rigged but **not yet visually signed off**.
All four `arm-R-base` paths, `sleeve-R-visible`, and all five `sleeve-R-deep-root` paths were bound
and jointly weighted to `bone-R-upperarm`+`bone-R-forearm`; sampled paths confirm meaningful
influence from both bones, including the deep-root coverage. All 12 `wristwrap-R` paths were jointly
weighted across forearm+hand; central wrap paths have influence from both while pieces farther from
the wrist correctly remain forearm-dominant. Canonical `hand-R 1-29156` is a rigid child of
`bone-R-hand 1-57658`, preserving world origin `(1091.479, 1071.921)`. During the required
shoulder/elbow test, MCP reads confirmed the test rotations but the desktop canvas stayed on a stale
neutral render and did not reflect MCP selection changes, so that screenshot is not valid deformation
evidence. Exact neutral rotations were restored and Timeline `1-6` remains empty. Do not mirror this
arm until a refreshed canvas proves shoulder, elbow, wrap and hand continuity.

A user-requested recheck after refreshing still reproduced the disconnect: MCP reported the test
pose (`upperarm -30°`, `forearm -55°`, `hand 20°`) and `focusArtboard` succeeded, while the desktop
canvas remained visually neutral. Direct computer-control clicks also could not reach the Rive
window (`noWindowsAvailable`). The exact neutral values were restored again. Visual sign-off still
requires the user to pose the bones directly in the visible Rive UI or reconnect/restart the editor
integration so the canvas evaluates MCP mutations.

After the user reconnected and manually interacted with the clean tab, the right-arm pose rendered
at high resolution. Functional follow is confirmed: sleeve/base/wrap and the canonical brown hand
move with the upperarm/forearm/hand chain. The pose also exposed one stationary near-black duplicate
hand silhouette at the neutral hand location. Geometry and world origin identify it as unnamed
direct `Custom Shape 1-30083` (world x≈1093.6); it is now recoverable rollback-only at 0% opacity,
not deleted. A refreshed isolation pass then identified `LEGACY-hand-R-base 1-30424` as a second
stationary duplicate and `arm-R-base` shape `1-30254` / path `1-30255` as the orange/brown elbow
triangle. Both remain recoverably at 0%, as do REVIEW overlays `1-29927`, `1-30119`, and `1-30139`.
Rebinding `1-30255` to forearm alone did not make its buried geometry safe, while disabling it left
the shoulder, elbow, wrap, and canonical hand fully covered. Exact right-arm neutral rotations were
restored.

The anatomical left arm (viewer-right) has now been mirrored numerically. Six wrap paths are jointly
weighted to forearm+hand, `sleeve-L-visible` is weighted to upperarm, and canonical `hand-L 1-29075`
is a rigid child of `bone-L-hand 1-57662` with its world placement preserved. Deformation exposed
stationary duplicate hands `Custom Shape 1-30050` and `LEGACY-hand-L-base 1-30326`, both retained at
0%. It also proved that the three `arm-L-base` shapes `1-30179`, `1-30200`, `1-30220` and the three
`sleeve-L-deep-root` shapes `1-30780`, `1-30789`, `1-30800` extrude outside the silhouette during a
strong elbow bend even after single-segment rebinding. They remain recoverable at 0%, not deleted.
At upperarm `45°`, forearm `70°`, hand `-20°`, the retained visible sleeve/wrap/hand stack showed no
hole, tear, stationary hand, or fragment. Exact neutral rotations (`62.917193°`, `10.949151°`,
`3.711830°`) were restored and the approved neutral silhouette is intact.

**Gate before legs:** the visible arms pass deformation, but the imported left structural/deep-root
candidates currently serve only as tested rollback geometry rather than active joint coverage.
Resolve whether they need clipping/reconstruction or are superseded duplicates before binding legs
or authoring animation. No bone or artwork object was deleted; only failed Skin components were
replaced.

The rig described in sections 2–8 (the old 19-bone skeleton with ids `1-694xx`, the
`ronin-travel/scale/anchor` scene graph, stations, ball, leg IK, and the 9 authored clips) was
**destroyed**: deleting the old bones cascaded and stripped every keyframe, leaving all animation
clips as empty name-only shells. The character was **reskinned with new front-facing pixel-art**
(23 vectorised `scene-item-NNN-groupitem` nodes under `scene-coordinate-normalization` `1-126340`,
inside `ronin-mountain-home-scene` `1-126337`). We are rebuilding in three phases:
**skeleton → skin → idle+walk**, checkpointing after each. Interaction/travel/stations are a later
committed task, to be rebuilt in Rive.

**Phase 1 (skeleton) — DONE.** A fresh **20-bone, single pelvis-rooted** skeleton, hand-placed
rough by the user then connected/renamed/refined via MCP. Character home still world **(1131.5, 835)**
feet / pelvis point; art bbox ≈ x 1097–1165, y 700–835 (small pixel figure). Bones:

| Bone | Id | Bone | Id |
|---|---|---|---|
| bone-pelvis (root) | `1-168984` | bone-head | `1-168972` |
| bone-spine | `1-168973` | | |
| bone-R-clavicle | `1-168964` | bone-L-clavicle | `1-168965` |
| bone-R-upperarm | `1-168966` | bone-L-upperarm | `1-168969` |
| bone-R-forearm | `1-168967` | bone-L-forearm | `1-168970` |
| bone-R-hand | `1-168968` | bone-L-hand | `1-168971` |
| bone-R-hip | `1-168974` | bone-L-hip | `1-168979` |
| bone-R-thigh | `1-168975` | bone-L-thigh | `1-168980` |
| bone-R-shin | `1-168976` | bone-L-shin | `1-168981` |
| bone-R-foot | `1-168977` | bone-L-foot | `1-168982` |
| bone-R-toe | `1-168978` | | |

Topology: `pelvis → {spine → [head, R-clavicle→R-upperarm→R-forearm→R-hand,
L-clavicle→L-upperarm→L-forearm→L-hand], R-hip→R-thigh→R-shin→R-foot→R-toe,
L-hip→L-thigh→L-shin→L-foot}`. L/R are inferred (character faces viewer, symmetric — verify before
authoring any asymmetric motion). Spine/head point **up** from the pelvis (reparent preserved world
orientation, stored as relative r). The missing `bone-L-toe` is a deliberate open topology issue:
the current walk can use planted-foot IK, but a symmetric toe-roll/toe-off pass must add it before
the boots are upgraded for advanced locomotion.

**Phase 2 (skin) — STRUCTURAL BINDING COMPLETE (2026-08-11); visual pose validation remains.**
Corrections to the description above, all verified this session:
- **Only `scene-item-001-groupitem 1-126341` is the character.** scene-items 002–023 are the mountain-home SCENE
  DECOR (sky/mountains/fence/deck/furniture/ball), not character parts. ONE character group to skin, not 23.
- **The skeleton IS correctly fitted to the art** (verified by framing the bone overlay: `f` in Rive). The
  "y700–835 small pixel figure" bbox note above is stale — a coordinate-based misalignment read was a FALSE
  POSITIVE (art-part origins aren't at visual joints). **No refit needed.**
- The character is an OVERLAY PILE (all ~30 parts opacity 100). Classified by isolation test + fill color + spec
  role (NOT by `LEGACY-`/`REVIEW-` prefix — several prefixes are stale: the visible haori and both leg bases are
  `LEGACY-` nodes). `torso-base` stays the deformation base per user; `tunic-*-complete` render only fragmentary
  navy (not a clean garment) → excluded.

**SETTLED RETAINED STACK (bind targets; map to the REBUILT 20-bone skeleton — note it has NO chest/neck bones:
pelvis→spine→head, so neck/torso skin to `bone-spine 1-168973`):**

| Region | ① Structural base (SKINNED) | ② Visible overlays (follow base) | Rigid |
|---|---|---|---|
| Head | New `head-v2-visual-assembly` 1-177493 (skin base `head-v2-skin-base` 1-182626) → rigid child of `bone-head` 1-168972 | `head-v2-hair-ears-bandana` 1-177494, `eye-R-neutral` 1-181946, `eye-L-neutral` 1-182256, `nose-neutral` 1-182533, `mouth-neutral` 1-182572, `brow-L-neutral` 1-182584, `brow-R-neutral` 1-182604 | unified head-v2 assembly; old head artwork removed by user |
| Torso | `torso-base` 1-130506 → `bone-spine` 1-168973 | **`LEGACY-tunic-upper` 1-130199** (canonical visible haori; child `Upper_Torso_Clothed` 1-130212) | — |
| Pelvis | `pelvis-base` 1-131208 → `bone-pelvis` 1-168984(+spine) | `sash-visual-assembly` 1-127150 (21 parts, sash-tail-L/R stay separate) | — |
| Arm L | `arm-L-base` 1-130523 → `bone-L-upperarm` 1-168969 + `bone-L-forearm` 1-168970 | `LEGACY-sleeve-L` 1-130253, `wristwrap-L` 1-129584; hidden overlap `sleeve-L-deep-root` 1-131124 | — |
| Arm R | `arm-R-base` 1-130587 → `bone-R-upperarm` 1-168966 + `bone-R-forearm` 1-168967 | `LEGACY-sleeve-R` 1-130232, `wristwrap-R` 1-129678; hidden overlap `sleeve-R-deep-root` 1-131030 | — |
| Leg L | `LEGACY-leg-L-base` 1-131334 (brown, continuous — rename `leg-L-base`) → `bone-L-thigh` 1-168980 + `bone-L-shin` 1-168981 | `trousers-L-corrected` 1-127706 (navy), `shinband-L-extended` 1-128062 | — |
| Leg R | `LEGACY-leg-R-base` 1-131454 (brown — rename `leg-R-base`) → `bone-R-thigh` 1-168975 + `bone-R-shin` 1-168976 | `trousers-R-corrected` 1-127568, `shinband-R-extended` 1-127913 | — |
| Hands | — | — | `hand-L` 1-129420 → `bone-L-hand` 1-168971; `hand-R` 1-129501 → `bone-R-hand` 1-168968 |
| Feet | — | — | `boot-L` 1-126585 → `bone-L-foot` 1-168982; `boot-R` 1-126836 → `bone-R-foot` 1-168977 (already separate nodes inside `BOOTS` 1-126584 — reparent, no split needed) |

**PROVISIONAL RETIREMENT CANDIDATES (pending deformation validation — keep hidden, unbound, recoverable; DO NOT
DELETE yet):** `tunic-upper-complete` 1-130842, `tunic-lower-complete` 1-131160 (fragmentary navy in neutral pose),
`REVIEW-body-black-upper` 1-130290, `REVIEW-body-black-lower` 1-131229, `REVIEW-upper-body-composite` 1-129837,
`REVIEW-right-upper-overlay` 1-130272, `REVIEW-*-sleeve-detail-A/B` 1-130464/1-130473/1-130484/1-130497,
`REVIEW-head-*-composite` 1-128692/1-129319, `LEGACY-tunic-lower` 1-127500, `LEGACY-hand-L/R-base`
1-130671/1-130769, and the unnamed near-black hand silhouettes `Custom Shape` 1-130395/1-130428. **Neutral-pose
opacity/fill tests proved these don't supply the visible appearance, but NOT that
they offer no useful seam/deformation coverage when layers separate under bending.** Retire a candidate only after
the canonical bases + deep-root overlays are shown gap-free through shoulder-raise / elbow / wrist / torso lean-twist
/ hip / deep-knee / ankle poses with the visible overlays temporarily separated. Keep them unbound and un-deleted
(fully recoverable); hide them only during the controlled validation test unless a specific candidate is confirmed
to obscure the approved neutral appearance.

**BINDING PROGRESS (32nd session): ALL RETAINED STRUCTURAL REGIONS BOUND; full visual pose validation still
PENDING.** `arm-R-base` (4 paths 1-130589/1-130600/1-130624/1-130652) fresh-bound
across `bone-R-upperarm` 1-168966 + `bone-R-forearm` 1-168967 and jointly autoWeighted → healthy dual-bone weights
(upperarm avg ~0.88 / forearm ~0.4–0.68, NEITHER `influencesNothing` — ghost-elbow avoided). Sleeve+deep-root (6
paths 1-130233/1-131032/1-131043/1-131051/1-131059/1-131102) bound to upperarm+forearm, jointly weighted. Wrist
wrap (12 paths 1-129680…1-129800) bound to forearm+hand 1-168968, jointly weighted. Provisional bend tests: base/
sleeve/wrap deform without seam separation (PROVISIONALLY PASSED). `hand-R` 1-129501 is now rigid-parented to
`bone-R-hand` 1-168968 (which is a child of `bone-R-forearm`), preserving world position. All 22 retained paths
were audited as bound; the elbow test also confirmed the hand/base/wrap world positions change with the forearm.
**NOT yet passed — full visual assembled-arm chain:** the neutral figure still shows an unclassified black hand/
overlay on the character's right (viewer-left), and the available live capture was too low-resolution to judge the
suspected shoulder under-sleeve separation. The hand overlay has now been identified as unnamed direct `Custom
Shape` 1-130428 (its mirrored companion is 1-130395), both near-black fills and now hidden at 0%, recoverable and
unbound. `arm-L-base` (3 paths) now mirrors the R-arm: it is jointly weighted to L-upperarm+L-forearm with
meaningful influence from both bones; sleeve+deep-root are jointly weighted to that pair, wristwrap to
L-forearm+L-hand, and `hand-L` is rigid-parented to `bone-L-hand` with world position preserved.

Both continuous leg bases and all retained trouser paths are jointly weighted across their thigh+shin pairs;
shinband/cuff paths are jointly weighted shin+foot. `boot-L`/`boot-R` are rigid children of their respective foot
bones, with world positions preserved. `torso-base` and `pelvis-base` are jointly weighted pelvis+spine;
the canonical visible tunic and full sash assembly follow the same pair. `neck-base` is jointly weighted
spine+head. A later visual-stack audit found that rigidly parenting head/hands/boots beneath the root bone tree
placed them behind the imported character artwork. The rigid artwork was therefore returned to its original
visual stack and its vector paths are being single-bone bound instead: hand paths to hand bones, boot paths to
foot bones, and head/face/hair/bandana paths to `bone-head`. This preserves draw order while retaining rigid
follow behaviour. The face components were flattened one level for reliable ordering; the bright rust-red
bandana shape (`1-129049`) and skin-tone ear shape (`1-129068`) were restored above the head base, and the broad
bandana base fill was corrected from brown-orange to rust red `#a9321b`. No rollback geometry was deleted.

**Still required before animation sign-off:** clean, artwork-only visual captures of both elbows, both shoulder
raises, hip shift, deep knee flex, and ankle/foot rotation; verify no holes, buried-base protrusions, or left-behind
fragments. The two black hand silhouettes remain hidden at 0%; every other retirement candidate is retained,
unbound, and recoverable. All test rotations are restored to neutral.

**Head-v2 replacement (2026-08-12):** the newest re-import is `head-v2-visual-assembly` (`1-188856`) with nine
direct children: hair/ears/bandana (`1-188857`), neutral eyes (`1-193309`/`1-193619`), nose (`1-193896`), mouth
(`1-193935`), brows (`1-193947`/`1-193967`), skin base (`1-193989`) and neck base (`1-194461`). The latest user
re-import reset this root to artboard `(0,0)`, which made it appear absent; its known stage placement was restored
to x=1130.34, y=760.11, r=-90.455 degrees at 100% opacity. It currently remains at the artboard root to preserve
visibility/draw order, so **visibility is restored but head-bone follow is not yet signed off**. The previous
import (`1-177493`) and old
`head-visual-assembly` (`1-128131`) are both hidden at 0%, recoverable and not deleted. Three accidental transform
keys on `1-188856` at idle frame 35 (including y=-1122 and r≈90.6°) were removed, along with two accidental
frame-35 pelvis sampling keys; the intentional 25-key idle cycle remains intact. A later audit found three more
accidental direct `walk` frame-57 keys (`x=1142.85`, `y=1426.25`, `r=-0.98`) which displaced the assembly to
world `(2557,-381)` despite its correct parent. Those keys are removed and the head is now a rigid child of
`bone-head` at local `x=-126.164`, `y=-1.917`, `r=90.979`. Its child order is explicit: neck and skin behind,
facial features in front, combined hair/ears/bandana overlay foremost. A clean rendered idle/head-turn inspection
is still required before calling the new head visually validated. Do not revive or rebind either hidden head stack.

**Leg-path re-audit (2026-08-12):** live hierarchy traversal, rather than stale imported shape IDs, confirms all
53 retained structural/garment paths are skinned to the correct side: leg bases 6L/7R and trousers 11L/10R use
their thigh+shin pairs; shinbands 5L/14R use their shin+foot pairs. The right boot had one path on R-foot and 15
paths incorrectly on L-foot; all 16 were rebound and jointly rigid-weighted to `bone-R-foot`. Rive retains stale
zero/minor L-foot tendons inside some rebound paths, so do not delete Skin components merely to tidy metadata;
the visible right-foot influence is now present across the complete boot. A controlled knee/ankle playback pass
is still required before declaring the assembled legs visually validated.

**Coverage-geometry audit correction (2026-08-12):** screenshots of the walk exposed a flaw in the earlier
retained/excluded classification. Verifying the named retained groups did **not** establish that the complete
deforming character was rigged. A full traversal found 51 live paths at 100% opacity in temporary/concealed
groups with no Skin at all: `tunic-upper-complete` (12), `tunic-lower-complete` (4),
`REVIEW-upper-body-composite` (10), upper/lower black coverage and right overlay (3), four REVIEW sleeve-detail
paths, `LEGACY-tunic-lower` (1), legacy hand bases (10), and legacy trouser/shinband groups (7). The deliberate
deep sleeve roots are correctly bound (5R/3L). These unbound paths explain stationary fragments becoming visible
when the bound top layers move. Treat all 51 as **unclassified coverage candidates**, not retirement geometry,
until isolated deformation tests establish one of: retain+bind, hide as rollback-only, or true duplicate. Walk
refinement is frozen until this region-by-region coverage inventory is settled.

The newest head root (`1-188856`) was also incorrectly keyed directly in `walk` at frame 4 while remaining an
artboard-root object; those three artwork transform keys were removed. Artwork must not be animated separately
from its controlling head bone. The head remains visually positioned but its draw-order-safe bone-follow method
is still unresolved, so the current walk is not suitable for playback review.
**Full-audit pass (2026-08-12, steps 1-7):** the 51-path candidate set is no longer left visible and ambiguous.
Neutral-isolation evidence plus the earlier per-region retained-path audit classifies the old hand silhouettes,
old trouser/shinband groups, flattened `REVIEW-*` composites/details, fragmented `tunic-*-complete` groups and
`LEGACY-tunic-lower` as **recoverable rollback-only geometry**. They are all retained in the file at 0% opacity;
none was deleted. The canonical visible tunic, sleeves, wraps, trousers, cuffs and sash remain visible, while the
continuous torso/pelvis/arm/leg bases and deep sleeve roots remain the deformation/coverage layer. This removes
the stationary fragments seen around hands, torso, knees and ankles without sacrificing rollback.

The newest head assembly was removed from the artboard root and made a rigid child of `bone-head`, preserving its
stage position. The pelvis/bone branch is at the front of the artboard draw stack, so the complete imported head
(hair, ears, bandana, face, skin base and neck) now shares one head transform and can no longer remain behind when
the head bone moves. The erroneous direct `walk` keys on the head artwork are deleted; only `bone-head` may drive
the assembly. The hidden prior head stacks remain recoverable at 0% opacity.

Structural binding coverage is complete for both arms and both legs: arm bases and deep sleeve roots use their
upper-arm/forearm pairs; wraps use forearm/hand; visible hands are rigid children of hand bones; leg bases and
trousers use thigh/shin; cuffs use shin/foot; boots use their corresponding foot. Torso and pelvis bases are
jointly weighted across pelvis/spine, the visible tunic follows spine, and the sash follows pelvis/spine. Extreme
head, shoulder, elbow, hip, knee and ankle rotations were exercised with rollback-only geometry hidden and all
bone rotations were restored to their recorded neutral values afterwards.

**Live hand/draw-order correction (2026-08-12):** both visible hand nodes had reverted to the static imported-art
container and had accidental direct `walk` frame-3 transform keys. Those keys are removed; `hand-R` and `hand-L`
are again rigid children of `bone-R-hand` and `bone-L-hand`. Structural torso/pelvis/arm bases and deep sleeve
roots are ordered behind the canonical tunic/sleeves/trousers/cuffs/sash/wraps/boots. Rollback-only artwork stays
recoverable at 0% opacity; no artwork or paths were deleted.

**Step-7 verdict REVOKED (2026-08-12 live construction re-audit):** do not resume locomotion work yet. The live
editor is still evaluating `State Machine 1` while construction edits are being made, despite the state graph
appearing to have been cleared in the UI. This makes neutral transforms appear to snap back and invalidates visual
judgements made from the preview. The newest head assembly is still visibly displaced/ghosted in the evaluated
canvas, so its attachment is not signed off. A full retained-path scan did confirm that every canonical arm base,
sleeve, deep sleeve root, wrist wrap, leg base, trouser and cuff path has a Skin; both visible hands remain rigid
children of their hand bones. Structural bases have been explicitly sent behind the canonical tunic/sleeves/
trousers/cuffs/wraps/sash, and all rollback-only groups remain recoverable at 0% opacity. Before animation resumes,
open a genuinely neutral Design-mode canvas (no active timeline or state-machine evaluation), establish and verify
the head assembly's neutral local transform, then capture artwork-only shoulder/elbow/hip/knee/ankle tests. Do not
infer neutral construction correctness from an Animate/state-machine preview.

**Phase 3 (idle+walk) — IDLE + FIRST WALK PASS AUTHORED; VISUAL VALIDATION AND TRUE IK REMAIN.** `idle` 1-8715 has a
60-frame, cubic two-cycle settle loop (25 keys) on bones only: pelvis y, spine r, head r and both upper-arm r.
`walk` 1-25399 now has a 60-frame looping first locomotion pass: 60 cubic keys across 12 skeleton objects only,
covering pelvis double-bounce, torso/head stabilization, alternating thighs/knees, ankle/foot roll, the available
R toe, and antiphase upper-arm swing. This is intentionally a **bone-driven visual prototype, not yet a genuine
planted-foot IK walk**: the rebuilt file contains no IK constraints, the currently exposed live MCP has no safe
constraint-creation command, and `bone-L-toe` is still missing. Do not call foot planting complete until symmetric
toe topology and both foot targets/IK constraints are added and the cycle is re-authored against those targets.
**Not yet done / to decide:** leg foot IK (needed for planted-foot walk), per-trip walktime, and the
whole interaction/travel/station rebuild (parked as the agreed later task).

Everything from `## 1. The file` down still correctly describes **the Rive file, tab, artboard, and
donor-attribution**, but §§2–8's rig internals are the OLD rig — treat as historical reference for
the *target behaviour* we're rebuilding toward, not as current ids.

---

## 1. The file

- Rive desktop file: **`RONIN RIG 1`** (tab `1`). Single artboard `1-8711`, **2340 × 1080**,
  sized to match the donor cat file for layout parity.
- The donor cat (`CATCAT!!!character binding`) is a **read-only reference**. Never author into it.
  Its object ids start `0-`; ours start `1-`. The MCP follows the active editor tab, so check
  `list_artboards` at the start of any turn that follows a user screenshot.
- Attribution: the donor rig is CC BY — **credit L.7** in anything shipped that derives from it.

## 2. Scene graph

```
Artboard 1-8711
├── ball                1-75292   (front of floor)
├── station-couch       1-74888   (front of character — he sits INTO it)
├── ronin-travel        1-71176   x/y ← characterX / characterY (converter-eased)
│   └── ronin-scale     1-75103   (0,0) sx/sy ← depthScale        (converter-eased)
│       └── ronin-anchor 1-75059  (−235.8, −418)
│           ├── ronin-v3-parts 1-63386   art
│           ├── bone-pelvis    1-69468   skeleton root
│           ├── ik-target-R-foot 1-74163
│           └── ik-target-L-foot 1-74393
├── station-weights     1-74892
├── room-floor          1-75060
├── station-coffee      1-75108
└── click-probe         1-75286   x/y → characterX / characterY (toSource)
```

**Why three nested transform nodes.** `ronin-travel` positions, `ronin-scale` scales about the
**feet** (its origin is the feet because `ronin-anchor` cancels the art's internal offset), and
`ronin-anchor` holds the keyframed subtree. Keyframes store *absolute local* values, so the anchor
must never move — reposition the rig by moving `ronin-scale`/`ronin-travel`, or by the 0,0-reparent
trick (create new parent at 0,0 → reparent → then move the parent).

**Character home is world (1169.8, 860)** — feet on the floor line, horizontally centred.

## 3. Skeleton

19 bones, `bone-pelvis` `1-69468` … `1-69486`. Chain: pelvis → spine → chest → {neck → head;
R-clav → R-upperarm → R-forearm → R-hand; L-clav → …}, and pelvis → {R-thigh → R-shin → R-foot;
L-thigh → L-shin → L-foot}.

**IK:** constraint `1-74159` on `bone-R-shin` `1-69482` → target `ik-target-R-foot` `1-74163`;
`1-74160` on `bone-L-shin` `1-69485` → `ik-target-L-foot` `1-74393`. Both strength 100,
`invert_direction` false, `parentbonecount` **1** (= Inspector "Bone Count" **2** = shin + thigh —
the property counts *parents above* the constrained bone).

**Targets must live outside the bone hierarchy.** An IK target parented inside its own chain is a
silent no-op — everything reads correct in the Inspector and nothing moves.

### Art binding — the constraint that shapes every leg animation

The leg art is skinned to **`bone-R-thigh` + `bone-R-shin` only**. `bone-R-foot` / `bone-L-foot`
drive **no artwork** (the boots are rigid children of the foot bones, but their paths are in the
skin, and skinned vertices ignore parent transforms). Consequences:

- **Vertical foot-target lift does not raise the boot.** It swings in an arc about the knee.
- **Lateral target motion does read** — the boot shifts visibly inward/outward. All gait cycles are
  authored in that channel.
- Foot-roll keys on `1-69483`/`1-69486` are **invisible**. Don't spend time on them.

Fixing this properly means deleting each leg path's `Skin` and re-binding with the foot bone
included (~25 paths per leg, destroys weights). Deliberately **not** done — flagged as a future
call, not a pending task.

### Arm skin is degenerate — a "ghost elbow" (audit 2026-08-08)

The legs are the *only* healthy skin. `querySkin` on the arm paths (`1-66975`, `1-66986`,
`1-66998`, `1-67302`) shows each is bound to **upperarm + forearm but with 100% of vertex weight on
the forearm and `influencesNothing: true` on the upperarm**. So the whole arm is a rigid sleeve
that swings from the shoulder: the elbow is present in the skeleton but deforms no art, and the
upper-arm bone drives nothing. A rendered pass confirmed it reads as a stiff stick-arm (no elbow
bend, but also no gap/tear because there is no separate upper-arm art to separate). For comparison,
the healthy legs read `bone-*-thigh` ~0.87 / `bone-*-shin` ~0.80 average weight over 30 verts.
Fixable by re-weighting upperarm+forearm together (`autoWeight` over both arm paths at once); not a
redesign. See [`RONIN_RIVE_AUDIT_2026-08-08.md`](RONIN_RIVE_AUDIT_2026-08-08.md).

## 4. ViewModel `Ronin` `1-8723`

Instances: `RoninState` `1-25603`, `Instance` `1-8724`. Both carry the same defaults.

| Property | Id | Meaning |
|---|---|---|
| `characterX` | `1-71158` | **Absolute** artboard x of the feet. Home 1169.8 |
| `characterY` | `1-71161` | **Absolute** artboard y of the feet. Home 860. Lower = further back |
| `depthScale` | `1-75100` | Scale factor. **1.0 = 100%** (raw, not percent) |
| `walktime` | `1-71164` | Travel duration, seconds. **Must equal the walk clip length (1.0)** |
| `facing` | `1-71170` | <0 lean left, >0 lean right, 0 upright |
| `gait` | `1-71173` | 0 = walk, 1 = run |
| `station` | `1-74885` | 0 none, 1 couch, 2 weights, 3 coffee, 4 ball |
| `clickwalk` | `1-71167` | Trigger — start a walk-to |
| `isWalking` | `1-25599` | Held-walk boolean (app-driven path) |
| `doWave`, `ballHit` | `1-25601`, `1-75287` | Triggers, currently unused |

> **Units trap.** `set_property_values` uses editor units (100 = 100%); a **data bind passes the raw
> number**. A bound percent property wants `1.0`, not `100`. This produced a 100× character once.

### Travel mechanism

`characterX/Y` → `ronin-travel.x/y` through **`Interpolator 1` `1-74161`**, whose `duration`
(key 756) is bound to `walktime`. Writing `characterX` *eases* the character there rather than
teleporting. `depthScale` → `ronin-scale.sx/sy` through the **same** converter, so depth and
position glide together.

**Arrival is detected as `exitTime 100%` on the walk state** — there is no "converter finished"
event. This only works while `walktime` equals the walk clip's duration.

## 5. Animations

| Clip | Id | Len | Notes |
|---|---|---|---|
| `idle` | `1-8715` | 60 f, loop, speed 0.35 | pelvis bob, chest/head, arms |
| `walk` | `1-25399` | 60 f, loop | pelvis double-bounce, foot targets lateral ±13, arm swing |
| `run` | `1-74669` | 40 f, loop | same channels, larger amplitude |
| `sit` | `1-74896` | 90 f, one-shot | pelvis 313→352; **IK bends the knees for free** |
| `lift` | `1-74897` | 79 f, one-shot | two arm presses + effort dip |
| `coffee` | `1-75175` | 90 f, one-shot | raise arm, two sips, lower |
| `kick` | `1-75296` | 60 f, one-shot | foot swing + ball `positionleft` 1950→2210, 320° spin |
| `face-center/left/right` | `1-74829/30/31` | 6 f | `bone-spine` r = 0 / −7 / +7 |

**Channel budget — respect it.** `bone-spine` `1-69469` is reserved for the `facing` layer and is
keyed by nothing else. Parallel layers resolve last-writer-wins *silently*, so a clip that keys
spine would fight `facing` with no error.

**Invariant: nothing keyframes artwork.** Every keyed `objectId` must be a bone (`1-694xx`) or an IK
target (`1-74163`/`1-74393`) — plus the ball's layout style in `kick`, which is scene, not character.
Audit with `queryKeyFrames` after any structural work; `reparent_objects` auto-keyframes if a
timeline is active, so do structural work in **Design mode**.

## 6. State machine `State Machine 1` `1-8716`

**`Layer 1` `1-8717`** — activity:

- Entry → `idle` `1-8721`.
- Held path (app-driven): `idle ↔ walk` `1-25606` on `isWalking` + `gait == 0`;
  `idle ↔ run` `1-74806` on `isWalking` + `gait == 1`.
- Click path: `idle → walk-to` `1-74998` on `clickwalk` (a **separate state on the same clip**, so
  the two paths don't fight). Then at `exitTime 100%`:
  `→ sit` [`station==1`], `→ lift` [`station==2`], `→ coffee` [`station==3`],
  `→ kick` [`station==4`], `→ idle` [`station==0`].
- All activities return to `idle` at `exitTime 100%`, **1350 ms** (the donor's return-to-rest).

**`facing` layer `1-74841`** — `face-center/left/right`, conditioned on `facing` <0 / >0 / ==0.

**`breathe` `1-28268` and `idle-variation` `1-28273` are INERT** — the 2026-08-08 visual pass found
their states carry an **empty Timeline (no clip assigned)**, not dangling references to deleted
clips as earlier believed; the three idle-variation states (`settle`/`glance`/`still`) are likewise
empty. Same practical result — nothing plays — but they're a clean slate to author into, not a
broken reference to repair. The `wave` state (`animationId: 0-0`) is still dangling. Consequence:
idle reads as a near-frozen statue (no breathe/sway/blink); all ambient life is unbuilt.

## 7. Interaction

| Click target | Behaviour |
|---|---|
| `room-floor` | `alignTarget(click-probe)` → walks to that point |
| `station-couch` | (520, 940) scale 1.12, station 1 → `sit` |
| `station-coffee` | (500, 700) scale 0.82, station 3 → `coffee` |
| `station-weights` | (1750, 700) scale 0.82, station 2 → `lift` |
| `ball` | (1855, 945) scale 1.08, station 4 → `kick` |

**Free-click position capture:** listener `viewModelChange` actions can only write *constants*, so
"wherever the user tapped" comes from an `alignTarget` action moving `click-probe`, whose x/y are
bound **`toSource`** to `characterX/Y`. A `toSource` bind makes the *node* the source of truth at
startup — `click-probe` must sit at the home position or it teleports the character on frame 1.

**Known gap: free floor clicks do not set `facing`.** Deriving sign(click − position) needs a
comparator/formula converter, and no MCP tool creates one. Either add it in the GUI, or let the host
app set `facing` directly (which is what a host app would normally do).

## 8. Placeholders

`room-floor`, `station-couch`, `station-coffee`, `station-weights`, `ball` are plain Layouts with
flat fills, intended to be replaced with real art. Layout position lives on the **style** object
(`positionleft` 516, `positiontop` 518, `positiontypevalue` 597 = 2, units enums 621/623 = 1), not
on the layout's own x/y. `positionleft` **is** keyframeable — that's how the ball rolls.

## 9. Open items

1. Free-click `facing` (above).
2. `walktime` is fixed at 1.0 regardless of distance — short trips look leisurely, long ones hurried.
   The donor sets it per-trip `onEnter` of the transition that picks the gait clip. Do this when
   moving past placeholders.
3. `sit` doesn't yet land him convincingly *into* the couch.
4. Inert `breathe` / `idle-variation` states (empty timelines) + dangling `wave` — no ambient life.
5. Watched at speed during the 2026-08-08 audit (see `RONIN_RIVE_AUDIT_2026-08-08.md`): joints hold
   up within the current clips' range, but idle reads static and the arms don't bend. Side-profile
   joint quality and larger motion ranges remain unverified (all clips are front-facing).
6. Leg re-skin to include foot bones (§3), if planted-foot gait is ever needed.
7. **Re-weight the arms** — currently a degenerate forearm-only skin (§3, "ghost elbow"); the elbow
   deforms no art. `autoWeight` upperarm+forearm together to restore an elbow bend.
