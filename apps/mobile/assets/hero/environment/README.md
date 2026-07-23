# RKA OS Hero Environment Layers

Registered production layers based on the locked hero environment reference.

- Canvas: `1536 × 864` (16:9)
- `keyed/`: untouched registration canvases with chroma backgrounds
- `layers/`: full-canvas, alpha-cleaned RGBA PNGs
- `diagnostics/`: registered composite, guides, contact sheet, crop and state previews
- All 29 requested assets are present in both folders

The keyed originals remain untouched. `scripts/process-hero-environment.py` deterministically
rebuilds the cleaned layers and diagnostics without regenerating artwork or cropping any layer.

## Registration and crop

- Master coordinates: `1536 × 864`
- Canonical Riverstone crop: `x 0, y 96, width 1536, height 704`
- Registration source: `src/components/hero/environment/heroEnvironmentRegistration.json`
- Runtime compositor: `src/components/hero/environment/HeroEnvironment.tsx`
- Development workbench: Profile → Developer → Hero environment registration

The compositor always positions the complete registered scene behind one clipped viewport. Inbox
and focus-state assets crossfade at fixed coordinates, so state changes cannot alter composition.
The workbench can toggle or solo every layer, edit transforms and opacity, display all registration
guides, persist local overrides, and copy the merged registration JSON.

## Home integration

`RoninGreetingCard.tsx` now uses the registered compositor as its background while retaining its
existing greeting, progress, touch behaviour, Riverstone lighting and text scrims. The integration
is controlled by `EXPO_PUBLIC_HERO_ENVIRONMENT_ENABLED` and defaults to enabled. Set it to `false`
to return to the original flattened landscape immediately. The flattened image also remains beneath
the compositor during its first layout pass, preventing an empty-frame flash.

## Suggested back-to-front stack

1. `hero_clouds`
2. `hero_fuji`
3. `hero_hills`
4. `hero_far_shoreline`
5. `hero_lake`
6. `hero_near_shoreline`
7. `hero_veranda`, `hero_roof`, `hero_pillar`, `hero_floor`, `hero_steps`
8. `hero_moss`, `hero_rocks`, `hero_lantern`, `hero_bonsai`
9. Functional-object state layers
10. `hero_morning_mist` or `hero_evening_haze`
11. Weather/particle layers: rain, snow, fireflies, or falling petals

## Functional state assets

- Inbox: `hero_inbox_tray_empty`, `hero_inbox_tray_partial`, `hero_inbox_tray_full`
- Scroll: `hero_scroll`, `hero_scroll_open`
- Training: `hero_training_post`, `hero_sword_stand`
- Focus: `hero_meditation_cushion`
