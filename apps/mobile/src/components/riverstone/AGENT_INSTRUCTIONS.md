# Instructions for Claude, Codex, and Future Agents

Use the River Stone source files as the implementation reference for surface material.

Do not reinterpret the material from screenshots unless explicitly instructed.

## Preserve

- layout
- dimensions
- spacing
- typography
- iconography
- illustrations
- interactions
- navigation
- data flow
- responsive behaviour

## Apply

- shared material tokens
- shared depth hierarchy
- layered upper lighting
- lower-edge weight
- contact shadow
- ambient shadow
- discontinuous edge catch

## Do not add

- bright full silver outlines
- hard horizontal tonal splits
- obvious glossy gradients
- glass effects
- metallic effects
- texture
- grain
- marble
- raster surface images
- irregular blob geometry

## Do not duplicate

Do not recreate River Stone effects separately inside individual components.

Use:

- `RiverStoneSurface`
- `RiverStonePressable`
- shared tokens
- shared material functions

## Status

This is a candidate material implementation pending final in-app visual approval.
