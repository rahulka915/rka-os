# Ronin side SVG pre-rig audit

Status: **blocked — diagnostic only, not ready to import or rig**.

## Files

- Original preserved: `apps/mobile/assets/ronin/side-view-vector-only.svg`
- Diagnostic derivative: `apps/mobile/assets/ronin/for-rive/ronin-side-rive-prep-v1-BLOCKED.svg`
- Machine-readable audit: `apps/mobile/assets/ronin/for-rive/ronin-side-rive-prep-v1.audit.json`

## Verified cleanup

- The root background rectangle was removed; the canvas renders transparent.
- The explicit `CAT` group was removed.
- No embedded raster images, filters, masks or clip paths remain.
- XML is well formed.
- Broad Illustrator buckets are honestly named with `_SOURCE`; they are not represented as finished anatomical parts.

## Hard blocker

The first direct path inside `RONIN_AND_SHARED_OUTLINES_SOURCE` is one continuous dark compound outline spanning both Ronin and cat. Removing the explicit `CAT` subtree leaves a black cat silhouette. The cat is not an independent subpath, and it overlaps the Ronin backpack/scabbard area, so coordinate clipping or masking would damage Ronin geometry.

This is an artwork-separation problem, not a Rive rigging problem. The shared outline must be split in Illustrator into independent Ronin and cat objects before a genuinely Ronin-only SVG can be produced safely.

## Riggability verdict

| Source bucket | Verdict | Reason |
| --- | --- | --- |
| `LEGS_AND_BOOTS_SOURCE` | Not riggable as independent limbs | Broad traced bucket; front/rear thigh, shin and boot are not named or proven independent. |
| `HAIR_AND_HEADBAND_SOURCE` | Not riggable for secondary motion | Hair and band/tails are mixed across nested unnamed paths. |
| `TORSO_AND_SASH_SOURCE` | Riggable only as a rigid broad unit | Torso and sash are grouped together; sash tails are not isolated. |
| `FACE_AND_FRONT_HAND_SOURCE` | Not riggable as anatomical parts | Face and hand share one source bucket. |
| `BACKPACK_SOURCE` | Candidate for rigid parenting after outline fix | Broad backpack bucket exists, but overlaps rely on shared outline geometry. |
| `BACK_HAND_AND_SWORD_SOURCE` | Not riggable independently | Hand and sword are mixed in one source bucket. |

## Required Illustrator correction

1. Duplicate the source artwork and preserve the current original.
2. Isolate the shared dark outline object that contains both characters.
3. Use direct selection/shape construction to separate the Ronin contour from the cat contour without changing the Ronin silhouette.
4. Delete all cat-only objects.
5. Split each moving Ronin part into independent named layers before export.
6. Export SVG with Styling set to **Presentation Attributes**, Object IDs set to **Layer Names**, fonts converted to outlines, images embedded, and Illustrator editing data disabled.

No skeleton should be created until a corrected export passes the visual and hierarchy audit.
