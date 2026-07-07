# Ronin Hero — Painterly PNG Panels (Design)

## Context

The Ronin Hero (`apps/mobile/src/components/home/RoninHero.tsx`) currently renders a
vector-traced SVG character. Vector tracing destroys the baked-in glow, rim light, and
atmosphere present in the original painterly art. Since the app is shipping raster
(PNG) art directly rather than approximating it via vectors, the painterly panels in
`Ronin References/ronin1.png` (6-mood sheet) and `Ronin References/ronin2.png`
(high-res single hero pose) can be used as-is — no re-tracing needed.

Two references define the target: `Ronin References/ronin1.png` (mood state sheet)
and `Ronin References/ronin2.png` (high-res hero card mockup). Current shipped state
is a lower-fidelity vector render, visible in the in-app screenshot shared during
brainstorming.

## Goals

- Replace the vector character with the existing painterly PNG art, shipped as-is.
- Panels must melt into the card background — no visible "box in a box" edge.
- Preserve the "always alive" guarantee: breathing motion, glow pulse, mood
  crossfades, tap-poke reaction — all must survive the swap from SVG to Image.
- Ship today at existing resolution (~228px mood panels); defer a resolution upgrade
  to a separate follow-up pass.

## Non-goals

- No background cutout / character masking (rim-glow blends into background —
  unmaskable, don't attempt flood-fill).
- No part-level animation (scarf sway, blinking, hair movement) — that's Tier 2
  (layered PNGs) or Tier 3 (Rive), explicitly out of scope.
- No resolution upgrade in this pass (see Phase B below) — ship at current
  ~228px-wide panel resolution first.
- Do not redesign the mood system, animation timing values, or card layout — they
  are approved and working (`src/utils/roninMood.ts`, `MOOD_MOTION` in
  `RoninHero.tsx`).

## Design

### 1. Asset pipeline (ImageMagick, one-time, Task-1-equivalent)

- Crop the 6 mood panels from `Ronin References/ronin1.png`'s mood row. The row
  crops cleanly at roughly `1402x420+0+230` (verified visually during brainstorming);
  the executing agent should verify exact per-panel x-offsets to avoid slicing through
  the thin vertical separators between panels.
- **Do not remove backgrounds.** The previous plan's flood-fill approach is out —
  the rim-glow blends into the background and floodfill will visibly cut it off.
- Instead, apply a **feathered alpha vignette** to each panel: alpha fades from 100%
  in the center to fully transparent over the outer ~12–15% of the panel's
  width/height (radial falloff). This makes the panel melt into the card instead of
  reading as a hard-edged rectangle.
- Save results to
  `apps/mobile/assets/ronin/moods/{normal,alert,tired,focused,overwhelmed,resolved}.png`.

### 2. Card background retune

- The card's `LinearGradient` in `RoninHero.tsx` (`rgba(55,31,10,0.55) → rgba(7,7,7,0.92)
  → #040404`) should be retuned so its warm-dark tone converges with the mood panels'
  own background color (~`#0d0d0e` warm-dark), making the feathered vignette
  invisible against it. This directly fixes the "box in a box" edge visible in the
  current screenshot.

### 3. RoninHero.tsx changes

- Replace `<SvgXml xml={RONIN_STATE_XML[mood]} …>` for the character with
  `<Image source={MOOD_IMAGES[mood]} resizeMode="contain" …>`, keeping the same
  `Animated.View` wrapper + `characterStyle` so breathing keeps working unchanged.
- Add a mood→require map (`MOOD_IMAGES: Record<RoninMood, number>`) analogous to the
  original Task 2 plan.
- Update `styles.character` aspectRatio to the trimmed panel dimensions (measure
  after cropping/feathering).
- **Aura layer:** the glow is now baked into the pixels, so the existing code-drawn
  SVG aura (`RONIN_GLOW_XML`) would double the glow. Reduce its opacity range to
  roughly 30% of current values so it reads purely as the breathing *pulse* layered
  on top of the baked glow, not a second light source. If it still visually competes
  with the art after that reduction, fall back to a soft radial-gradient pulse
  overlay instead of the SVG aura.
- `RONIN_STATE_XML` becomes unused once the swap is complete; remove the import and
  delete the dead export only if nothing else references it.
- `npx tsc --noEmit` must pass.

### 4. Mood crossfade (unchanged from original plan's Task 3)

- Render two stacked `<Image>`s (previous mood, current mood); on mood change,
  animate opacities over ~350ms with Reanimated (`ReduceMotion.Never`), easeInOut
  timing, no spring/bounce.

### 5. Tap interaction (unchanged from original plan's Task 4)

- Wrap the character in a `Pressable` (remove `pointerEvents="none"` from the
  character wrapper).
- On press: `Haptics.impactAsync(Light)` + brief glow pulse boost (~1.15x, settling
  back) + character scale 0.97 → 1 over ~250ms. No mood change on tap.
- Reasonable `hitSlop`; must not intercept parent ScrollView gestures beyond the
  character's bounds.

### Why this still reads as "alive"

The Finch / Not Boring pattern this design follows: the character image is static,
but the container never stops moving. Breathing (translateY + scale, continuous sine
loop, mood-specific rhythm) and glow pulse (opacity/scale breathing on the aura) are
unchanged from the current working implementation — only the character layer swaps
from `SvgXml` to `Image`. Combined with mood crossfades and the tap-poke reaction,
there is never a frame where the character is frozen, matching the existing
`ReduceMotion.Never` guarantee. What this does NOT provide — scarf sway, blinking,
independent hair motion — is explicitly deferred to Tier 2/3.

## Source selection for the 6 mood panels

All 6 moods are sourced from `Ronin References/ronin1.png` for internal consistency.
`Ronin References/ronin2.png`'s high-res hero (a different rendering of the "normal"
pose — sharper, fiercer eyes, larger aura) is used only to validate the vignette/
feathering pipeline at high resolution during Phase A; it is **not** shipped as the
"normal" mood panel, since mixing a sharper/different-style render with the other 5
lower-res panels would look inconsistent when mood-crossfading between them.

## Phase B (follow-up, not this pass)

Mood panels are ~228px wide — soft at 3x display density. Once the vignette/feather
look is validated and approved in-app, a follow-up pass regenerates each of the 6
mood panels individually at 1024×1024 (Codex/GPT image generation, with the
existing panels attached as style reference), then drops the higher-res files in
under the same filenames — zero code changes required.

## Testing / Verification

- `npx tsc --noEmit` passes after the Image swap.
- All 6 moods render correctly (force each mood temporarily in HomeScreen if
  needed, then revert).
- Visual check: no visible hard edge/box around the character against the card
  background, in both light glow and dim moods (tired, overwhelmed).
- Crossfade animates smoothly across a mood change without a flash/pop.
- Tap-poke haptic + pulse + scale react correctly; parent ScrollView scroll still
  works over the rest of the card.
- Metro runs on port 8082 per existing project convention
  (`npx expo start --dev-client --clear --port 8082`); user verifies visually on
  device since the agent cannot see the physical device.
