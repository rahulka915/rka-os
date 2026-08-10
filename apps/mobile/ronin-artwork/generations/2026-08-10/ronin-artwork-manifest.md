# Ronin production artwork — Generation 4 manifest

Source contact sheet: `ronin-production-artwork-gen3.png`.

Face reference used: `ronin-face-gen2.png`.

Approved face asset going forward: `ronin-face-gen2.png` replaces `ronin-face-gen1.png` for face identity and facial proportions.

The existing Rive file was not modified.

## Packaging

All files below are transparent RGBA PNGs in the same project directory as this manifest. Structural bases are kept as continuous shapes with joint/garment overlap retained in the source design; overlays remain separate files and are not merged into those bases. The standalone `pelvis-body.png` was generated separately because Gen 3 did not contain a sufficiently clear independent pelvis-body asset.

## Files

### Structural deformation bases — hidden overlap retained

- `arm-L-base.png` — continuous shoulder-to-wrist base; shoulder, elbow, and wrist overlap retained.
- `arm-R-base.png` — continuous shoulder-to-wrist base; shoulder, elbow, and wrist overlap retained.
- `neck.png` — full neck column extending behind jaw and into shoulders.
- `torso-body.png` — continuous torso body extending behind sash and arm slots.
- `pelvis-body.png` — standalone continuous lower-garment/hip/seat base extending behind sash, up behind torso, and down behind leg tops.
- `leg-L-base.png` — continuous hip-to-ankle leg base with hip, knee, and ankle overlap.
- `leg-R-base.png` — continuous hip-to-ankle leg base with hip, knee, and ankle overlap.
- `head-base.png` — continuous skull/face backing shape.

### Garment and rig overlays — separate files

- `sleeve-L.png`
- `sleeve-R.png`
- `wristwrap-L.png`
- `wristwrap-R.png`
- `trouser-L.png`
- `trouser-R.png`
- `shinband-L.png`
- `shinband-R.png`
- `collar.png`
- `sash-band.png`
- `sash-knot.png`
- `sash-tail-1.png`
- `sash-tail-2.png`
- `boot-L.png`
- `boot-R.png`
- `hand-L.png`
- `hand-R.png`

### Head, face, and hair pieces — separate files

- `hair-mass.png`
- `hair-tip-1.png`
- `hair-tip-2.png`
- `hair-tip-3.png`
- `hair-tip-4.png`
- `bandana-band.png`
- `bandana-tail-A.png`
- `bandana-tail-B.png`
- `eye-L-white.png`
- `eye-L-iris.png`
- `eye-L-lid.png`
- `eye-R-white.png`
- `eye-R-iris.png`
- `eye-R-lid.png`
- `brows.png`
- `nose.png`
- `mouth.png`

## Notes

- The contact sheet remains available as the visual reference; it is not the only deliverable.
- No structural base is intentionally sliced at the elbow, knee, shoulder, wrist, neck, torso/sash, or pelvis/leg boundary.
- These PNGs are raster production references for the PNG → Illustrator → SVG → Rive workflow; vector cleanup and final Rive reskinning remain separate steps.
