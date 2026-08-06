# Ronin Rig v4 — art pipeline built around the rig, not before it

**Status:** design approved, not yet implemented
**Supersedes:** the art in `ronin_master.ai` (kept on disk as an archive, not deleted)
**Related:** `apps/mobile/RONIN_RIG_PARTS_BRIEF.md`, `apps/mobile/RONIN_STATE_MACHINE_DESIGN.md`,
`apps/mobile/assets/ronin/for-rive/ronin-proxy-geometry.json`,
`~/.claude/skills/rive-character-rigging/LEARNING-LOG.md` (2026-08-06 entry)

---

## 1. Why v2 and v3 both failed

Both attempts produced a finished illustration and then tried to cut it into rig parts. The rig's
constraints never reached the thing making the art. The two failures are different symptoms of that
one cause:

- **v2** — limbs were single contours from hip to ankle. `leg-L6` spanned y 804→1077, thigh through
  shin, as one path. No knee bend was achievable by any amount of reparenting.
- **v3** — the AI-generated vector art (307 paths) was segmented at the joints, which v2 was not, but
  it carried **one unified outline path for the entire scene** (231 points, character + cat + sword +
  backpack) and **fill paths shared across rig boundaries**. The right arm above the wrist was never
  drawn as its own shape at all: the gi sleeve is merged into the body panel.

The unified outline was solvable — delete it, give each part its own stroke. Shared *fills* were not.

**v4's single organising idea: the rig geometry exists first, and every piece of art is generated
inside one part's boundary.** A generation scoped to one part cannot span a joint, cannot share a
path with a neighbour, and cannot produce a scene-wide outline, because there is no neighbour and no
scene in the input.

## 2. Document structure

New file `ronin_rig_v4.ai`. Artboard **2500 × 2500 at [0, 0, 2500, −2500]** — identical to
`ronin_master.ai`, so every coordinate in `ronin-proxy-geometry.json` transfers with no conversion.
Illustrator y is negative downward.

Three layers:

| Layer | Contents | Locked | Exported |
|---|---|---|---|
| `Reference` | approved v3 storybook PNG underlay | yes | no |
| `Proxy` | 21 A-posed blocking shapes | yes | no |
| `Ronin` | 21 named groups holding the art | no | yes |

### 2.1 The Proxy layer

Built from `ronin-proxy-geometry.json`, whose polygons are stored in **reference pose**. Rotate each
chain into A-pose using the angles recorded in the same file, about the joints recorded there:

| Chain | Pivot | Rotation |
|---|---|---|
| `arm-R-*` | 1744, −1045 | +12° |
| `arm-L-*` | 1463, −1046 | +10° |
| `leg-R-*` | 1606, −1485 | −7° |
| `leg-L-*` | 1441, −1509 | +8° |

Positive is counter-clockwise. Rotate with `transform()` and a translate→rotate→translate matrix —
`rotate()`'s `rotateAbout` only accepts bounding-box anchor presets, never an arbitrary point.

The proxies carry the joint overlaps from brief §3.3 (limb→torso 60 units, boot→leg 40, hand→arm 25).
Because every generation is bounded by its proxy, **overlap is automatic and needs no separate step.**

### 2.2 Slot names and stacking

21 slots, front to back. SVG ids become Rive shape names exactly, so these strings ship through:

```
arm-R-upper · arm-R-fore · arm-R-hand
head-bandana · head-hair-front · head-face · head-ear · head-hair-back
streamers · pelvis · torso · neck
leg-R-thigh · leg-R-shin · leg-R-foot
arm-L-upper · arm-L-fore · arm-L-hand
leg-L-thigh · leg-L-shin · leg-L-foot
```

Three rules this order encodes, all established by measurement rather than assumption:

- **`R` is the near side.** The back of the head and the pack sit at viewer-left in the reference, so
  viewer-right limbs are nearest camera and sit in front of the torso; `L` limbs sit behind it.
- **The sash (`pelvis`) goes in FRONT of the gi (`torso`).** Stacked the other way it vanishes entirely.
- Within a limb: thigh→shin→foot and upper→fore→hand, front to back, because §3.3 requires the boot to
  tuck under the trouser cuff and the hand under the sleeve.

Reserve empty `backpack` and `sword` groups in their correct stacking positions so the deferred items
don't force a restack later. Empty groups survive in `.ai` but are dropped by SVG export, which is fine
— they are placeholders, not content.

Illustrator top = SVG last = Rive index 0 = front. The order above survives both reversals unchanged.

## 3. Per-part generation

### 3.1 Primary path — scoped Generate Vectors

Show the reference dimmed, the target proxy, and any finished neighbours. Generate into that one slot.

**Unverified assumption:** that Illustrator's Generate Vectors can be scoped to a single region. If it
cannot, fall back to 3.2. This is tested on the first part, before anything is built around it.

### 3.2 Fallback — per-part PNG, then scripted Image Trace

Generate one PNG per part. Two non-negotiable properties:

1. **Full-canvas, never cropped.** Every part PNG is 2500 × 2500 with the part in its final position
   and everything else transparent, placed at exactly 0,0. Cropped per-part images are what produced
   v2's four unrelated viewBoxes (1050×968, 934×899, 312×687, 214×533) and destroyed the shared
   coordinate space. This — not per-part generation itself — is what brief §3.4 is actually warning
   about.
2. **Flat two-tone fills.** Image Trace emits roughly one path per colour region, so region count *is*
   path count. Base plus one shadow per material; no gradients, no texture, no rendered shading.

Unlike Pathfinder, Image Trace **is** scriptable (`RasterItem.trace()` then `expandTracing()`), so
trace → expand → file into slot → run gates can be automated. Verify on the first part.

### 3.3 Acceptance gates — run before accepting any part

Scripted, and all cheap:

1. Path count within that part's budget (§4).
2. Every path inside proxy bounds plus tolerance.
3. **No path bbox crosses the part's joint plane.** The v2 failure.
4. **No single path spans two slots.** The v3 failure.
5. Colours within the eight locked hex values (§5), within tolerance.
6. No scene-wide outline path; outlines are per-part strokes.
7. Traced bbox matches the proxy bbox within tolerance — catches scale and position drift.

A failure costs one regeneration of one part.

### 3.4 Style coherence

Every generation gets the same approved v3 storybook reference plus the eight locked hex values. Gate 5
catches drift immediately rather than fifteen parts later.

## 4. Path budget

| Part | Max | | Part | Max |
|---|---|---|---|---|
| `head-face` | 30 | | `torso` | 12 |
| `head-hair-back` | 14 | | `pelvis` | 8 |
| `head-hair-front` | 10 | | each hand / foot | 6 |
| `head-bandana` | 6 | | each upper / fore / thigh / shin | 4 |
| `streamers` | 6 | | `head-ear` | 6 |
| `neck` | 4 | | **total** | **≈ 152** |

For scale: v2 was 558 paths, v3 was 307 (171 on the character).

## 5. Palette — locked

| Hex | Use |
|---|---|
| `#0E0A0C` | outline / silhouette ink, and the hakama (they share a value) |
| `#161B38` | navy gi |
| `#E89359` | skin |
| `#DB3720` | sash and headband |
| `#AD231B` | dark red shadow |
| `#925B3E` | boot brown |
| `#401E20` | dark brown |
| `#FFFFFF` | eye whites |

Two tones per material — base plus one shadow. No third tone, no gradients.

Segmentation of the reference settled two things the composite never showed: **the gi is navy and the
hakama is near-black** (distinct classes, not both navy), and **the sash is far larger than a hip
capsule** — a wrapped band with a knot and hanging tails.

## 6. Build order — vertical slice first

Both prior attempts produced all the art and discovered the structure was wrong at rig time. v4 inverts
that.

**Slice:** `leg-L-thigh`, `leg-L-shin`, `leg-L-foot` only.

1. Verify per-part generation works at all (3.1, else 3.2).
2. Generate the three parts, passing all gates.
3. Export SVG.
4. Import to Rive; confirm they arrive as vectors, not flattened rasters.
5. Build the 3-bone chain; rigid-parent each part to its bone.
6. Scrub: knee and ankle articulate, no gaps open at the seams, names survived the round trip.

**Gate:** if anything about naming, draw order, overlap or export is wrong, fix the document template
before generating the other 18.

## 7. Export rules

- Hide `Reference` and `Proxy`.
- Add a **full-artboard rect, white, `opacity = 0`** — scripted SVG export crops to artwork, not
  artboard (`ExportOptionsSVG` has no `artBoardClipping`), so without it every part exports at a
  different size and all shared coordinates are lost.
- Verify: grep `display: none` **with the space** (hidden art exports that way; grepping `display:none`
  returns 0 and gives a false all-clear), unique ids, contiguous document order, one part isolated and
  rendered alone to confirm placement.

## 8. Out of scope

Backpack, sword, outfit layering, and the pet cat. The donor cat is a bipedal humanoid and is **not**
reusable as the quadruped pet — that needs its own rig later (~7–8 parts, no IK).

`meditating`, `sleeping` and `reading` are seated, out-of-plane poses. A 2D cutout rig cannot rotate
into them, so they are separately drawn art, not states blended from the walk. References exist in
`assets/ronin/reference/approved-structural-v1/`.

## 9. Hazards that must not be relearned

- **Never** call `app.documents.add()` or `close()` from ExtendScript — it closed three of the user's
  documents, two unsaved. Open by path only.
- **Never** script Pathfinder via `executeMenuCommand` — confirmed no-op twice; the grouped retry hung
  Illustrator for over two minutes. GUI only.
- Wrap every `do javascript` in `with timeout of 600 seconds`; a `d.save()` on a multi-MB `.ai`
  overruns the default AppleEvent timeout and returns error −1712 **even though the script completed**.
  Re-probe before assuming failure.
- Illustrator **silently deletes a `GroupItem` when its last child is moved out.** Re-assert every
  expected slot after any bulk move.
- **Re-probe document state at the start of any turn that deletes.** A verified, saved sort was undone
  between turns during v3 work; acting on the assumed state would have destroyed the wrong objects.
- **Render and look after every pass.** Every significant error this session — the near-side call, the
  hidden sash, the unified outline, the non-existent right sleeve — was invisible in the numbers and
  obvious in one PNG. Twice, overlap statistics pointed at conclusions the rendered geometry did not
  support.
