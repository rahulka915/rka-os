# Ronin — Production Artwork Specification v1

**Canonical source of truth for the front-facing storybook Ronin artwork replacement.**
Companion to [`RONIN_RIVE.md`](RONIN_RIVE.md) (the rig artefact) and the
`rive-character-rigging` skill `LEARNING-LOG.md` (technique). This file describes **what the new
artwork must contain and how it must be constructed** so it drops onto the existing skeleton as a
reskin rather than a rebuild.

- Created: 2026-08-10
- Status: **v1 — approved for generation.** Supersedes all in-chat drafts and corrections.
- Visual target: the storybook Ronin reference (NOT CATCAT aesthetically). CATCAT remains only a
  methodology reference for how organic/alive the final rig should feel.
- **This spec does not modify the Rive file.** It governs PNG generation → vectorisation →
  reskinning, all of which happen later.

> **Note on this document:** the arm and leg guidance below is the *single current* version.
> An earlier draft described the arm as "one visible sleeve shoulder→wrist" — that interpretation
> has been **removed**, not appended to. Do not reintroduce it. See §4.

---

## 1. Design principle: preserve the working baseline

The current Rive file is the **working functional baseline**. Tap-to-walk, stations, travel, the
state machine, ViewModel architecture, the skeleton, and leg IK are systems we **preserve**. The
new artwork is designed *around* the existing skeleton and must not force changes to bones,
constraints, or the state machine unless a piece genuinely cannot be reskinned otherwise.

**Compatibility requirement:** every asset below maps to an existing bone or existing art group.
The new art reskins the rig in place. No new bones, springs, meshes, IK, or state-machine changes
are authorised by this document — those are separate, later decisions.

---

## 2. Verified existing rig/skeleton constraints (design around these)

Skeleton under `ronin-anchor → ronin-v3-parts` (all `RootBone`/`Tendon`, verified from the scene
graph). **Preserve exactly.**

```
bone-pelvis
├─ bone-spine → bone-chest → bone-neck → bone-head
├─ bone-L-clav → bone-L-upperarm → bone-L-forearm → bone-L-hand
├─ bone-R-clav → bone-R-upperarm → bone-R-forearm → bone-R-hand
├─ bone-L-thigh → bone-L-shin → bone-L-foot   (+ ik-target-L-foot)
└─ bone-R-thigh → bone-R-shin → bone-R-foot   (+ ik-target-R-foot)
```

Transform parents (leave alone): `ronin-travel` (x/y ← characterX/Y), `ronin-scale`
(sx/sy ← depthScale), `ronin-anchor`. Plus `click-probe` and the station/floor/ball layout
components — all outside the character, do not touch.

**How the current art is built (measured), and the verdict driving the replacement:**

| Region | Shapes | Bound how | Verdict |
|---|---|---|---|
| torso | 30 | **Rigid** to `bone-chest` | Can't breathe/lean — upgrade |
| pelvis | 26 | **Rigid** to `bone-pelvis` | Rigid — upgrade |
| head | 112 | **Rigid** to `bone-head` | Pile of rigid fragments |
| ├ Face | 30 | rigid | No blink/gaze separation |
| ├ Hair_Back_ | 10 | rigid | No secondary motion |
| ├ Bandana_Front_ | 10 | rigid | — |
| ├ bandana_tie_1_/_2 | 22/12 | rigid | Tails can't swing |
| neck | **2** | rigid to `bone-neck` | **Almost no geometry — upgrade** |
| arm-L / arm-R | 20 / 20 | **Meshed**, each fragment skinned to upperarm+forearm | **Ghost-elbow — rebuild** |
| leg-L / leg-R | 25 / 25 | **Meshed**, skinned to thigh+shin | Works with IK — keep pattern |
| hand-L / hand-R | 25 / 25 | rigid to hand bone | Fine as rigid — consolidate |
| boot-L / boot-R | 15 / 15 | rigid to foot bone | Fine as rigid — consolidate |
| sash | 34 | rigid to `bone-pelvis` | No tail secondary motion |

**Two root-cause findings that drive the arm rebuild (both must be fixed):**

1. **Fragmentation.** Each arm is ~20 separate vector fragments, each independently skinned across
   both upper-arm and forearm. At the elbow, 20 independently-interpolated skins slide apart →
   seam separation ("ghost elbow"). Fix: one continuous deformable base, not many skinned slivers.
2. **Defective weighting (not just fragmentation).** The earlier audit sampled the arm skins and
   found **upper-arm bone influence = 0 vertices** on the checked shapes — the weights themselves
   were genuinely broken. Fix: the new arm base must be **freshly bound and weighted**, with
   verified non-zero `upperarm` influence across the shoulder/elbow span. Reusing or trusting the
   old weights is not acceptable even after consolidation.

The **legs are the good pattern**: continuous-enough geometry skinned across thigh+shin, working
cleanly with the existing IK. Match the legs' approach for the arms; copy the arms' approach nowhere.

---

## 3. Core construction rule: structural base vs. visible artwork

The single most important rule for this replacement:

> **Deformation lives in a continuous structural base shape. Visible garment/detail pieces are
> separate overlay shapes that are weighted to follow that base — they are never sliced into the
> base mesh, and they never each carry their own joint-spanning skin.**

- **Structural base** = one continuous shape per limb/region that carries the mesh and the bone
  skin. Drawn to full extent *including hidden overlap zones*, even where it will never be seen.
- **Visible overlay** = sleeves, wraps, trousers, cuffs, collars, shading, folds. Separate shapes
  weighted to the same bones so they ride the base's deformation.
- **Decorative shading follows structure.** Fold shadows, weave shadows, highlights, blush are
  overlay layers stacked on their parent structural shape — never cut into it.

"Continuous" refers to the **deformation substrate**, not the visible silhouette. A limb can look
banded (sleeve / bare / wrap) while deforming as one smooth mesh underneath.

---

## 4. Asset specification (per region)

Class key: **[1:1]** replace as-is · **[UPGRADE]** same rig region, reconstruct for deformation ·
**[NEW]** doesn't exist separately but should · **[KEEP]** current construction already correct.

### 4.1 Head & neck

| Asset | Rig relationship | New geometry | Hidden overlap | Deformation | Rigid/Skinned | Class |
|---|---|---|---|---|---|---|
| Neck | `bone-neck` (currently 2 shapes) | Full neck column as **one shape**; top rounded to sit inside jaw, bottom flaring into shoulders | Extend **up behind jaw/chin** and **down behind collar & shoulders** — ~25–30% taller than the visible sliver | Tilt/turn | **Skinned** `bone-neck` (+`bone-chest` at base) | UPGRADE |
| Head base (skull/face mass) | `bone-head` | One continuous skin-tone head/skull backing shape | Bottom overlaps behind neck top; sides extend under hair | Subtle head-turn later | Rigid to `bone-head` (single shape enables later squash) | UPGRADE |
| Eye set L / R | inside `Face` | Per eye: **eye-white + iris + upper-lid** as distinct pieces | Upper lid overlaps top of eye-white in open pose (blink has travel room) | Blink/gaze later | Rigid now; separation only | UPGRADE (minimal) |
| Brows / nose / mouth | inside `Face` | Flat, on their own layer above head base | Sit on top of head base; no slicing into it | None yet | Rigid | KEEP |
| Hair — main mass | `Hair_Back_` + front | One continuous hair silhouette (front + crown) | Overlaps behind head base all around hairline | Wobble later | Rigid now (one shape) | UPGRADE |
| Hair — fringe/spikes (2–4) | rides `bone-head` | 2–4 outermost spikes as separate tip shapes | Each tip root buried ~30% into the main mass | Independent secondary motion later | Rigid now; separate | NEW |
| Bandana band (front) | `bone-head` | 1:1 forehead wrap | Ends tuck under hair sides | — | Rigid | 1:1 |
| Bandana tail A / B | rides `bone-head` | Each tail as one clean tapering shape (not fragmented) | Root overlaps under the band knot | Independent secondary motion later | Rigid now; separate overlay | UPGRADE / NEW-independent |

### 4.2 Torso & garment

| Asset | Rig relationship | New geometry | Hidden overlap | Deformation | Rigid/Skinned | Class |
|---|---|---|---|---|---|---|
| Torso body (haori) | `bone-chest` (currently rigid, 30 shapes) | **One continuous garment body** chest→waist; shading as overlay on top | Extends **behind the sash** (full belly) and **behind both upper arms** at shoulders | Breathe / lean / shoulder | **Skinned** across `bone-spine`+`bone-chest` | UPGRADE |
| Collar / lapels | part of torso | Overlay shapes on top of torso body | Overlap neck base and torso top | Follows torso skin | Overlay (follows) | KEEP |
| Pelvis / lower garment | `bone-pelvis` (rigid, 26 shapes) | One continuous lower-garment shape (hips/seat) | Extends **behind sash** and **up behind torso body** (torso overlaps pelvis) | Subtle hip | **Skinned** `bone-pelvis` (+`bone-spine`) | UPGRADE |
| Sash band | `bone-pelvis` (rigid, 34 shapes) | One continuous wrap + separate knot | Wraps over torso/pelvis seam (hides join); knot overlaps band | — | Rigid/skin to pelvis | UPGRADE (consolidate) |
| Sash tail(s) 1–2 | rides `bone-pelvis` | Separate tapering tail shape(s) from the knot | Root buried under the knot | Independent secondary motion later | Overlay; separate | NEW |

### 4.3 Arms — structural base + visible bands (see §3)

The final arm reads as three visible bands: **short navy sleeve → exposed brown forearm → red
wrist wrap**. The elbow bend lives entirely in a continuous brown **arm base**; the sleeve and
wrist wrap are passengers.

| Asset | Rig relationship | New geometry | Hidden overlap | Deformation | Rigid/Skinned | Class |
|---|---|---|---|---|---|---|
| Arm base L / R (brown) | `bone-{L,R}-upperarm` + `bone-{L,R}-forearm` | **ONE continuous brown arm shape shoulder→wrist** — carries the mesh | Shoulder under torso/haori; generous elbow; wrist under hand | Single-mesh elbow bend | **Skinned** across upperarm+forearm — **freshly bound, verified non-zero upperarm influence** | UPGRADE (top priority) |
| Navy short sleeve L / R | rides `upperarm` (+`forearm` at hem) | Separate short upper-sleeve shape | Top under haori shoulder; hem overlaps base | Rides base | Overlay weighted to same bones | NEW overlay |
| Wrist wrap L / R (red) | rides `forearm`/`hand` seam | Separate cuff shape | Overlaps forearm base + hand wrist | Rides base | Overlay weighted to same bones | NEW overlay |
| Hand L / R | `bone-{L,R}-hand` (rigid, 25 shapes) | Consolidate to one hand shape (+ thumb) | Wrist end overlaps under forearm base/cuff | — | Rigid to hand bone | UPGRADE→KEEP-rigid |

The exposed brown mid-forearm is simply the arm base showing through between sleeve hem and wrist
wrap. The sleeve and wrap do **not** each carry an independent elbow-spanning skin.

### 4.4 Legs — structural base + visible bands where applicable (see §3)

Apply the same base/overlay split **only where the final leg is banded** (e.g. navy trouser vs.
exposed shin/sock vs. boot cuff). Where the leg is a single uninterrupted trouser to the boot, the
existing continuous construction already satisfies §3 — keep it.

| Asset | Rig relationship | New geometry | Hidden overlap | Deformation | Rigid/Skinned | Class |
|---|---|---|---|---|---|---|
| Leg base L / R | `bone-{L,R}-thigh` + `bone-{L,R}-shin` | Prefer **one continuous leg shape** thigh→ankle | Hip under pelvis/sash; knee overlap; ankle under boot | Single-mesh knee bend, matches IK | **Skinned** across thigh+shin | KEEP (or gentle UPGRADE to fewer fragments) |
| Trouser overlay L / R (navy) | rides thigh (+shin at hem) | Separate trouser shape — **only if leg is banded** | Waist under pelvis/sash; hem overlaps base | Rides base | Overlay weighted to same bones | NEW overlay (conditional) |
| Shin/cuff band L / R | rides shin/foot seam | Separate band — **only if present in final art** | Overlaps leg base + boot top | Rides base | Overlay weighted to same bones | NEW overlay (conditional) |
| Boot L / R | `bone-{L,R}-foot` (rigid, 15 shapes) | Consolidate to one boot shape | Top overlaps under shin/trouser cuff | — | Rigid to foot bone | UPGRADE→KEEP-rigid |

---

## 5. Rigid vs. skinned vs. overlay — summary

- **Skinned structural bases (carry the mesh):** neck, torso body, pelvis/lower garment, arm base
  L/R, leg base L/R. Freshly bound and weighted.
- **Rigid (parented to one bone, no deformation):** head base, brows/nose/mouth, eyes (for now),
  hair mass/tips (for now), bandana band, hand L/R, boot L/R.
- **Overlays (separate shapes weighted to follow a base — never sliced into it):** collar/lapels,
  navy sleeves, wrist wraps, trouser overlays, shin/cuff bands, sash band/knot/tails, bandana
  tails, all decorative shading/fold/highlight/shadow layers.
- **Deliberately staying separate (independent movement):** hair fringe tips, both bandana tails,
  sash tails, each hand, each boot, the eye lid/iris pieces.
- **Deliberately NOT sliced:** haori fold shadows, sash weave shadows, boot highlights, cheek
  blush, hair strand highlights — these ride their parent structural shape.

---

## 6. PNG → Illustrator Concept-to-Vector → SVG → Rive requirements

Generate the new **front-facing storybook Ronin** as a flat, front-on, symmetric, neutral pose
(arms slightly out from the body so shoulder/underarm overlap is drawable). Every piece is a
**separate, individually-exportable layer**, drawn to its **full extent including hidden/overlap
zones** — do not trim to the visible silhouette or deformation headroom is lost.

**Head & face**
1. Head/skull base — full oval, bottom extends down into neck zone
2. Neck column — full cylinder, taller than looks necessary (top into jaw, bottom into shoulders)
3. Left eye set — eye-white, iris, upper lid (3 separable pieces; lid overlapping white)
4. Right eye set — same, 3 pieces
5. Brows (one piece ok), nose, mouth — flat, on top
6. Hair main mass — one continuous silhouette, overlapping behind the skull hairline
7. Hair fringe tips — 2–4 separate spikes, each root buried into the mass
8. Bandana band (forehead wrap)
9. Bandana tail A, Bandana tail B — separate, roots under the knot

**Torso & garment**
10. Torso/haori body — one continuous shape, down past the sash line (full belly) and out past
    both shoulders so upper-arms slot behind
11. Collar/lapel overlay
12. Pelvis/lower garment — one continuous shape, up behind the torso and behind the sash
13. Sash wrap band — one continuous piece over the torso/pelvis seam
14. Sash knot
15. Sash tail(s) — 1–2 separate hanging pieces, roots under the knot

**Arms (structural base + bands)**
16. L arm base (brown) — continuous shoulder→wrist, full hidden overlap; drawn in full even where
    hidden under the sleeve
17. R arm base — same
18. L navy short sleeve — separate, hem overlapping the base
19. R navy short sleeve — same
20. L red wrist wrap — separate cuff, overlapping base + hand
21. R red wrist wrap — same
22. L hand — one shape (+ thumb), wrist end extended under forearm base/cuff
23. R hand — same

**Legs (structural base + conditional bands)**
24. L leg base — thigh→ankle, hip under pelvis/sash, ankle under boot (one continuous shape preferred)
25. R leg base — same
26. L navy trouser overlay — separate, hem overlapping base — *only if the final leg is banded*
27. R navy trouser overlay — same — *only if banded*
28. L shin/cuff band — separate — *only if present in final art*
29. R shin/cuff band — same — *only if present*
30. L boot — one shape, top extended under trouser cuff
31. R boot — same

**Global sheet rules**
- Perfectly front-facing, symmetric, neutral pose; arms slightly out from body.
- Every structural piece drawn to full extent **including hidden overlap zones**.
- Decorative shading exported as its own overlay layers per region — never merged into or slicing
  the structural shape.
- Consistent, riggable layer names (see §7).
- One vectorisation per piece: PNG → Illustrator Concept-to-Vector → SVG → Rive. Correct hidden
  geometry must be baked in before vectorisation so each piece is created once.

---

## 7. Naming recommendations (match the existing rig)

Use bone-aligned, side-suffixed, consistent-casing names so pieces map cleanly onto the skeleton:

```
neck
head-base
eye-L-white / eye-L-iris / eye-L-lid      (and eye-R-*)
brows / nose / mouth
hair-mass
hair-tip-1 … hair-tip-n
bandana-band
bandana-tail-A / bandana-tail-B
torso-body
collar
pelvis-body
sash-band / sash-knot / sash-tail-1 [ / sash-tail-2 ]
arm-L-base / arm-R-base
sleeve-L / sleeve-R
wristwrap-L / wristwrap-R
hand-L / hand-R
leg-L-base / leg-R-base
trouser-L / trouser-R            (only if banded)
shinband-L / shinband-R         (only if present)
boot-L / boot-R
```

Structural bases skin to the matching bones: `arm-*-base` → `bone-*-upperarm`+`bone-*-forearm`;
`leg-*-base` → `bone-*-thigh`+`bone-*-shin`; `neck` → `bone-neck`(+`bone-chest`); `torso-body` →
`bone-spine`+`bone-chest`; `pelvis-body` → `bone-pelvis`(+`bone-spine`). Overlays weight to the
same bones as the base they ride.

---

## 8. Compatibility mandate

The new artwork must preserve compatibility with the existing working skeleton, leg IK, and state
machine wherever possible. Every asset maps to an existing bone or art group; the goal is a
**reskin in place**, not a rebuild. No bones, springs, meshes, IK, or state-machine changes are
authorised by this document. If any final asset cannot be reskinned onto the current rig, that is
a flagged exception to raise with the user before generation — not a licence to restructure the
rig.
