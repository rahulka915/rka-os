# Ronin — Rig Parts Brief (v3 art)

Target for regenerating the Ronin character art so it can actually be **animated**, not just
posed. Supersedes the v2 export in `apps/mobile/assets/ronin/for-rive/ronin-parts-v2/`.

Every number here is measured, not estimated — sources noted inline. Read
`RIVE_AUTOMATION_PLAYBOOK.md` §16–§22 for how they were derived.

---

## 1. Why v2 has to be replaced

v2 is a finished illustration that was cut into parts. Three measured consequences:

1. **Limbs are single contours from hip to ankle.** `leg-L6`/`leg-L20` spans y 804→1077, thigh
   through shin, as one path. No knee or elbow bend is achievable by any amount of reparenting.
2. **Path count blocks mesh deformation.** `mesh_rigging_tool.bindBones` takes **one `targetId`
   per call**. v2 lands in Rive as ~200 shapes for `head`, 35 for `leg-L`, 20 for `arm-L` — so
   weighting a part costs one call per path. This is why all seven parts were rigid-parented.
   Rigid was forced by arithmetic, not chosen.
3. **Interleaved silhouette/colour runs make draw order fragile.** Each part is one contiguous
   run of black `#0E0A0C` silhouettes followed by one run of colour fills. Moving any subset
   across a parent boundary re-interleaves them (this cost a full session).

**The donor cat, by contrast, walks because its limbs are not drawings at all.** `左手` is a
`Shape` holding a `PointsPath` with **three vertices**, a `Skin`, and a `Stroke` — no Fill.
Stroke thickness **35**, cap **round**, join **round**. The limb is a skinned noodle; the round
cap is the paw; bending is the skin dragging three vertices along the bones. It reads at any
angle because a stroked tube carries **no perspective information**.

v3 doesn't copy the noodle — it copies the property: **limbs that deform continuously instead of
articulating at a drawn joint.**

---

## 2. Construction model

Hybrid. This is the standard build for 2D game characters.

| Group | Parts | Binding | Why |
|---|---|---|---|
| **Deforming** | `arm-L`, `arm-R`, `leg-L`, `leg-R` | Mesh + weights across 3 bones | Bends to any angle, no seam, no cut edge. Baggy hakama reads as cloth, not rubber. |
| **Rigid extremities** | `hand-L`, `hand-R`, `boot-L`, `boot-R` | Rigid-parent to last bone | Carry real drawn shape; only translate + rotate. |
| **Rigid body** | `head`, `torso`, `streamers` | Rigid-parent (as now) | Unchanged from v2 behaviour. |

**11 parts total**, up from 7 — extremities split out from their limbs.

Rigid parenting is one call with zero math: `reparent_objects` **preserves the world transform**
(verified — `computedworldx/y` stayed byte-identical at 1233.2997, 616.2997 through a reparent).

---

## 3. Hard constraints

### 3.1 Path budget — the constraint that decides everything

| Part | Max paths | Notes |
|---|---|---|
| `arm-L` / `arm-R` | **4** | outline + fill + ≤2 shading |
| `leg-L` / `leg-R` | **4** | outline + fill + ≤2 shading |
| `hand-L` / `hand-R` | **6** | |
| `boot-L` / `boot-R` | **6** | |
| `torso` | **12** | sash and collar included |
| `head` | **30** | face + hair; the only part allowed detail |
| `streamers` | **6** | |
| **Total** | **≈ 90** | against v2's **558** |

To hit this in a generative pipeline: **flat two-tone fills, no gradients, no texture, no
interior detail lines, no rendered shading.** The tracer emits roughly one path per colour
region, so region count *is* path count. Consolidate same-colour paths per part with Pathfinder
Unite afterwards — works in the GUI, **silently no-ops under `executeMenuCommand`** (confirmed
twice, don't script it).

### 3.2 Pose

**A-pose, limbs clearly separated from the torso.** Arms ~30–40° out from the body, legs ~10–15°
apart. Overlapping limbs force draw-order fights and make meshing ambiguous.

Deforming limbs must be drawn **straight** — no pre-bent knee or elbow. The mesh supplies the
bend; a bend baked into the art fights the bones.

### 3.3 Joint overlap

Material must continue *into* the neighbouring part so rotation never reveals a gap. v2 measured
20–27% tuck, which was adequate for rigid parts and is **not** adequate for deformation.

| Seam | Minimum overlap |
|---|---|
| limb → torso (shoulder, hip) | **60 units** under the torso silhouette |
| boot → leg | **40 units** up under the trouser cuff |
| hand → arm | **25 units** up under the sleeve/wrist |

### 3.4 Canvas — the rule the export pipeline is unforgiving about

- **One shared artboard for all parts:** `[1151, 137, 2425, -1136]` (the current
  `Ronin-rig-source.ai` artboard). Never generate or export parts on their own artboards.
- Generate the **full body once**, then split. Per-part generation is what produced v2's four
  unrelated viewBoxes (1050×968, 934×899, 312×687, 214×533) and the whole scale mess.
- **Every exported SVG must contain a full-artboard rectangle, white fill, `opacity = 0`.**
  Scripted SVG export crops to *artwork*, not artboard (`ExportOptionsSVG` has no
  `artBoardClipping`), so without it each part exports at a different size and all shared
  coordinates are lost.
- Hidden art still exports as `display: none` **with a space** — grepping `display:none` returns
  0 and gives a false all-clear. Strip hidden art before export.

### 3.5 Naming and draw order

- SVG `id`s become Rive shape names **exactly**, so ids are the identification mechanism. Name
  parts `arm-L`, `arm-L1`, `arm-L2`… per the v2 convention.
- **Rive's children list is the reverse of SVG document order** — list index 0 = drawn last =
  front. Document order is therefore authoritative; get it right in Illustrator and Rive follows.
- Keep each part's paths **contiguous** in document order. Interleaving parts is what makes draw
  order fragile.

---

## 4. Geometry targets

Character centreline **x = 1788**. (Bbox centre 1771 is misleading — the headband streamers
extend left.) Illustrator y is negative downward.

| Landmark | y | Notes |
|---|---|---|
| top of head | +95 | |
| neck | −440 | |
| shoulder / sleeve hem | −574 | shoulder spacing **~326** |
| elbow | **−685** | midpoint of sleeve hem → hand |
| sash / hip | −700 … −756 | hip spacing **~156** |
| hand | −708 … −811 | |
| **knee** | **−880** | see §4.1 |
| trouser cuff | −945 | |
| boot top | −952 | |
| boot sole | −1090 | total height 1196.9 |

Current limb bounds for reference: `leg-L` `1617,−667 → 1805,−1090`; `leg-R`
`1792,−666 → 1961,−1091`; arms group `1549,−574 → 2030,−811`.

### 4.1 On the knee

The trousers are **baggy hakama** — there is no anatomical knee in the silhouette, and a fold
crease is already drawn near the cuff. y = −880 is where a bend should *behave* like it's
centred, not a line that must be visible. Do not draw a knee.

### 4.2 Scale into the rig

**S ≈ 0.32**, from two independent measurements that agree: shoulder spacing 101.4/326 = 0.311,
hip spacing 51.3/156 = 0.329. Cat joints (world): head base y 690, shoulders y 766
(x 1386.3 / 1487.7), hips y 885.

---

## 5. Palette

Lock to the existing Rive `Selected Colors` so v3 drops into the bound rig without a recolour:

| Hex | Use |
|---|---|
| `#0E0A0C` | outline / silhouette black |
| `#161B38` | navy gi + hakama |
| `#E89359` | skin |
| `#DB3720` | sash / headband red |
| `#AD231B` | dark red shadow |
| `#925B3E` | boot brown |
| `#401E20` | dark brown |
| `#FFFFFF` | eye whites |

Two tones per material — base + one shadow. No third tone, no gradients.

---

## 6. Acceptance checks

Run **all** of these before importing to Rive. Cheap, and each one caught a real failure before.

1. **Path count per part** is within §3.1. One `grep -c '<path'` per file.
2. **Isolate one part and render it alone** — it must show only that part, correctly placed in
   the full canvas. Stacking all parts and seeing the character reassemble is **not** sufficient:
   seven copies of the whole character also stack into the whole character (a near-miss false
   positive in an earlier session).
3. **Every file carries the opacity-0 full-artboard rect** and all files are the same dimensions.
4. **No hidden art** — grep `display: none` **with the space**.
5. **Part ids are unique and contiguous** in document order.
6. **Joint overlap** meets §3.3 — check by hiding the neighbouring part and confirming material
   continues past the seam.

---

## 7. Rive-side sequence after import

1. Import all 11 parts; confirm they arrive as vectors, not flattened rasters.
2. Rigid-parent extremities and body parts (`reparent_objects`, one call each, world transform
   preserved). Bones: `head`→`0-2238`, `torso`→`0-1279`, `streamers`→`0-5164`, arm roots `1-1`/
   `1-40`, leg roots `0-1756`/`0-1244`.
3. Mesh + weight the four deforming limbs across their 3-bone chains.
4. Pose **only** via the chain root origin (bone local x/y, keys 90/91) and the IK target Node
   x/y (keys 13/14) — all four limbs plus the spine carry an `IKConstraint` at 100%, so bone `r`
   is a **solver output**, not an input. Targets: L arm `1-69`, R arm `1-70`, L leg `0-1755`,
   R leg `0-1243`, spine `0-3393`.
5. Bones expose no world position; read `computedworldx/y` (keys 808/809) on Controller **Nodes**
   instead.

---

## 8. Known limit — state it up front

**Out-of-plane rotation is impossible in a 2D cutout rig, however well built.** Cross-legged
sitting, a true 3/4 turn, a head that turns rather than tilts — these need separately drawn art
regardless of v3. Plan them as their own assets.

What v3 *does* unlock: bending knees and elbows, walk and run cycles, crouching, sitting with
legs hanging, cloth follow-through on sash and streamers, squash and stretch, secondary motion.
