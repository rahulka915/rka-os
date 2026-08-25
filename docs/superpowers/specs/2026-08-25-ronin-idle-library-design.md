# Ronin Expanded PNG Idle Library Design

**Date:** 2026-08-25  
**Status:** Approved design; implementation not started

## Goal

Replace the almost-static calm-idle preview with a varied family of recognisable but restrained idle actions. The Ronin should feel alive at Home-screen scale while retaining the approved animation-master identity, fixed canvas, baseline, equipment, and accessory geometry.

## Production Approach

Use a hybrid workflow:

- Derive breathing, blinking, small head movement, and gentle hand sway deterministically from the approved animation master wherever the motion remains visually natural.
- Use image generation only for gestures that require genuinely new anatomy or occlusion: the yawn, wrap/sash adjustment, and shoulder stretch.
- Generate each action as a complete sheet from the approved identity pack rather than daisy-chaining frames.
- Reapply the approved pendant, rings, bracelet, katana, utility bag, and backpack references after generation when needed.
- Reject any generated sheet that introduces facial redraw shimmer, texture crawling, accessory-count drift, scale drift, or inconsistent equipment.

Fully generated animation would offer more freedom but has already shown unacceptable frame-to-frame redraw drift. Fully transformed master art would preserve identity but make the larger gestures look mechanically warped. The hybrid workflow is the approved balance.

## Idle Clips

### Calm

- Eight frames at 420 ms per frame.
- Default looping state.
- Restrained chest breathing plus gentle independent hand sway.
- Feet, root, baseline, body scale, and gaze remain fixed.
- Replaces the current 0–3 px whole-character stretch once the improved version is approved.

### Look Around

- Eight frames at 180 ms per frame. Repeat the turned-gaze drawing in consecutive frames to author the longer hold without requiring per-frame timing.
- Eyes lead, followed by a small head turn; the torso remains mostly forward.
- Returns to the exact calm-neutral pose.
- No full-body rotation and no equipment-side changes.

### Blink and Head Dip

- Six frames at 160 ms per frame.
- Slow blink with a small relaxed head dip and recovery.
- No sleepy collapse or exaggerated nod.
- Suitable for Reduce Motion playback.

### Yawn

- Ten frames at 180 ms per frame.
- Jewellery-side hand rises near the mouth, eyes close, mouth opens, then the hand returns.
- Pendant and bag remain visible and stable where not naturally occluded.
- Exactly two rings and one rudraksha bracelet remain present on the moving hand.

### Adjust Wrap or Sash

- Ten frames at 150 ms per frame.
- Sword-side hand briefly checks the opposite wrist wrap or the sash, then returns.
- The katana remains sheathed and fixed; the gesture must not read as drawing the sword.
- Hand-wrap sides and jewellery counts cannot swap.

### Shoulder Stretch

- Ten frames at 180 ms per frame.
- Restrained upper-body and shoulder stretch with secondary movement in outer hair tips, bandana tails, and sash tips.
- Backpack and sword remain worn; no travel gear is removed.
- Feet remain planted and the clip returns to calm-neutral.

## Runtime Sequencing

- Calm loops continuously between personality clips.
- After a random interval between 8 and 18 seconds, the runtime selects one eligible personality clip.
- Look-around, blink/dip, and wrap adjustment use normal selection weight.
- Yawn and shoulder stretch use lower selection weight.
- The same personality clip cannot play twice consecutively.
- Only one personality clip may run at a time.
- Every personality clip plays once, holds only where explicitly authored, and returns to the exact calm-neutral frame before calm resumes.
- Walking, bow, and jump interrupt idle cleanly and retain their existing behaviour during this phase.
- Returning from a non-idle action starts on calm-neutral rather than in the middle of a personality clip.

## Reduce Motion

- Permit calm breathing with a reduced movement envelope.
- Permit a dedicated Reduce Motion version of blink/dip that changes only the eyelids; omit the head dip.
- Disable look-around, yawn, wrap adjustment, and shoulder stretch.
- Do not replace motion with flashing, abrupt opacity changes, or faster frame timing.

## Asset and Canvas Contract

- Each production frame is a transparent 640×640 RGBA PNG.
- All clips use `animation-master-v1` and its approved measured skin tone.
- Root, safety padding, ground baseline, and head guide come from `animation-master-v1/templates/canvas-contract.json`.
- Every clip has a versioned manifest under `assets/ronin/journey-v2/` declaring frame count, timing, loop mode, canvas contract, contact frames, and overlays.
- Frames use action-specific prefixes and continuous one-based numbering.
- Generated originals and rejected studies remain preserved as source provenance and are never loaded at runtime.

## Identity Requirements

Every frame must preserve:

- the approved balanced rounded face, without making the Ronin younger or more realistic;
- warm medium-deep South Asian skin using the approved 70% A-to-B measured tone;
- stable hair macro-clumps and irregular silhouette;
- a small silver vertical Trishul–Om hybrid pendant, never a plain Om, trident, cross, or oversized emblem;
- one rudraksha bracelet and exactly two simple silver rings on the jewellery-side hand;
- correct cream/charcoal and red/black hand-wrap sides;
- one sheathed katana, the charcoal utility bag, and the backpack with spiral bedroll;
- the approved navy, red, leather, silver, brass, charcoal, and outline palette.

## Runtime Structure

Centralise sprite declarations in a Ronin sprite registry before expanding runtime selection. Each clip config contains:

- frame assets;
- default or per-frame timing;
- loop or once mode;
- selection weight;
- Reduce Motion eligibility;
- an exact neutral return frame.

A pure idle scheduler selects eligible clips from declared weights, enforces the 8–18 second window, prevents immediate repeats, and yields to walking or one-shot actions. Random selection and timing boundaries must be unit-tested independently of React rendering.

## Review and Validation

For every clip:

1. Validate dimensions, RGBA mode, filename continuity, transparency, safe area, and contact-frame baseline.
2. Produce a 120-point animated preview, full-size contact sheet, and frame-difference review.
3. Review face, hair, skin, pendant, rings, bracelet, wraps, bag, backpack, sword, boots, scale, root, and baseline.
4. Reject texture shimmer or anatomy redraw even when it is hidden at thumbnail size.
5. Obtain visual approval before adding the clip to runtime selection.

The expanded library is complete when all six clips are approved, the scheduler behaves correctly under deterministic tests, transitions show no scale or baseline pop, and the Home journey demonstrates varied personality without appearing restless.

## Rollout

1. Improve calm breathing and add hand sway.
2. Add blink/dip and look-around.
3. Add yawn, wrap adjustment, and shoulder stretch individually.
4. Centralise the registry and implement weighted scheduling.
5. Enable one clip at a time for in-app review.
6. Keep the currently committed minimal calm idle recoverable until the full library is accepted.
