# Simplified walking Ronin avatar — design

**Status:** approved, ready for planning.
**Scope:** iOS + shared code (component lives in `src/components/`, usable by web later if desired, not required this pass).

## Context

The full-body Rive rig (`RONIN RIG CLEAN REBUILD`, tracked in `apps/mobile/RONIN_RIVE.md`) has been in a
mid-rebuild state for a long time — skeleton and arm rigging are the current frontier, legs/IK/state
machine/interactions are far off. Rather than wait for that to land, this project delivers a much
smaller, faster win: a always-in-motion, chibi-style walking Ronin sprite, reusing an existing but
currently *dormant* Home widget shell.

**This project does not touch or block the Rive rig.** `RONIN_RIVE.md` and the `RONIN RIG CLEAN REBUILD`
file remain exactly as they are, to be resumed separately later. `RoninJourneyRiveWalker.tsx` (the
`.riv`-loading component) is not deleted or modified — it's simply no longer the component called from
this one widget.

## Why a sprite flipbook instead of a rig

A continuous walk-cycle loop is a solved, low-complexity animation problem (cyclic limb swing, no IK,
no anatomical fold/sleeve deformation) — a natural fit for a sequence of hand/AI-generated frames
swapped on a timer, rather than a bone-skinned rig. This sidesteps the exact complexity (elbow/wrist
skinning, IK, deep-root overlay weighting) that has been the sticking point on the full rig.

## Visual identity

The chibi Ronin style already documented and approved across the design system —
`docs/design-system/reference/iconography.md`'s "Flat-vector chibi" row, and the approved reference art
at `apps/mobile/assets/ronin/reference/approved-storybook-v1/ronin-side-expressions.png` — is the target
style: dark spiky hair, red bandana with trailing tails, indigo/navy top, brown boots, sheathed katana,
warm skin tone, bold clean outlines, cel-shaded (not flat/palette-locked — an earlier assumption in this
project's own brainstorming that a separate "ultra-flat 6-color" prompt-library entry was the established
style was wrong; that entry documented a since-abandoned experiment, not the real direction. The actual
approved reference is shaded/illustrated chibi, matching what this project's walk-cycle sheet already
produced).

A small backpack appeared in the generated walk-cycle sheet and was not part of any prior reference —
confirmed acceptable to keep as a permanent addition to the character's look.

## Asset pipeline

Source: an 8-frame side-profile walk-cycle sprite sheet (already generated), full-body strict side
profile facing right, one full stride cycle (contact → down/recoil → passing → up/extension, mirrored
for the second leg), on a flat `#00FF00` chroma-key background.

Processing steps (one-time script, not build tooling):
1. Crop each of the 8 characters to its own bounding box.
2. Re-composite each onto a fixed-size transparent canvas, anchored at a consistent point (head-top —
   chosen because it has the least vertical bob during a stride; feet/hip position are allowed to move
   frame-to-frame, since that's real gait, not misregistration).
3. Run the existing soft-matte/despill helper (already used for other Ronin assets, see
   `docs/design-system/reference/prompt-library.md`) to clean the chroma-key edges.
4. Save as 8 numbered PNGs: `ronin-walk-01.png` … `ronin-walk-08.png`, under
   `apps/mobile/assets/ronin/journey/walk-cycle/`.
5. Verify alpha on all 8 (`sips -g hasAlpha`) and visually check edges against both a light and dark
   backdrop for fringing, per the existing project convention for new Ronin art.

If the 8-frame loop reads choppy on-device, the fallback is generating 8 more in-between frames (using
the same sheet as reference) to make it 16 — not a redesign, an additive follow-up.

## Component architecture

**New component:** `RoninWalkCycleSprite.tsx` (location: alongside `RoninJourneyRiveWalker.tsx`, i.e.
`src/components/home/`). Single responsibility: cycle through the 8 sprite frames on a loop and render
the current frame as an `<Image>`.

- Holds `frameIndex` in React state, advanced via `setInterval` inside a `useEffect` at ~12fps
  (≈83ms/frame → ~660ms per full 8-frame loop, close to the host shell's existing ~520ms bob-cycle
  timing so the two motions read as roughly the same cadence).
- Frame swapping must be plain JS-thread state, not a Reanimated-driven style — `<Image source>` is not
  an animatable style property, which is also why this coexists cleanly with the host's existing
  Reanimated-driven bob/rotate/translate (those animate transform styles on the wrapping `Animated.View`,
  this animates which image is rendered inside it).
- Reduce Motion: reads the same `AccessibilityInfo.isReduceMotionEnabled()` signal already used
  elsewhere in this widget. Under Reduce Motion, the component stops cycling and holds a single neutral
  frame (frame 1) — consistent with the host shell's existing Reduce Motion behavior of removing implied
  motion, not just slowing it down.

**Integration:** `RoninJourneyPrototype.tsx` (existing, currently dormant component) swaps its walker
element from `<RoninJourneyRiveWalker source={roninJourneyRive} ... />` to
`<RoninWalkCycleSprite frames={WALK_CYCLE_FRAMES} ... />`. No other change to `RoninJourneyPrototype.tsx`
— the sunset-trail background, progress-path SVG, horizontal travel driven by
`completedCount`/`totalCount`, and the existing tap-to-react bounce/bubble/haptic all stay exactly as
they are, since they operate on the wrapping view, not the walker image itself.

## Motion + data flow

Both of the previously-open "what drives movement" questions resolve for free from the existing shell:
- **Never static:** `RoninWalkCycleSprite`'s own frame-cycling runs continuously and independently of
  app data — the character is always mid-stride.
- **Tied to real progress:** the host shell's existing `progress` shared value (driven by
  `completedCount`/`totalCount`) still moves the whole character further right along the trail as more
  of today's items complete — unchanged from the current (dormant) implementation.

## Placement

Revives the widget slot already scaffolded in `HomeScreen.tsx` — currently commented out with the note
"Journey/Potential strip... stay off Home for now." Mounts `RoninJourneyPrototype`, passing the same
`completedCount`/`totalCount` values `HomeScreen.tsx` already computes for `RoninGreetingCard` — no new
data plumbing.

## Explicitly out of scope for this pass

- More than 8 frames (only revisit if the loop reads choppy on-device — see "Asset pipeline" fallback).
- Any second animation state (idle-standing, running, seasonal variants, etc.).
- Floating-overlay or dedicated-screen placement (both considered and deferred in favor of reviving the
  Home widget).
- Any change to the Rive rig, `RONIN_RIVE.md`, or `RoninJourneyRiveWalker.tsx`'s own behavior.
- Desktop web — this is iOS-first; a web port is a separate, later decision (`WEB_PARITY.md` should be
  updated only once/if that happens).

## Testing / verification

- `npx tsc --noEmit` passes.
- On-device (or simulator) visual check: walk-cycle loop reads as smooth motion, not jittery/misaligned
  frames.
- Reduce Motion toggle: confirm the sprite freezes on a neutral frame while the rest of the widget's
  existing Reduce Motion behavior (slower bob, no rotation) is unaffected.
- Tap interaction still triggers haptic + bubble + hop/scale exactly as it did before this change (no
  regression, since that logic is untouched).
- Progress-driven horizontal travel still correctly reflects `completedCount`/`totalCount` at 0%, partial,
  and 100% states.

## Addendum (same day): hold-to-preview-walk

After initial verification, added a "thru"-style hold interaction so the walk can be previewed without
needing to complete real tasks. Approved as a **permanent** feature, not a dev-only affordance.

**Mechanic:** the widget's existing full-surface `Pressable` gains `onPressIn`/`onPressOut` alongside its
existing `onPress` (unchanged — still the tap-reaction bubble/haptic). A new Reanimated shared value
`previewProgress` (0→1) animates toward 1 over ~1.8s linear motion on press-in (walking to the path's end
if held that long) and back to 0 over ~400ms on press-out (the snap-back). The walker's displayed position
becomes `progress.value + previewProgress.value * (1 - progress.value)` — real progress plus whatever
fraction of the *remaining* distance the hold has covered, naturally capped at 1 (the path's end) since
`previewProgress` never exceeds 1. This single derived value feeds the same `translateX = displayProgress
* travel` calculation `walkerStyle` already used for `progress.value` alone — no new positioning logic.

**Explicitly not changed:** `completedCount`/`totalCount`/`progress` (the real data) are never written to
by the preview — it's a purely visual, temporary offset. A quick tap still behaves exactly as before
(press-in/out happen too fast to visibly move the character; `onPress`'s reaction bubble still fires).

**Verification:** hold anywhere on the widget — character should walk forward past its real position over
~1.8s if held that long, and animate back to the real position on release. Quick taps should look
unchanged from before this addendum (reaction bubble still appears, no visible extra movement).
