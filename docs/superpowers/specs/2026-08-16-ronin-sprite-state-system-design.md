# Ronin Sprite State System + Tap-Reaction Pilot — Design

## Context

The Home journey widget (`RoninJourneyPrototype`) currently animates its Ronin character with `RoninWalkCycleSprite`, which hardcodes exactly two states via an `isWalking: boolean` prop: an 8-frame walk cycle and a 4-frame idle loop (both shipped in `docs/superpowers/plans/2026-08-15-simplified-walking-ronin-avatar.md` and a follow-on uncommitted idle-state change). The user wants to add many more animation states over time (celebration, an upgraded tap reaction, time-of-day variants, and others not yet specified). Continuing to hardcode each new state as another prop/branch would make the component increasingly unmanageable.

This spec covers two things:
1. A generic, extensible sprite-state system to replace the current boolean branch, so each future state is "generate PNGs + register them" rather than a component rewrite.
2. A pilot implementation using that system: an upgraded tap-reaction state (replacing the current text-bubble reaction with an animated pose sequence), chosen because it's a one-shot (non-looping) state with a clear, isolated trigger — proving the system handles both loop and one-shot cases before more states are added.

A fringe/despill fix to the PNG-generation pipeline is included since it affects every future state's asset quality, not just the pilot.

## Non-goals

- Building out celebration, time-of-day variants, or any other state beyond the tap-reaction pilot — those come in later specs/plans once the system is proven.
- Any change to the walk/idle frame content itself (only the walk-cycle frames get regenerated, to validate the fringe fix — no new poses).
- Desktop web — this stays iOS-only, matching the walk/idle precedent (`WEB_PARITY.md` untouched).

## Architecture: sprite state registry

Replace `RoninWalkCycleSprite`'s `isWalking` boolean with a `state: RoninSpriteState` prop, where `RoninSpriteState` is a string union starting with `'idle' | 'walking' | 'tapReaction'` (extensible — new states are added to the union and registry, nothing else in the component changes).

A module-level registry maps each state to its playback config:

```ts
interface SpriteStateConfig {
  frames: number[]; // require()'d image sources, in play order
  intervalMs: number;
  loopMode: 'loop' | 'once';
}
```

- `'idle'` and `'walking'` keep their existing frame sets/intervals, `loopMode: 'loop'`.
- `'tapReaction'` is new, `loopMode: 'once'`.

Component behavior:
- On `state` change, reset `frameIndex` to 0 and start an interval for that state's `intervalMs`.
- For `loopMode: 'loop'`, the interval wraps via the existing `getNextWalkCycleFrame` modulo helper, indefinitely.
- For `loopMode: 'once'`, the interval stops advancing after the last frame and calls an `onComplete?: () => void` prop once, instead of wrapping back to frame 0.

`RoninJourneyPrototype` owns the actual state value (it already tracks `isProgressAnimating` for walk vs. idle). It computes `spriteState` as `'tapReaction'` while a tap reaction is active, else `isProgressAnimating ? 'walking' : 'idle'`. On tap, it sets a local `isTapReacting` flag true (which drives `spriteState`); `onComplete` clears the flag, reverting to whichever of walking/idle is then current.

## Tap-reaction pilot

- New frame set at `apps/mobile/assets/ronin/journey/tap-reaction/` (mirroring the `walk-cycle/` and `idle/` directory convention), sliced from a green-screen sheet the user generates and saves to `tap-reaction/source/`. Frame count is whatever the generated sheet contains (script parameterizes `FRAME_COUNT`, not hardcoded to 8 or 4).
- `RoninJourneyPrototype` changes:
  - Remove `REACTIONS` array, `reactionIndex` state, `reactionBubble` view/style, and the opacity/translateY bubble animation — the animated pose replaces the text entirely (per user decision).
  - Keep the existing hop/scale transform (`reaction.value` driving `translateY`/`scale`) and haptic-on-tap untouched — this is a separate visual layer (container transform) from which sprite frames are showing.
  - Add `isTapReacting` state; tap handler sets it `true` (alongside existing haptic + hop/scale trigger); `RoninWalkCycleSprite`'s `onComplete` sets it `false`.

## PNG pipeline: fringe fix

Generalize `build-ronin-walk-cycle-frames.py` into a shared, parameterized script (state name → source/output paths + frame count), used for all future states including this pilot. Two changes to the compositing step, to address visible green fringing in current output:

1. **Tighter alpha falloff**: narrow the distance band over which alpha ramps from 0→1 at the green-key boundary (currently half the tolerance width), and fully desaturate green (not partially) within that narrowed band via despill.
2. **Edge erosion + feather**: erode the foreground mask by 1-2px before compositing, then apply a small Gaussian blur to the alpha channel only. This discards the least-reliable outermost ring of keyed pixels rather than attempting to color-correct them.

Validation: re-run the fixed script against the existing walk-cycle source sheet first, visually compare old vs. new output (e.g. `open` frames side by side against a non-green background) to confirm the fringe is actually gone, before using the script on the new tap-reaction sheet. If the walk-cycle output looks worse (over-eroded, visible notches), tune erosion radius down before proceeding.

## Testing

- Pure logic: extend the existing `walkCycle.ts` test convention — add tests for one-shot advance behavior (stops at last frame index, does not wrap) alongside the existing loop-wrap tests.
- RN component and pipeline output: manual on-device verification, matching this codebase's established convention (pure logic tested, rendering/visual output verified live) — same as the walk-cycle plan's Task 7.
