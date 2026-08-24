# Ronin Animation Master v1

This folder is the versioned identity source for all new PNG-sheet Ronin animations.

## Authority order

1. `canonical/ronin-balanced-canonical-v1.png` controls the character's identity, balanced face, costume, colours, equipment, and polished finish.
2. `canonical/real-trishul-om-pendant-reference.jpg` controls only the pendant geometry.
3. Approved animation-master sheets control the simplified, repeatable construction used in frames.
4. Older runtime sprites may inform motion and timing but cannot redefine the character.

The canonical portrait is an immutable byte-for-byte copy of the approved source. Do not edit, resize, recompress, or overwrite it. The animation master will be a separate clean derivation, not a replacement portrait.

## Locked details

- Keep the face at the approved balance: rounded and cute, without the youngest mascot exaggeration.
- Preserve 10–12 stable hair macro-clumps and the irregular outer silhouette; omit independently generated micro-strands.
- The pendant is a **small silver vertical Trishul–Om hybrid**. It is not a plain Om, plain trident, plain cross, or oversized chest emblem.
- The jewellery side has one rudraksha bracelet and exactly two simple silver rings.
- Keep one sword, fixed hand wraps, the charcoal bag on the jewellery side, and the backpack/spiral bedroll.
- Label all sides as character-left and character-right.

## Geometry

`templates/canvas-contract.json` is authoritative for all production sheets and frames: 640×640 pixels, fixed character scale, root anchor, baseline, head guide, safety padding, and 120-point review size. Production exports must preserve authored cell coordinates rather than independently fitting or centring each pose.

## Approval state

The canonical portrait and pendant source are approved inputs. All derived deliverables remain `null` in `manifest.json` until they are produced and visually approved. Existing runtime sprites stay active until their replacements pass automated validation and side-by-side motion review.
