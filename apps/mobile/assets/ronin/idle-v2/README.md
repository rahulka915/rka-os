# Ronin idle-v2 runtime frames

This directory is the runtime-only PNG library for Ronin's expanded idle clips. It must contain exactly these 52 transparent 640×640 RGBA PNGs:

- `calm-01.png` through `calm-08.png`
- `look-around-01.png` through `look-around-08.png`
- `blink-dip-01.png` through `blink-dip-06.png`
- `yawn-01.png` through `yawn-10.png`
- `adjust-wrap-01.png` through `adjust-wrap-10.png`
- `shoulder-stretch-01.png` through `shoulder-stretch-10.png`

Use `../reference/animation-master-v1/canonical/ronin-balanced-canonical-v1.png` as the immutable character-identity source and `../reference/animation-master-v1/canonical/real-trishul-om-pendant-reference.jpg` for pendant geometry only. The canvas geometry is locked by `../reference/animation-master-v1/templates/canvas-contract.json`: a 640×640 canvas, fixed root, 580px ground baseline, scale, and safety padding.

Every frame preserves the approved warm medium-deep South Asian skin tone, rounded face, hair macro-clumps, navy/red/leather/silver/brass/charcoal palette, one sheathed katana, charcoal utility bag, backpack with spiral bedroll, boots, fixed wrap sides, one rudraksha bracelet, exactly two silver rings, and the small vertical silver Trishul–Om hybrid pendant. The pendant must never become a plain Om, trident, cross, or oversized emblem.

Before a clip enters this directory, validate it with `node scripts/validate-ronin-idle-assets.mjs`, inspect an animated preview and contact sheet at 120 points, and obtain visual approval. Check face and texture stability, silhouette, skin tone, pendant/ring/bracelet counts, wrap sides, bag/backpack/sword retention, transparent background, foot anchor, and neutral start/end frames. Keep generated originals and rejected studies outside this runtime directory; do not load them in the app.

Generate future extraction sheets on a uniform saturated chroma-green background rather than transparency or a checkerboard. Preserve approved green originals under `review/approved-green/`, key the green before scaling, remove residual green spill from edge RGB, and inspect extracted frames composited over black, white, and magenta. A frame is not approved if any pale matte or chroma fringe remains around hair, boots, clothing, weapons, or accessories.

During the first three-clip pass, use `node scripts/validate-ronin-idle-assets.mjs --allow-missing-specials`. That option permits only the not-yet-produced `yawn`, `adjust-wrap`, and `shoulder-stretch` frames; it does not relax any validation for frames that exist.
