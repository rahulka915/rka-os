# Ronin + Cat Rive Rig Notes

## Import source

Import `ronin-cat-walk-rive-source.svg` into a 1255 × 1255 Rive artboard. The SVG is transparent and its original paint order is intentional.

Do not flatten or automatically reorder its nested groups. Illustrator generated several shapes by shared paint/style rather than anatomy, so reordering them can change overlaps around the robe, arms and legs.

## What is already separate

- Ronin rear boot
- Ronin sword
- Ronin backpack
- Ronin hair and bandana branch
- Cat tail and tail stripes

The Ronin's remaining body and the cat's body/head/legs are still fused by paint order. Prefer mesh/bone deformation for a first prototype. Split those paths manually only if the deformation cannot produce a clean walk.

## Suggested bone hierarchy

```text
Scene Root
├── Ronin Root
│   ├── Torso
│   │   ├── Head
│   │   ├── Rear Arm → Forearm → Hand
│   │   └── Front Arm → Forearm → Hand
│   ├── Rear Thigh → Shin → Boot
│   └── Front Thigh → Shin → Boot
└── Cat Root
    ├── Body → Head
    ├── Tail
    ├── Rear Legs
    └── Front Legs
```

Suggested joint coordinates are recorded in `ronin-cat-walk-rive-source.manifest.json`. They are starting points in the SVG's 1255-square coordinate space and must be visually checked after import.

## Authored Rive file state (2026-08-03)

The cloud Rive file is named `RKA Journey Rig` (editor file `2478489`). It now contains:

- Bound and auto-weighted Ronin spine, arm, leg and sword chains
- Bound and auto-weighted cat spine, tail and leg chains
- Separate backpack, bandana/hair, sword and rear-boot attachments
- A looping `Idle` animation with torso breathing and cat-tail motion
- A looping `Walk` animation with alternating Ronin legs, torso movement and cat-tail motion
- The default `State Machine 1`, entering the looping `Walk` animation

The valid runtime export is checked in at `assets/rka_journey_rig.riv` and is mounted by `src/components/home/RoninJourneyRiveWalker.tsx`. The existing PNG walker is retained only as a loading/error fallback.

## Current runtime contract

- State Machine: `State Machine 1`
- Entry state: `Walk`
- Animations: `Idle`, `Walk`
- Inputs: none in the first runtime export
- Path progress, haptic tap reactions and reduced-motion pacing remain owned by `RoninJourneyPrototype.tsx` so the whole journey card stays interactive without coupling those app concerns to the character rig.

Keep both normal and reduced-motion states alive. Reduced motion should use slower breathing, blinking and gentle positional movement rather than a static character.
