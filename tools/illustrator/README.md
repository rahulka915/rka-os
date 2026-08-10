# RKA Illustrator Rig Organiser

`RKA_Rig_Organizer.jsx` creates and manages the animation-facing layer structure for the generated Ronin and cat artwork without guessing which vector paths represent each body part.

## Run it

1. Save the Illustrator document as an `.ai` file.
2. Select the complete generated Ronin and cat artwork.
3. Choose **File → Scripts → Other Script…**.
4. Select `RKA_Rig_Organizer.jsx`.
5. On first run, the script creates a hidden, locked `GENERATION_BACKUP` and the `RKA_RIG` hierarchy.

If an earlier run stopped with Illustrator error 8705 at `doc.selection = null`, dismiss the alert and run the updated script again. The backup already created by that run will be reused; do not delete it.

The organiser remains open as a modeless panel. For each listed body part:

1. Choose the part in the organiser.
2. Use Illustrator’s Group Selection or Direct Selection tool to select all of that part’s working shapes.
3. Click **Assign Selection**.

The script groups, names, moves and locks the assigned artwork, then advances to the next incomplete part.

## Safety behaviour

- The original generated artwork is duplicated into a hidden, locked backup on first run.
- Already assigned rig artwork cannot accidentally be assigned twice.
- Clipping selections require confirmation because moving incomplete clipping groups can change their appearance.
- **Unlock Current** selects an assigned group for correction.
- **Finish & Audit** lists any missing animation groups.

## Limitation

The script deliberately does not infer anatomy from coordinates or colours. If Illustrator generated one compound path spanning unrelated body parts, manually split that path before assigning it.

## Prepare an exported SVG for Rive

When Illustrator's generated artwork already contains useful vector branches, export the complete document as SVG and run:

```bash
python3 tools/illustrator/prepare_rive_svg.py \
  "Rka-OS avatar 1.svg" \
  apps/mobile/assets/ronin/for-rive/ronin-cat-walk-rive-source.svg
```

The converter keeps the original file untouched, removes the embedded raster reference and white background, crops to the vector artboard, preserves draw order, and assigns stable names to every group and path. It also writes a JSON manifest beside the cleaned SVG. Generated nested groups still need bones and constraints assigned in Rive; structural naming cannot safely infer joint pivots.
