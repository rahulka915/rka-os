# Scrolling Parallax Sky Background — Design

## Problem

This supersedes the rendering half of
`2026-08-16-animated-sky-background-design.md` (already partially built —
see §1 below). A single static full-bleed scene, even one that crossfades by
time-of-day/weather, doesn't convey the sense of an ongoing, unlimited
journey. The background should continuously drift/scroll — like the parallax
backgrounds in endless-runner games (e.g. Alto's Odyssey/Adventure, THRU) —
so movement feels perpetual rather than gated by finishing tasks.

## Goals

- The sky background continuously scrolls left at a slow, ambient pace,
  independent of task-completion progress (the character's own
  progress-based horizontal position, already implemented in
  `RoninJourneyPrototype.tsx`, is completely unaffected).
- Real depth via 3 parallax layers (sky / midground / foreground) scrolling
  at different speeds.
- Still crossfades continuously by real time-of-day (5 buckets) and by
  weather (3 categories) — same logic as before, now applied per-layer.
- Fails soft — no permission/network/art dependency ever blocks rendering.
- Reusable component, matching the original spec's goal.

## Non-goals

- No true mathematically-seamless tiling art requirement — wide images with
  a brief crossfade reset instead (see §4).
- No scroll speed/position tied to task progress.
- No new npm dependency.
- No web port in this pass.

## Design

### 1. What's already built and reused unchanged

From the original spec, already implemented and committed:
- `src/utils/solarTime.ts` — `computeSunTimes(latitude, longitude, date)`.
- `src/utils/skyTimeOfDay.ts` — `TimeOfDayBucket`, `TIME_OF_DAY_BUCKETS`,
  `getSkyBlend(sunTimes, now)`.
- `weatherParsing.ts`'s `SkyWeatherCategory`, `getSkyWeatherCategory(conditionCode)`.

None of these change. Only the asset registry and the rendering component
(originally spec'd as a single flat crossfading `Image`) are redesigned
below to replace that plan.

### 2. Parallax layers

```ts
export type SkyLayer = 'sky' | 'midground' | 'foreground';
```

Matches the existing reference art's own natural depth
(`assets/ronin/journey/sunset-trail-background-v1.jpg`): **sky** (gradient +
sun/moon/stars — scrolls slowest, nearly static), **midground** (mountain +
torii gate + pagoda silhouette — scrolls slow), **foreground** (pine trees +
ground — scrolls fastest). Each layer is an independently-scrolling
`Animated.View`.

### 3. Art matrix: 45 images

5 time-of-day buckets × 3 weather categories × 3 layers =
`assets/sky/<bucket>-<weather>-<layer>.jpg`. Each is a wide image (several
multiples of the widget's rendered width — exact multiplier set per layer in
§4) matching the lighting/weather of its time+weather combo. Not required to
be a perfect seamless tile — see §4's reset mechanic. A follow-up message
after this spec is approved will give the full 45-filename checklist and
generation prompt (extending the original spec's prompt table with a layer
axis).

### 4. Looping-scroll mechanic (`useLoopingScroll` hook)

A single reusable hook, `src/hooks/useLoopingScroll.ts`, used identically by
all 3 layers (and by both time-of-day buckets, so up to 6 instances at once,
12 during a weather crossfade — see §6):

```ts
function useLoopingScroll(loopDurationMs: number, resetCrossfadeMs: number, reduceMotion: boolean): {
  styleA: AnimatedStyle; // translateX + opacity for copy A
  styleB: AnimatedStyle; // translateX + opacity for copy B
}
```

Mechanic: two copies of the same image are stacked in the same position.
Copy A starts active (opacity 1) scrolling `translateX` from `0` to
`-layerWidth` over `loopDurationMs` (linear, `withRepeat`-driven). Copy B
starts standby (opacity 0, `translateX: 0`, not yet scrolling). When A's
scroll reaches its final `resetCrossfadeMs`, B fades in and begins scrolling
from `0` while A fades out finishing its scroll to `-layerWidth`; once the
crossfade completes, their roles swap (the finished copy resets instantly
while invisible) and the cycle repeats. This hides the non-seamless left/right
edge mismatch behind a brief crossfade instead of a hard pop — acceptable
because at a slow drift speed resets are infrequent.

Under Reduce Motion: no scrolling — both copies render statically at
`translateX: 0`, only copy A visible (`opacity: 1`), matching this app's
existing convention of freezing rather than disabling ambient motion
elsewhere (e.g. `RoninJourneyPrototype`'s idle bob).

**Per-layer speed** (loop duration = time to scroll one image width — slower
number = slower, more ambient drift):
- `sky`: 20 minutes, `layerWidthMultiplier: 2` (least visual detail moving, least frequent resets needed).
- `midground`: 8 minutes, `layerWidthMultiplier: 2.5`.
- `foreground`: 3 minutes, `layerWidthMultiplier: 3` (most parallax motion, closest to viewer).

`resetCrossfadeMs` is fixed at 1500 for all layers.

### 5. Asset registry

```ts
export const SKY_SCENES: Record<TimeOfDayBucket, Record<SkyWeatherCategory, Record<SkyLayer, ImageSourcePropType>>>
```

Same `require()`-registry pattern as the original spec, one level deeper.

### 6. `AnimatedSkyBackground` component

Same external API as originally spec'd (`{ style? }`, fetches its own
location/weather, fails soft to `midday`/`clear`). Internally, for each of
the 3 layers, renders both current time-of-day buckets' scrolling pairs
(from `useLoopingScroll`, per bucket per layer) stacked with the
existing time-blend crossfade (bucketB's opacity = the continuously-updated
blend fraction from `getSkyBlend`, recomputed every 60s exactly as
originally spec'd) layered on top of bucketA. Weather-category changes
trigger the same ~3s whole-composite crossfade as originally spec'd, now
crossfading all 3 layers' current bucket-pair together. On-device
verification (part of the implementation plan) explicitly includes a
performance check, since steady-state renders 2 buckets × 3 layers × 2 loop
copies = 12 `Image` components (24 briefly during a weather crossfade) — if
that proves too heavy on real devices, the follow-up optimization (not built
speculatively per YAGNI) would be mounting each loop pair's standby copy
only shortly before its reset crossfade instead of keeping both mounted
permanently.

### 7. Fallback & integration

Fallback: until location + sun times + weather resolve (or if denied/failed),
render `midday`/`clear`'s 3 layers looping normally — never blank, never
blocked, exactly as originally spec'd. Integration into
`RoninJourneyPrototype.tsx` is unchanged from the original spec — same
one-line swap of the static `sunsetTrail` `Image` for
`<AnimatedSkyBackground style={styles.background} />`.

## Testing

`useLoopingScroll`'s loop-duration/reset-crossfade timing math (converting
duration/width into the reset threshold) is extracted as a pure function and
unit-tested, following this codebase's existing convention (pure logic
tested, RN rendering verified live). The component itself — layer speeds
feeling right, crossfade reset being unnoticeable at normal viewing
distance, and the performance check from §6 — is verified manually
on-device, same as the rest of this journey-widget work.
