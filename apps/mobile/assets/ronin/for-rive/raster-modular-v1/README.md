# Ronin raster modular pack v1

This pack is a faster raster alternative to reconstructing the fused Illustrator contours. The files under `parts/` are transparent PNG candidates with painted overlap at the major joints.

Start with `assembly-guide.png` for the intended hierarchy, pivot locations and draw order. `contact-sheet.png` is the quickest visual inventory of the 23 cleaned parts. The exact generation brief is retained in `generation-prompts.md`.

Use `manifest.json` for back-to-front import order. Assemble the neutral side pose before adding bones, then place pivots at the painted joint openings. Start with rigid parenting; add image meshes only to cloth, hair, or sash pieces that visibly need deformation.

The `sheets/` directory preserves the generated chroma-key sources and transparent full sheets for audit and recropping. Do not import the sheets into the production Rive file.

Acceptance checks before animation:

1. Match the canonical reference silhouette at intended app display size.
2. Rotate every elbow and knee through at least 25 degrees and confirm no green fringe or open seam.
3. Confirm front/rear draw order at both walk-cycle extremes.
4. Keep the torso's concealed hip stubs behind both thighs.
5. Reject or repaint any part whose identity mismatch is visible at runtime size.

The generation used the canonical v3 side reference plus a shared style-anchor sheet. No runtime code consumes this folder yet.
