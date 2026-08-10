# Ronin raster modular v2

Front-facing, straight-limbed A-pose pack prepared for Rive raster assembly. The arms are single shoulder-to-wrist pieces (including sleeve and cuff), and the legs are single hip-to-ankle trouser pieces. There are no thigh/knee/shin/ankle tiles and no joint-overlap patches.

The requested headline count says **17**, but the explicit list contains seven head pieces + three body + four arm + four leg pieces = **18**. This pack follows every explicit name and records the discrepancy in `manifest.json` rather than dropping a named part.

Import the transparent PNGs in `parts/` in the `assemblyOrder` from the manifest. Use `reference/assembled-front-a-pose-crop.png` only to align anchors; it is not an assembly layer. The green source sheets are retained for provenance and re-cropping.

Optional hand poses are additive and must keep the same bounds and wrist position as `hand-L.png` / `hand-R.png` so they can swap in a Solo.

## Replacement sheet

`replacements/` contains the regenerated alternatives requested after review: `torso-sleeveless.png`, `pelvis-shorts.png`, and the matched `boots-flat-nondirectional.png` pair. The original assembled figure is retained in the source sheet only as an alignment aid.
