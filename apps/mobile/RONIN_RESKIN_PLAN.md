# Ronin — Reskin Implementation Plan

**How the new production artwork (per [`RONIN_PRODUCTION_ARTWORK_SPEC.md`](RONIN_PRODUCTION_ARTWORK_SPEC.md))
maps onto the live `RONIN RIG 1` skeleton, in what order, and how to stay recoverable.**

Companion to [`RONIN_RIVE.md`](RONIN_RIVE.md) (rig artefact) and the artwork spec (asset content).
This document is the **migration runbook** for the SVG → Rive replacement stage.

- Created: 2026-08-10
- Status: **Planning only — EXECUTION PAUSED. The Rive file is NOT modified by this document.** No
  bones, meshes, springs, or animations are added here.
- **Execution gate:** do not begin any reskin step until the new production asset set has been
  (1) generated, (2) independently reviewed, and (3) approved. Until all three are satisfied this
  document is a baseline reference only; the current working Ronin stays as-is.
- **Leg scope reminder:** this reskin swaps thigh+shin geometry only and keeps the current leg IK
  and animations untouched. True planted-foot gait is a separate future upgrade (§2.8.3), not part
  of this work.

---

## 0. The load-bearing fact this plan depends on

**Verified live (2026-08-10):** every animation keys **bones and IK targets only** — never Path
or Shape geometry. Inspecting `walk` (`1-25399`) shows keyframes exclusively on:

- `bone-pelvis` (x/y/rot), `bone-chest`, `bone-head`, `bone-L/R-upperarm`, `bone-L/R-forearm`,
  `bone-L/R-foot`, and the IK targets `ik-target-L-foot` (`1-74393`) / `ik-target-R-foot`
  (`1-74163`). (Property keys: `15`=rotation, `90`=x, `91`=y.)

**Consequence — the central migration principle:**

> Artwork is driven *indirectly*, through the bones. Replace the geometry under a bone (or under a
> node/group that a bone drives) and **all ten animations continue to drive it automatically**, with
> zero keyframe edits — provided the new art is attached to the **same bone IDs** with the same
> parenting/skinning role. We never re-key animations during a reskin; we only re-attach geometry.

This holds for all animations: `idle 1-8715`, `walk 1-25399`, `run 1-74669`, `sit 1-74896`,
`lift 1-74897`, `coffee 1-75175`, `kick 1-75296`, `face-left/right/center 1-74830/74831/74829`,
plus State Machine 1's `breathe`/`settle`/`still`/`glance`/`facing`/`idle-variation` layers.

---

## 1. Live scene-graph anchor points (verified IDs)

Do not hard-trust these IDs at execution time — re-`get_artboard_hierarchy` first, since autosave
revisions can renumber. They are recorded here to make the mapping unambiguous today.

**Bones** (all `RootBone`/`Tendon`, under `ronin-anchor 1-75059`):

| Bone | ID | Bone | ID |
|---|---|---|---|
| bone-pelvis | 1-69468 | bone-spine | 1-69469 |
| bone-chest | 1-69470 | bone-neck | 1-69471 |
| bone-head | 1-69472 | | |
| bone-R-clav | 1-69473 | bone-L-clav | 1-69477 |
| bone-R-upperarm | 1-69474 | bone-L-upperarm | 1-69478 |
| bone-R-forearm | 1-69475 | bone-L-forearm | 1-69479 |
| bone-R-hand | 1-69476 | bone-L-hand | 1-69480 |
| bone-R-thigh | 1-69481 | bone-L-thigh | 1-69484 |
| bone-R-shin | 1-69482 | bone-L-shin | 1-69485 |
| bone-R-foot | 1-69483 | bone-L-foot | 1-69486 |
| ik-target-R-foot | 1-74163 | ik-target-L-foot | 1-74393 |

**Existing art groups** (under `ronin-v3-parts 1-63386`):

| Group | ID | Current parent | Current binding |
|---|---|---|---|
| torso | 1-65614 | bone-chest | rigid (30 shapes, 0 skins) |
| pelvis | 1-66061 | bone-pelvis | rigid (26 shapes) |
| sash | 1-65223 | bone-pelvis | rigid (34 shapes) |
| neck | 1-65044 | bone-neck | rigid (2 shapes) |
| head | 1-63388 | bone-head | rigid (112 shapes total) |
| ├ Face | 1-64425 | head | rigid |
| ├ Hair_Back_ | 1-64782 | head | rigid |
| ├ Bandana_Front_ | 1-64112 | head | rigid |
| ├ bandana_tie_1_ | 1-63821 | head | rigid |
| └ bandana_tie_2 | 1-64235 | (Group) | rigid |
| arm-L | 1-67222 | ronin-v3-parts | meshed → upperarm+forearm (20 skinned frags) |
| arm-R | 1-66896 | ronin-v3-parts | meshed → upperarm+forearm (20 skinned frags) |
| leg-L | 1-66496 | ronin-v3-parts | meshed → thigh+shin (25 skinned frags) |
| leg-R | 1-68479 | ronin-v3-parts | meshed → thigh+shin (25 skinned frags) |
| hand-L | 1-67908 | bone-L-hand | rigid (25 shapes) |
| hand-R | 1-67549 | bone-R-hand | rigid (25 shapes) |
| boot-L | 1-68265 | bone-L-foot | rigid (15 shapes) |
| boot-R | 1-68879 | bone-R-foot | rigid (15 shapes) |

Outside the character (never touched by reskin): `ball`, `station-couch`, `station-weights`,
`station-coffee`, `room-floor`, `click-probe`, and the `ronin-travel`/`ronin-scale`/`ronin-anchor`
transform chain.

---

## 2. Replacement mapping (per new production asset)

Columns: **Dest** = where it lands in the hierarchy · **Replaces** = existing art retired ·
**Bone(s)** = attach/bind targets · **Role** = rigid / skinned / overlay · **Anim inherited?** =
does existing keyframe motion drive it automatically · **Keep-under?** = leave old art beneath
during migration.

### 2.1 Neck
| Field | Value |
|---|---|
| Dest | replace children of `neck 1-65044` (under `bone-neck`) |
| Replaces | the 2 existing neck shapes |
| Bone(s) | **skin** to `bone-neck 1-69471` (+ `bone-chest 1-69470` at the base) |
| Role | **Skinned** (was rigid) |
| Anim inherited? | Yes — `bone-neck`/`bone-chest` already move; new skin follows |
| Keep-under? | Optional — the old 2 shapes are tiny; safe to keep briefly for visual diff, remove first |

### 2.2 Torso body + collar
| Field | Value |
|---|---|
| Dest | replace children of `torso 1-65614`; re-parent group from rigid-under-`bone-chest` to **skinned** across spine+chest |
| Replaces | torso's 30 rigid shapes |
| Bone(s) | torso-body **skin** to `bone-spine 1-69469` + `bone-chest 1-69470`; collar = overlay |
| Role | torso-body **Skinned**; collar/lapels **Overlay** (weighted to same bones) |
| Anim inherited? | Yes — chest/spine are keyed; upgrading from rigid-follow to skin adds breathe/lean headroom without changing keys |
| Keep-under? | **Yes** — keep old torso visible underneath until the new skin is validated (it currently hides the shoulder/arm seam) |

### 2.3 Pelvis / lower garment
| Field | Value |
|---|---|
| Dest | replace children of `pelvis 1-66061` |
| Replaces | pelvis's 26 rigid shapes |
| Bone(s) | **skin** to `bone-pelvis 1-69468` (+ `bone-spine` at top) |
| Role | **Skinned** (was rigid) |
| Anim inherited? | Yes — pelvis is the animated root |
| Keep-under? | **Yes** — keep old pelvis beneath during torso+pelvis swap so no gap shows at the waist seam |

### 2.4 Sash (band + knot + tails)
| Field | Value |
|---|---|
| Dest | replace children of `sash 1-65223` (under `bone-pelvis`); tails as new sibling overlay shapes |
| Replaces | sash's 34 rigid shapes |
| Bone(s) | band/knot rigid or light-skin to `bone-pelvis 1-69468`; tails ride `bone-pelvis` (own secondary chain is a *future* decision, not this reskin) |
| Role | band/knot **Overlay** over torso+pelvis seam; tails **Overlay** (no springs yet) |
| Anim inherited? | Yes — pelvis-driven |
| Keep-under? | No — sash sits on top; swap after torso+pelvis validated so it re-covers the new seam |

### 2.5 Arms — structural base (the ghost-elbow fix) — **one arm at a time**
| Field | Value (per side; L shown, R symmetric) |
|---|---|
| Dest | new `arm-L-base` shape inside `arm-L 1-67222` |
| Replaces | arm-L's 20 fragmented skinned shapes |
| Bone(s) | **fresh skin** across `bone-L-upperarm 1-69478` + `bone-L-forearm 1-69479` |
| Role | **Skinned** — single continuous mesh |
| Anim inherited? | Yes — upper-arm & forearm rotations are keyed in walk/run/etc.; new mesh follows |
| Keep-under? | **Yes, mandatory** — keep old `arm-L` beneath (hidden or dimmed) until the new base passes the bend test, then delete |

See §3 for the fresh-mesh/weight procedure — the old weights are defective (audit: upper-arm
influence = 0 vertices) and must **not** be inherited.

### 2.6 Arm overlays — navy short sleeve + red wrist wrap (per side)
| Field | Value |
|---|---|
| Dest | sibling shapes inside `arm-L 1-67222`, drawn above `arm-L-base`, ordered sleeve (top) → base → wrist-wrap |
| Replaces | the decorative/garment fragments of old arm-L |
| Bone(s) | sleeve **skin** to `bone-L-upperarm` (+`forearm` at hem); wrist-wrap **skin** to `bone-L-forearm` (+`hand` at cuff) |
| Role | **Overlay** — each is ONE shape weighted to follow the base, **never a joint-spanning stack of fragments** |
| Anim inherited? | Yes — same bones |
| Keep-under? | No — overlays go on last, over the validated base |

### 2.7 Hands
| Field | Value |
|---|---|
| Dest | replace children of `hand-L 1-67908` / `hand-R 1-67549` |
| Replaces | 25 rigid hand shapes each |
| Bone(s) | rigid-parent to `bone-L-hand 1-69480` / `bone-R-hand 1-69476` |
| Role | **Rigid** (consolidated to one shape + thumb) |
| Anim inherited? | Yes — hand bone follows forearm; hand not independently keyed in walk but rides the chain |
| Keep-under? | No — swap with the arm on that side |

### 2.8 Legs — least-destructive reskin (preserve IK)
| Field | Value (per side) |
|---|---|
| Dest | replace geometry inside `leg-L 1-66496` / `leg-R 1-68479` |
| Replaces | 25 skinned leg fragments each |
| Bone(s) | **skin** across `bone-L-thigh 1-69484`+`bone-L-shin 1-69485` (R: `1-69481`+`1-69482`) |
| Role | leg-base **Skinned**; optional trouser/cuff **Overlay** only if final art is banded |
| Anim inherited? | Yes — thigh/shin rotations + the `ik-target-*` foot targets already drive these bones; **the IK solver and its targets are left untouched** |
| Keep-under? | **Yes** — keep old legs beneath until the new skin passes the leg acceptance test (§2.8.2) |

**Keep the current leg IK and animations untouched during this artwork replacement.** This reskin
does **not** rebuild, retune, or re-key the leg bone chain, the IK constraints, or the
`ik-target-L-foot`/`ik-target-R-foot` nodes. It swaps thigh+shin *geometry* only, binding to the
identical bones. IK behaviour and every leg animation are to come through byte-for-byte unchanged.

**Least-destructive leg approach.** The legs already work (continuous skin + IK). Two options,
cheapest first:
- **(A) Reskin in place, keep fragment count** — if the new leg art vectorises into a similar
  continuous shape, just rebind the new path across thigh+shin, matching the current working weight
  distribution. Lowest risk.
- **(B) Consolidate to one base + overlays** — only if the new art clearly benefits and (A) leaves
  seams. Still binds to the identical bones; IK unaffected because IK acts on bones, not geometry.

Prefer (A) unless it visibly fails; legs are the one region already meeting the spec's intent.

#### 2.8.1 Scope boundary — feet/boots stay thigh+shin only (this reskin)

The current leg artwork is **thigh + shin only**; the `bone-L/R-foot` bones drive the rigid `boot-L`
/`boot-R` groups but **no leg/boot geometry is skinned to the foot bones**. Consequently, vertical
`ik-target-*` movement repositions the foot *bone/boot* but cannot correctly raise, roll, or plant
the boot against the ground — the shin geometry does not follow a lifting foot. **This immediate
reskin does not change that.** Boots remain rigid to `bone-L/R-foot`; we do not introduce
foot-bone influence into the leg or boot mesh here.

#### 2.8.2 Leg acceptance test (this reskin — lateral gait / IK behaviour only)

Validate **only** what the current rig actually supports:
- the existing **lateral gait** (thigh/shin swing across `walk`/`run`) deforms cleanly with the new
  skin — no seam separation at the knee, no collapse;
- the existing **IK behaviour** (foot targets keeping the leg solved as the pelvis moves) is
  unchanged from the pre-reskin baseline;
- boots stay attached to `bone-L/R-foot` and track as before.

**Do not** test for, or claim, true planted-foot locomotion (a foot that lifts, rolls, and plants
with the boot deforming to the ground). That capability does not exist in the current rig and is
explicitly out of scope for this reskin — see §2.8.3. Passing this test means "gait and IK behave
exactly as they did before the reskin," nothing more.

#### 2.8.3 Future upgrade path — full planted-foot gait (later, NOT this reskin)

Documented now so the new leg/boot artwork can be generated upgrade-ready, but deliberately deferred:

- **Goal:** a true planted-foot gait where vertical `ik-target-L/R-foot` motion lifts and plants the
  boot, with the ankle/boot deforming to the ground contact — using the **existing** `bone-L-foot
  1-69486` / `bone-R-foot 1-69483` bones and the **existing** `ik-target-L-foot 1-74393` /
  `ik-target-R-foot 1-74163` targets. No new foot bones or new IK targets are anticipated.
- **What it requires (later):** leg/boot geometry that extends down over the ankle and is **skinned
  to include `bone-L/R-foot`** (i.e. a thigh→shin→foot skin, plus a boot that deforms with the foot
  bone rather than riding it rigidly), so foot-target movement drives visible lift/plant.
- **Artwork implication for the current asset generation:** draw the new leg base with enough
  continuous geometry over the ankle, and the boot with enough hidden overlap up the shin, that a
  later foot-inclusive rebind is possible **without regenerating the art**. This is the only
  forward-compat ask; no foot binding is performed now.
- **Treat foot-bone-inclusive leg/boot reskinning as a separate, later planned upgrade** with its
  own checkpoint, its own acceptance test (actual lift/plant), and its own sign-off — not part of
  this immediate artwork replacement.

### 2.9 Head base + face + hair + bandana (do last)
| Asset | Dest | Replaces | Bone/Role | Anim inherited? |
|---|---|---|---|---|
| Head base | children of `head 1-63388` | part of head's 112 shapes | rigid → `bone-head 1-69472` | Yes (head keyed) |
| Face pieces (eyes/brows/nose/mouth) | inside `Face 1-64425` | Face's 30 shapes | rigid, separated for later blink/gaze | Yes |
| Hair mass + fringe tips | inside `Hair_Back_ 1-64782` (+ front) | hair's rigid frags | rigid → `bone-head`; fringe tips separate (future secondary motion) | Yes |
| Bandana band | `Bandana_Front_ 1-64112` | band frags | rigid → `bone-head` | Yes |
| Bandana tails A/B | `bandana_tie_1_ 1-63821` / `bandana_tie_2 1-64235` | tie frags | overlay → `bone-head` (springs are a *future* decision) | Yes |

Keep-under for head: **Yes** — head is the most visually complex; keep the old head beneath until
the new head+face align to the neck top.

---

## 3. Arm structural base — fresh mesh & weighting procedure

The ghost elbow had **two** causes (per the spec §2): fragmentation **and** genuinely broken
weights (audit sampled upper-arm influence = **0 vertices**). The new base must be built from
scratch; nothing from the old arm's Skin/Weight data may be reused.

Per side, at execution time (not now):
1. Import the new `arm-*-base` as one continuous path inside `arm-*` group; keep the old arm beneath, hidden.
2. Create a **new mesh** on the base path with vertex density concentrated across the elbow band
   (more rings near the joint, fewer along straight upper-arm/forearm runs).
3. Bind the mesh to **exactly two bones**: `bone-*-upperarm` and `bone-*-forearm` — a fresh Skin
   with fresh Tendons. Do not copy the old Skin.
4. **Weight explicitly and verify:** paint a smooth upper-arm→forearm falloff across the elbow;
   then **confirm non-zero upper-arm influence** on the shoulder/upper vertices (the exact defect
   the audit found). Acceptance: no vertex that should move with the upper arm reads 0 upper-arm weight.
5. Bend test: pose `bone-*-forearm` through the walk/run rotation range and confirm the elbow
   deforms as one continuous surface — no seam separation, no collapse, no ghost.
6. Only then attach the sleeve/wrist-wrap overlays (§2.6) and delete the old arm group.

**Overlay rule to avoid re-creating the ghost elbow:** each garment overlay (sleeve, wrist-wrap,
shading) is **one shape following the base**, weighted to the same two bones — never a pile of
independently-skinned slivers each spanning the joint. Decorative shading rides its parent
structural shape; it is never sliced into the base mesh. (This is the spec §3 rule, restated as the
execution guardrail.)

---

## 4. Safe replacement order

Derived from the actual file: go **innermost/most-load-bearing structural regions first, secondary
decoration last**, and never swap both halves of a symmetric pair at once. Test after each region.

```
0.  CHECKPOINT (baseline revision, tag "pre-reskin")
1.  Neck                    → test  (head still old; check neck fills the jaw/collar gap)
2.  Torso body + collar     → test  (breathe/lean via skin; old torso kept under until pass)
3.  Pelvis / lower garment  → test  (waist seam with new torso)
4.  Sash (band/knot/tails)  → test  (re-covers the torso↔pelvis seam)
    ── CHECKPOINT "core-torso-done" ──
5.  LEFT arm base           → bend test → sleeve+wrap+hand → test
    ── CHECKPOINT "left-arm-done" ──
6.  RIGHT arm base          → bend test → sleeve+wrap+hand → test
    ── CHECKPOINT "arms-done" ──
7.  LEFT leg                → lateral-gait + IK-behaviour test (§2.8.2; NOT planted-foot)
8.  RIGHT leg               → lateral-gait + IK-behaviour test (§2.8.2; NOT planted-foot)
    ── CHECKPOINT "legs-done" ──
9.  Head base + Face        → test  (align to neck top from step 1)
10. Hair mass + fringe      → test
11. Bandana band + tails    → test
    ── CHECKPOINT "head-done" ──
12. Full pass: play idle / walk / run / sit / lift / coffee / kick / face-*  → final validation
    ── CHECKPOINT "reskin-v1-complete" ──
```

**Why this order (from the file, not the generic template):**
- **Neck first** because it's currently near-empty (2 shapes) and everything above/below overlaps
  it; establishing the new neck volume first gives torso and head a correct seam to meet.
- **Torso → pelvis → sash as a block** because torso currently *hides* the shoulder/arm seam and the
  sash *hides* the torso↔pelvis seam; doing them in this inside-out order means each swap's seam is
  covered by the piece added next.
- **Arms before legs** because arms are the actual defect (fresh mesh + weights, highest risk) and
  are visually isolated once the torso covers the shoulder — failing an arm can't corrupt anything
  else. One side at a time so the untouched side stays a live reference for symmetry.
- **Legs after arms** because they already work; touching them is lowest-value/lowest-urgency and
  must not disturb the validated IK — isolating them last minimises blast radius.
- **Head/hair/bandana last** because it's the most fragment-dense region (112 shapes) and purely
  rides `bone-head`; it has no structural dependents, so it's the safest thing to leave for the end.

**Per-region test after each swap:** play `idle` + `walk` at minimum; for arms add the elbow bend
range; for legs run the §2.8.2 lateral-gait + IK-behaviour check (NOT planted-foot); confirm no seam gap, no draw-order inversion, no piece
detaching from its bone.

---

## 5. Rollback / checkpoint strategy

The current working Ronin must stay recoverable at every step.

1. **Pre-flight external backup (before touching anything):** export/duplicate `RONIN RIG 1` so a
   full copy of the working character exists outside the edit history. The shipping runtime
   `assets/rka_journey_rig.riv` is unaffected regardless (RONIN RIG 1 hasn't been exported over it),
   so production stays safe throughout — but keep the editor copy too.
2. **Rive Revision History = the primary rollback rail.** Rive autosaves revisions; before each
   numbered step in §4, note the current revision as a named checkpoint (the `── CHECKPOINT ──`
   markers). Rolling back = restore that revision. (Revision History panel makes the file read-only
   while open — close it before resuming edits.)
3. **Keep-old-art-underneath is a rollback mechanism, not just visual cover.** For every region
   marked *Keep-under? = Yes*, the old group stays in the file (hidden/dimmed) until that region's
   test passes. If the new art fails, re-show the old group and delete the new — instant local revert
   without touching history.
4. **One region per revision.** Never batch two regions into a single unsaved editing burst; each
   region is independently revertible only if it's its own checkpoint.
5. **Symmetric-pair safety.** Because arms and legs are done one side at a time, a failed side can
   always be compared against — and reverted to match — the still-original opposite side.
6. **Retirement is deferred, explicit, and last.** Old paths/groups are **not** deleted at swap
   time — only after that region's test passes *and* the subsequent checkpoint is taken. Retirement
   candidates, in order they become safe to delete:
   - old neck shapes → after step 1 passes
   - old torso / pelvis / sash fragment sets → after step 4 + "core-torso-done"
   - old `arm-L` (20 frags) + old hand-L → after "left-arm-done"
   - old `arm-R` (20 frags) + old hand-R → after "arms-done"
   - old `leg-L` / `leg-R` fragment sets → after "legs-done"
   - old `head`/`Face`/`Hair_Back_`/`Bandana_*`/`bandana_tie_*` fragments → after "head-done"
   - Final sweep: only once "reskin-v1-complete" is validated across all ten animations.

**Absolute constraints during migration (restating the spec §8 mandate):** do not add or move
bones; do not touch the leg IK constraints or `ik-target-*` nodes; do not edit any keyframe; do not
alter the state machine or the `ronin-travel`/`ronin-scale`/`ronin-anchor` transform chain. A reskin
that can't attach to the existing bone is a flagged exception to raise with the user — not a licence
to restructure the rig.

---

## 6. Execution readiness checklist (for the day we start)

**Gate — all three required before step 0; execution stays paused until then:**
- [ ] New production asset set **generated** (PNG sheet vectorised per spec §6, correct hidden overlap baked in, leg/boot drawn upgrade-ready per §2.8.3).
- [ ] Asset set **independently reviewed**.
- [ ] Asset set **approved**.

**Then:**
- [ ] New production PNG sheet generated and vectorised per spec §6 (correct hidden overlap baked in).
- [ ] `RONIN RIG 1` re-inspected (`get_artboard_hierarchy`) and IDs re-confirmed vs §1.
- [ ] Editor in **Design Mode** (not Animate — structural edits silently become keys otherwise).
- [ ] Pre-flight backup copy made (§5.1); baseline revision noted (§5.2).
- [ ] Proceed region-by-region in §4 order; test + checkpoint after each; retire old art only per §5.6.
