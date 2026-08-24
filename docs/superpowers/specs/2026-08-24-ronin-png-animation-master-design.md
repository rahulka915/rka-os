# Ronin PNG Animation Master Design

**Date:** 2026-08-24  
**Status:** Proposed for user review  
**Scope:** Canonical Ronin identity references, generated PNG animation sheets, frame processing, runtime presentation, and visual QA

## Outcome

Create a production reference system that lets the approved balanced Ronin be recreated across simple PNG animation sheets without losing his identity, drifting between frames, or accumulating generation artefacts.

The polished portrait remains the high-detail identity reference. A separate animation master preserves the same character while simplifying details that are unstable or unreadable at the app's actual 120-point display size.

## Current Runtime

The Home journey already renders PNG flipbooks through `RoninWalkCycleSprite` at 120 points:

| State | Frames | Playback |
|---|---:|---|
| Walk | 8 | Loop, 83 ms/frame |
| Idle calm | 8 | Loop, 420 ms/frame |
| Idle alert | 8 | Loop, 420 ms/frame |
| Bow/tap reaction | 6 | Once, 90 ms/frame |
| Jump | 6 | Once, 90 ms/frame |

The existing builder sizes each action from its largest pose and aligns frames from the top of the head. This design replaces that behaviour for new production assets so state changes cannot alter apparent scale, footing, or root position.

## Source-of-Truth Hierarchy

1. **Approved balanced canonical portrait** — `RONIN CHARACTER REFERENCE 16:08:2026/CANONICAL RONIN BALANCED CLEAN REGENERATION 24-08-2026.png`; authoritative for identity, face balance, costume, colours, equipment, and finish.
2. **Real pendant photograph** — authoritative only for the Trishul–Om hybrid's geometry.
3. **Animation master and production sheets** — authoritative for simplified, repeatable frame construction.
4. **Existing sprite frames** — motion and timing references only.

The portrait is never overwritten or flattened into an animation frame. Generated originals remain preserved. Replacement sprites are staged alongside current assets until approved in motion.

## Character Identity Lock

Every frame preserves:

- South Asian boy Ronin with warm medium-to-deep brown skin.
- Balanced chibi face: rounded cheeks and large round eyes, without the youngest mascot exaggeration.
- Voluminous black hair with irregular silhouette and layered macro-clumps.
- Red forehead bandana with two asymmetric tails.
- Dark navy wrap outfit and trousers with red waist sash.
- Sword-side arm: red forearm wrap and black fingerless glove.
- Jewellery-side arm: cream/charcoal wrap, one rudraksha bracelet, exactly two silver rings.
- Small silver Trishul–Om hybrid pendant matching the real pendant's vertical trident-and-Om construction—not a plain Om, trident, cross, or oversized emblem.
- Charcoal drawstring utility bag on the jewellery side.
- Brown backpack with spiral-ended bedroll.
- One sheathed katana with black/red diamond grip and antique-brass guard.
- Chunky black leather boots.

References label sides as **character-left** and **character-right**, never screen-left/right.

## Animation Master Simplification

The master is a clean redraw derived from the portrait, not a lower-quality resize.

- **Face:** lock one head shape, feature placement, iris size, and palette. Use one stable shadow region and restrained cheek warmth; remove flickering skin texture.
- **Hair:** preserve outer silhouette and volume; resolve into 10–12 named macro-clumps, each with at most one stable light/shadow accent. Do not regenerate micro-strands per frame.
- **Clothing:** flat navy base plus two repeatable shadow families—overlap and lower-form shadows. Keep only silhouette- or construction-defining seams/folds.
- **Bandana/sash:** fixed tail shapes, length, taper, side assignment, and overlap order except when deliberately animated.
- **Accessories:** fixed visible bracelet bead count by view; exactly two ring bands; fixed sword diamond count and guard geometry; stable bag cords/beads; simplified boots without micro-stitching or variable shine.

## Universal Frame Geometry

All new runtime frames use:

- Transparent straight-alpha PNG.
- 640×640 canvas.
- Character scale inherited from the animation master, never independently auto-fit.
- Shared ground baseline at `y = 580`.
- Neutral pelvis/root anchor at `x = 320`, `y = 390`.
- Neutral head-top guide at `y = 72`.
- Minimum 32-pixel ordinary-action safety padding.
- Jump height expressed through displacement, never character rescaling.
- Zero-padded frame names ordered left-to-right in source sheets.

Action motion is authored relative to the shared root. Intended root displacement is stored in the action manifest rather than introduced by cropping.

## Production Reference Pack

Create before replacement actions:

1. Untouched canonical portrait archive.
2. Neutral front-three-quarter animation master on the universal canvas.
3. Turnaround: front, front-three-quarter, side, rear-three-quarter, rear at identical scale.
4. Face sheet: neutral, blink, focused, pleased, surprised, tired, determined.
5. Named palette swatches.
6. Numbered 10–12-clump hair map and overlap order.
7. Accessory sheet: pendant, bandana tails, rings, bracelet, katana, bag, backpack/bedroll, boots.
8. Filled silhouette sheet at runtime scale.
9. Canvas template with root, head, baseline, safe area, and character-side labels.

These form one versioned identity pack. Animation sheets may not silently redefine character geometry.

## Sheet Generation Workflow

1. Define view, frame count, timing, contact poses, and secondary motion.
2. Lay out every pose on the universal template.
3. Supply the complete identity pack and action layout together.
4. Generate/draw all frames as one sheet.
5. Never use one generated frame as the identity source for the next.
6. Slice without auto-scaling.
7. Apply deterministic identity overlays where generation is unreliable.
8. Run automated geometry and alpha checks.
9. Review at 120 points, full speed, frame-stepped, and onion-skinned.
10. Replace runtime imports only after side-by-side approval.

## Deterministic Detail Overlays

The initial reusable overlay library contains:

- Trishul–Om pendant: front, front-three-quarter, and side.
- Two-ring jewellery hand for approved orientations.
- Rudraksha bracelet for approved wrist orientations.
- Katana hilt and guard: side and three-quarter.

Overlays may translate, rotate, scale within documented limits, and be occluded. They inherit action lighting and must not look pasted on. Unsupported views require an approved new variant, not frame-by-frame improvisation.

## Processing Pipeline

The current slicer remains useful for extraction and optional chroma-key cleanup, but production mode must:

- Use explicit fixed 640×640 geometry.
- Preserve source pose coordinates rather than independently centring components.
- Disable per-sheet `max_dim` sizing and head-top anchoring.
- Prefer transparent source sheets; retain chroma key only for compatibility.
- Emit a manifest with canvas, frames, timing, loop mode, baseline, root, identity-pack version, and overlay versions.
- Fail instead of silently cropping, resizing, or accepting the wrong frame count.

Existing production frames remain untouched until replacements pass QA.

## Automated QA

Each action must pass:

- Exact 640×640 RGBA dimensions and meaningful transparency.
- Expected frame count and sequential names.
- No pixels outside the safety area unless explicitly permitted.
- No green spill or isolated alpha specks.
- Contact feet within baseline tolerance.
- Root and character scale within documented tolerance.
- Pendant present when chest is visible; two rings and bracelet when their surfaces are visible.
- One sword only, with stable grip and guard.

Difference reports highlight silhouette, root, and accessory changes between adjacent frames. Intentional motion remains a visual judgement.

## Visual Acceptance

- At 120 points, the character immediately reads as the approved balanced Ronin.
- The face does not drift younger, older, rounder, sharper, or more detailed.
- State changes cause no scale pops, horizontal jumps, or accidental ground changes.
- Hair, tails, sash, bag, backpack, sword, jewellery, and pendant stay attached and coherent.
- Texture does not shimmer.
- Loops close cleanly; one-shots end on their specified hold frames.
- Full-speed playback feels alive without runtime body deformation.

## Runtime and Documentation Migration

PNG flipbooks become the canonical Ronin animation approach. Implementation must:

- Keep the existing runtime state model unless a real new action requires extension.
- Add sheets through an explicit action registry rather than scattered imports.
- Retire active-rig wording in `AGENTS.md`, `apps/mobile/CLAUDE.md`, and Ronin docs.
- Mark old rig artwork as historical unless another live feature imports it.
- Verify imports before removing any dependency or asset. Rive dependency removal is a separate cleanup decision.

## Delivery Order

1. Approve this design and promote the named balanced portrait into the versioned identity pack without altering its original.
2. Build and review the identity pack at full size and 120 points.
3. Update slicer, manifest, and automated QA.
4. Regenerate idle calm as the pilot.
5. Validate identity and state transitions in Home.
6. Regenerate walk, idle alert, bow, and jump in that order.
7. Switch runtime assets action-by-action after approval.
8. Synchronize project docs and archive superseded guidance.

## Non-Goals

- No skeletal/Rive rig, mesh deformation, or runtime body-part animation.
- No automatic frame interpolation.
- No replacing the polished portrait with the simplified master.
- No broad redesign of the Home journey.
- No deletion of generated originals or current sprites during development.
