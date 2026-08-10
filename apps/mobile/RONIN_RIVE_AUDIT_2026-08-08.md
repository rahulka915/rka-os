# Ronin Rive Rig — Refinement Audit

**Carried out:** 2026-08-08, 05:30 BST (Saturday), UK.
**Subject:** `RONIN RIG 1` (Rive desktop, artboard `1-8711`, 2340 × 1080).
**Scope:** Audit only — no rig objects were modified, posed, reparented, deleted or saved.
**Benchmark:** `CATCAT!!!character binding` by L.7 — used as a *methodology* benchmark for
refinement (continuous, soft, alive deformation), **not** an aesthetic target. Ronin is not to be
redesigned to look like CATCAT.

Canonical rig state lives in [`RONIN_RIVE.md`](RONIN_RIVE.md); reusable technique in the
`rive-character-rigging` skill's `LEARNING-LOG.md`. This file is a point-in-time assessment.

---

## Evidence base & confidence

- **Directly verified (live Rive MCP reads this session):** scene graph, 19-bone skeleton +
  parenting, IK constraints, art-part construction, rigid-parenting of torso/sash/pelvis/neck/boots,
  contents of the `Face` node, and **per-path skin weights** (`querySkin` on both legs and three
  arm paths).
- **Directly verified (rendered visual pass, read-only, via Rive desktop app):** joint behaviour
  across the range the existing clips reach, secondary-motion presence, idle liveliness, empty
  ambient-layer timelines.
- **Strongly inferred (prior sessions, `LEARNING-LOG.md` / `RONIN_RIVE.md`, not re-run live):**
  ViewModel property contract, data converters, state-machine transitions, clip contents.
- **Cannot determine:** side-profile joint-bend quality and behaviour beyond the current motion
  range — the existing clips are all front-facing and modest in amplitude, and testing further would
  require a temporary pose (a mutation), deliberately not done under audit-only.

---

## Audit table

| System | Current implementation | Evidence | Rating | Refinement gap |
|---|---|---|---|---|
| Artwork separation | Named part Nodes (head, Face, Hair_Back_, bandana_*, torso, sash, pelvis, neck, arm-L/R, leg-L/R, boots), each a dense stack of 13–30 illustration shapes | Live tree | **B** | Decoration is independent geometry inside each part |
| Hidden geometry / overlap | Shoulder & waist stay covered at the extremes existing clips reach — no exposed background or separation | Visual (current range) | **B** | Larger ranges (arm overhead, big head turn) untested |
| Bone hierarchy | Clean 19-bone hip-root chain | Live | **A** | Retain |
| IK / constraints | 2 shin IK → external foot targets (correct). Legs only; arms FK; no other constraints | Live | **A** legs / **C** arms | No arm IK, no aim/pole constraints |
| Meshes | Legs meshed/skinned; everything else rigid vector shapes | Skin API | **B** | One limb pair only |
| Multi-bone skinning | Legs: real 2-bone (thigh+shin), 30 verts, avg 0.80–0.87. Arms: bound to upperarm+forearm but **100% forearm, upperarm influences 0 verts** (degenerate). Foot bone unweighted. Rest rigid | Skin API (3 arm + 2 leg paths) | **B** legs / **C** arms | Arms nominally rigged but deform nowhere |
| Shoulder deformation | Arm sleeve rotates as one rigid unit from shoulder; stays attached, no gap | Visual + skin | **C** | No deformation (rigid) |
| Elbow deformation | **Ghost joint** — skeleton has the elbow, art ignores it; whole sleeve is one rigid piece shoulder→wrist | Visual + skin | **C** | Latent defect: looks rigged, deforms nowhere |
| Hip / waist | Pelvis drops in sit, body compresses, sash stays attached, no waist gap | Visual | **C/B** | No cloth follow; rigid |
| Knee deformation | Healthy skin data; no gaps/tears in walk/run. True side-profile bend quality untestable (front-facing) | Skin API + visual | **B** | Best joint on the rig; profile bend unverified |
| Torso deformation | Rigid to bone-chest; spine reserved for whole-body lean, not bend | Live | **C** | No squash/stretch/breathe |
| Clothing deformation | Sash rigid to pelvis; hakama/haori baked into rigid fragments | Live + visual | **C** | No cloth motion |
| Hair / secondary motion | Hair, bandana ties, sash **completely static** — identical silhouette frame 0 vs late idle | Visual | **C** | No bones/springs/follow-through anywhere |
| Facial rig | `Face` = static 13-shape group; face direction is a **2-frame instant art swap**, not a turn; no eyes/mouth/brow objects | Live + visual | **C** (partly **D** by shadow-ronin design) | No blink/expression/gaze |
| Gaze | None | Live + doc | **C** | No look target / head-follow |
| Breathing | Baked lightly into idle only; dedicated breathe layer state has **empty Timeline (no clip assigned)** | Visual | **C** | No live independent breathe channel |
| Animation layering | Real concurrency exists (activity + facing). breathe + all 3 idle-variation states have **empty timelines** — inert. No gaze/blink/secondary layers | Visual | **B** | Architecture present; ambient channels empty |
| Blending / transitions | Durations, exitTime arrival, separate held vs click paths, station returns | Doc (prior) | **B** | Pose resets to idle; no ambient persistence |
| State machine | Two-path locomotion, 5 stations, data-bound eased travel, depth scale, facing layer | Doc + log (prior) | **A/B** | Carries inert breathe/idle-variation/wave states |
| Data binding | `Ronin` VM (characterX/Y, depthScale, walktime, facing, gait, station, clickwalk, isWalking) + interpolating converter + toSource click-probe + 5 listeners | Doc + log | **A** | The standout |

**Rating key:** A = already sophisticated / retain · B = present, needs refinement ·
C = not currently implemented · D = not appropriate for Ronin · ? = cannot verify.

---

## Verified skin measurements (this session)

| Path | Bound bones | Weighted verts | Verdict |
|---|---|---|---|
| leg-R `1-68847` | bone-R-thigh (17 v, avg 0.868), bone-R-shin (19 v, avg 0.803) | 30 | Healthy 2-bone skin |
| leg-L `1-66864` | bone-L-thigh (17 v, avg 0.865), bone-L-shin (19 v, avg 0.805) | 30 | Healthy 2-bone skin |
| arm-R `1-66975` | bone-R-upperarm (**0 v**, influencesNothing), bone-R-forearm (8 v, 1.0) | 8 | Degenerate — forearm-only |
| arm-R `1-66986` | bone-R-upperarm (**0 v**, influencesNothing), bone-R-forearm (9 v, 1.0) | 9 | Degenerate — forearm-only |
| arm-R `1-66998` | bone-R-upperarm (**0 v**, influencesNothing), bone-R-forearm (15 v, 1.0) | 15 | Degenerate — forearm-only |
| arm-L `1-67302` | bone-L-upperarm (**0 v**, influencesNothing), bone-L-forearm (8 v, 1.0) | 8 | Degenerate — forearm-only |

Foot bones (`bone-R-foot`/`bone-L-foot`) drive no skinned vertices (known, see `RONIN_RIVE.md` §3).

---

## What we already do well — do NOT rebuild

- **Data binding / ViewModel (A).** Genuinely CATCAT-grade methodology — the character is driven
  through a structured bound model, not blind state-machine input firing.
- **State machine + eased data-bound travel + stations + depth.** Well-built and verified.
- **Bone hierarchy (A)** and **leg IK (A)** — correct, including the subtle "targets outside the
  chain" detail.
- **Leg skinning** — the one region with healthy multi-bone weights and no visual artifacts.

## Where CATCAT-level refinement would actually change Ronin

1. **Arms are the worst offender — a "ghost elbow."** Bones exist, weights are degenerate (upperarm
   drives nothing), so the whole arm is a rigid stick swinging from the shoulder. Most visible
   "assembled vector pieces" tell, and it is a **fixable re-weighting job**, not a redesign.
2. **No secondary motion at all** — hair, bandana ties, sash frozen. Biggest "aliveness" gap vs
   CATCAT; Rive springs/physics entirely unused.
3. **Idle reads as a frozen statue** — ambient breathe/idle-variation layers are empty. Authoring
   even a small breathe clip into the existing (working) layer architecture would add life cheaply.
4. **Torso / shoulder / hip are rigid** — no squash/lean-bend; would need real multi-bone skinning
   like the legs already have.
5. **Face is a static swap, not a rig** — no blink/gaze/expression. Confirm intent first; a shadowed
   kasa ronin may be deliberately impassive.

## What genuinely cannot be determined

- **Side-profile knee-bend quality** — all existing clips are front-facing, so the leg skin's bend
  *profile* can't be seen without a temporary pose or a new clip.
- **Joint behaviour beyond current motion range** — shoulder/waist hold up under existing clips, but
  a fuller range (arm overhead, large head turn) isn't exercised anywhere, so overlap generosity
  there is unproven.
