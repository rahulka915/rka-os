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
