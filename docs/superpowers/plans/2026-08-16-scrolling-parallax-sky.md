# Scrolling Parallax Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable `AnimatedSkyBackground` component as a 3-layer parallax scroll (sky/midground/foreground, each continuously drifting and looping independently) that also crossfades by real time-of-day and weather, replacing the Home journey widget's static background.

**Architecture:** A pure, unit-tested `loopingScroll.ts` defines the crossfade-reset math and per-layer speed config; a small `useLoopingScroll` Reanimated hook wraps that math into two Image-ready animated styles (a continuously-scrolling primary copy + a static copy that fades in during the brief reset crossfade). `SkyLayerView` renders one parallax layer's bucketA/bucketB time-of-day crossfade using that hook; `AnimatedSkyBackground` composes 3 `SkyLayerView`s and handles the outer weather-category crossfade, location/weather fetching, and fallback — reusing `solarTime.ts`/`skyTimeOfDay.ts`/`getSkyWeatherCategory` exactly as already built.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), `react-native-reanimated`, existing `deviceLocation.ts`/`services/weather.ts`, Node's built-in test runner for unit tests.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-16-scrolling-parallax-sky-design.md` (which itself supersedes the rendering half of `docs/superpowers/specs/2026-08-16-animated-sky-background-design.md` — the solar/time/weather utilities from that earlier spec are already built and reused unchanged, not rebuilt here).
- No new npm dependencies.
- Fails soft throughout — no permission/network/art dependency may ever block rendering or throw.
- iOS-first; no desktop web work in this pass.
- Scroll is continuous ambient drift, completely independent of task-completion progress.
- `resetCrossfadeMs` is fixed at 1500 for all layers. Per-layer config: `sky` 20min loop / 2x width, `midground` 8min loop / 2.5x width, `foreground` 3min loop / 3x width.
- Pure-logic unit tests follow this codebase's existing convention: `node:test` + `node:assert/strict`, `// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.` header, `.ts`-extension imports. Run via `npm test` or `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test <file>` from `apps/mobile/`.
- `npx tsc --noEmit` (from `apps/mobile/`; use `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit` if the default invocation stack-overflows) must stay clean after every task touching `.ts`/`.tsx`. A pre-existing unrelated error at `src/db/database.ts(1624,11)` is expected.

---

### Task 1: Loop-frame math and per-layer scroll config

**Files:**
- Create: `apps/mobile/src/utils/loopingScroll.ts`
- Test: `apps/mobile/src/utils/loopingScroll.test.ts`

**Interfaces:**
- Produces: `computeLoopFrame(t: number, resetFraction: number): { scrollFraction: number; primaryOpacity: number; resetOpacity: number }`, `SkyLayer = 'sky' | 'midground' | 'foreground'`, `RESET_CROSSFADE_MS: number` (= 1500), `LAYER_SCROLL_CONFIG: Record<SkyLayer, { loopDurationMs: number; widthMultiplier: number }>`. Task 2 (`useLoopingScroll.ts`) imports `RESET_CROSSFADE_MS`/`LAYER_SCROLL_CONFIG`/`SkyLayer` and reimplements `computeLoopFrame`'s formula inline inside a Reanimated worklet (see Task 2 for why). Task 3 (`skyScenes.ts`) imports `SkyLayer`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/loopingScroll.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLoopFrame, LAYER_SCROLL_CONFIG, RESET_CROSSFADE_MS } from './loopingScroll.ts';

function assertClose(actual: number, expected: number, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test('computeLoopFrame: at the very start of the cycle, primary is fully opaque and reset copy is hidden', () => {
  const frame = computeLoopFrame(0, 0.1);
  assert.equal(frame.scrollFraction, 0);
  assertClose(frame.primaryOpacity, 1);
  assertClose(frame.resetOpacity, 0);
});

test('computeLoopFrame: before the crossfade window, primary stays fully opaque', () => {
  const frame = computeLoopFrame(0.85, 0.1);
  assertClose(frame.primaryOpacity, 1);
  assertClose(frame.resetOpacity, 0);
});

test('computeLoopFrame: halfway through the crossfade window, both copies are half-visible', () => {
  const frame = computeLoopFrame(0.95, 0.1);
  assertClose(frame.primaryOpacity, 0.5);
  assertClose(frame.resetOpacity, 0.5);
});

test('computeLoopFrame: at the very end of the cycle, primary is nearly invisible and reset copy is nearly fully visible', () => {
  const frame = computeLoopFrame(1, 0.1);
  assertClose(frame.primaryOpacity, 0, 0.01);
  assertClose(frame.resetOpacity, 1, 0.01);
});

test('computeLoopFrame: opacities always sum to 1', () => {
  for (let t = 0; t <= 1; t += 0.05) {
    const frame = computeLoopFrame(t, 0.15);
    assertClose(frame.primaryOpacity + frame.resetOpacity, 1);
  }
});

test('computeLoopFrame: clamps t outside [0,1]', () => {
  assertClose(computeLoopFrame(-0.5, 0.1).scrollFraction, 0);
  assertClose(computeLoopFrame(1.5, 0.1).scrollFraction, 1);
});

test('LAYER_SCROLL_CONFIG: has an entry for all 3 layers with positive duration and multiplier > 1', () => {
  for (const layer of ['sky', 'midground', 'foreground'] as const) {
    const config = LAYER_SCROLL_CONFIG[layer];
    assert.ok(config.loopDurationMs > 0, `${layer} loopDurationMs`);
    assert.ok(config.widthMultiplier > 1, `${layer} widthMultiplier must exceed 1 so there's room to scroll`);
  }
});

test('LAYER_SCROLL_CONFIG: foreground loops fastest, sky loops slowest', () => {
  assert.ok(LAYER_SCROLL_CONFIG.foreground.loopDurationMs < LAYER_SCROLL_CONFIG.midground.loopDurationMs);
  assert.ok(LAYER_SCROLL_CONFIG.midground.loopDurationMs < LAYER_SCROLL_CONFIG.sky.loopDurationMs);
});

test('RESET_CROSSFADE_MS is a small positive duration', () => {
  assert.equal(RESET_CROSSFADE_MS, 1500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/mobile/`): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/loopingScroll.test.ts`
Expected: FAIL — `loopingScroll.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/loopingScroll.ts`:

```ts
export type SkyLayer = 'sky' | 'midground' | 'foreground';

export const RESET_CROSSFADE_MS = 1500;

export const LAYER_SCROLL_CONFIG: Record<SkyLayer, { loopDurationMs: number; widthMultiplier: number }> = {
  sky: { loopDurationMs: 20 * 60 * 1000, widthMultiplier: 2 },
  midground: { loopDurationMs: 8 * 60 * 1000, widthMultiplier: 2.5 },
  foreground: { loopDurationMs: 3 * 60 * 1000, widthMultiplier: 3 },
};

// A layer's loop is one continuously-scrolling "primary" copy (0 -> 1 over
// loopDurationMs, then it must jump back to 0 — the seam this whole scheme
// exists to hide, since the art isn't a perfect tileable loop) plus a
// second static "reset" copy sitting at the start position, which fades in
// during the last `resetFraction` of the cycle and fades back out right
// after the jump. See docs/superpowers/specs/2026-08-16-scrolling-parallax-sky-design.md §4.
export function computeLoopFrame(
  t: number,
  resetFraction: number,
): { scrollFraction: number; primaryOpacity: number; resetOpacity: number } {
  const clampedT = Math.min(1, Math.max(0, t));
  const crossfadeStart = 1 - resetFraction;
  const primaryOpacity = clampedT < crossfadeStart ? 1 : 1 - (clampedT - crossfadeStart) / resetFraction;
  return { scrollFraction: clampedT, primaryOpacity, resetOpacity: 1 - primaryOpacity };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/loopingScroll.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/loopingScroll.ts apps/mobile/src/utils/loopingScroll.test.ts
git commit -m "feat: add looping-scroll crossfade math and per-layer speed config"
```

---

### Task 2: `useLoopingScroll` hook

**Files:**
- Create: `apps/mobile/src/hooks/useLoopingScroll.ts`

**Interfaces:**
- Consumes: `RESET_CROSSFADE_MS` (Task 1).
- Produces: `useLoopingScroll(loopDurationMs: number, resetCrossfadeMs: number, scrollRangePx: number, reduceMotion: boolean): { primaryStyle: AnimatedStyleProp; resetStyle: AnimatedStyleProp }`. Task 4 (`SkyLayerView.tsx`) imports and calls this.

- [ ] **Step 1: Write the hook**

Create `apps/mobile/src/hooks/useLoopingScroll.ts`:

```ts
import { useEffect } from 'react';
import { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Mirrors utils/loopingScroll.ts's computeLoopFrame formula, reimplemented
// inline here because Reanimated worklets (the useAnimatedStyle callback
// below, which runs on the UI thread) need every function they call to be
// a worklet — importing a plain utils function across that boundary is a
// common source of subtle bugs in this ecosystem, so the tiny formula is
// duplicated on purpose. computeLoopFrame itself stays the source of truth
// for correctness, verified by loopingScroll.test.ts.
export function useLoopingScroll(
  loopDurationMs: number,
  resetCrossfadeMs: number,
  scrollRangePx: number,
  reduceMotion: boolean,
) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: loopDurationMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [loopDurationMs, reduceMotion, t]);

  const resetFraction = resetCrossfadeMs / loopDurationMs;

  const primaryStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { transform: [{ translateX: 0 }], opacity: 1 };
    }
    const crossfadeStart = 1 - resetFraction;
    const primaryOpacity = t.value < crossfadeStart ? 1 : 1 - (t.value - crossfadeStart) / resetFraction;
    return {
      transform: [{ translateX: -t.value * scrollRangePx }],
      opacity: primaryOpacity,
    };
  }, [scrollRangePx, resetFraction, reduceMotion]);

  const resetStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0 };
    }
    const crossfadeStart = 1 - resetFraction;
    const primaryOpacity = t.value < crossfadeStart ? 1 : 1 - (t.value - crossfadeStart) / resetFraction;
    return { opacity: 1 - primaryOpacity };
  }, [resetFraction, reduceMotion]);

  return { primaryStyle, resetStyle };
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useLoopingScroll.ts
git commit -m "feat: add useLoopingScroll hook"
```

---

### Task 3: Sky layer asset registry (blocked on art)

**Files:**
- Create: 45 files under `apps/mobile/assets/sky/` (you place these — generated externally, see below)
- Create: `apps/mobile/src/components/sky/skyScenes.ts`

**Interfaces:**
- Consumes: `TimeOfDayBucket` (existing `../../utils/skyTimeOfDay.ts`), `SkyWeatherCategory` (existing `../../utils/weatherParsing.ts`), `SkyLayer` (Task 1).
- Produces: `SKY_SCENES: Record<TimeOfDayBucket, Record<SkyWeatherCategory, Record<SkyLayer, ImageSourcePropType>>>`. Task 5 (`AnimatedSkyBackground.tsx`) imports `SKY_SCENES`.

**This task cannot be completed without all 45 art files existing first** — a `require()` of a missing file breaks the Metro bundle for the whole app, not just this screen.

- [ ] **Step 1: Generate and place the 45 painted scene layers**

For each of the 5 time buckets × 3 weather categories, generate 3 separate layer images (sky, midground, foreground) that compose into one coherent scene when stacked — i.e. generate them as one full scene first, then either ask the generator for the scene as 3 separate transparent-background layers, or generate one flat scene and split it into 3 layers yourself (sky = top gradient band, midground = mountain/torii/pagoda silhouette band with transparent sky above, foreground = pine tree/ground band with transparent area above). Match `assets/ronin/journey/sunset-trail-background-v1.jpg`'s existing style and composition (portrait-oriented single scene, painterly digital illustration). Each layer image should be wide relative to the widget (a few times its width — exact width isn't critical since `AnimatedSkyBackground` scales it to `containerWidth × widthMultiplier` at render time, so any generously-wide image works) and does not need to be a seamless tile (see Task 1's `computeLoopFrame` — the crossfade masks the loop point).

Base prompt (extend per time/weather using the table from the original spec's generation guidance, now applied per-layer):

> A painted landscape illustration in 3 separate layers with transparent backgrounds between them: (1) SKY layer — gradient sky with sun/moon/stars as appropriate; (2) MIDGROUND layer — a distant mountain silhouette (Mount Fuji-style, snow-capped peak) with a traditional Japanese torii gate and pagoda silhouette; (3) FOREGROUND layer — pine trees and grassy ground silhouette in the near foreground. <TIME_DESCRIPTION>. <WEATHER_DESCRIPTION> Soft painterly digital illustration style matching a premium mobile game's ambient background art, wide horizontal composition so each layer can scroll. No characters, no text, no watermark.

Save each layer to `apps/mobile/assets/sky/<bucket>-<weather>-<layer>.jpg`, e.g. `dawn-clear-sky.jpg`, `dawn-clear-midground.jpg`, `dawn-clear-foreground.jpg`, continuing for all 5×3 combinations (45 files total).

- [ ] **Step 2: Verify all 45 files exist**

Run (from `apps/mobile/`): `ls assets/sky/ | wc -l`
Expected: `45`. Do not proceed to Step 3 until this is true.

- [ ] **Step 3: Write the asset registry**

Create `apps/mobile/src/components/sky/skyScenes.ts`:

```ts
import type { ImageSourcePropType } from 'react-native';
import type { TimeOfDayBucket } from '../../utils/skyTimeOfDay';
import type { SkyWeatherCategory } from '../../utils/weatherParsing';
import type { SkyLayer } from '../../utils/loopingScroll';

type LayerSources = Record<SkyLayer, ImageSourcePropType>;
type WeatherSources = Record<SkyWeatherCategory, LayerSources>;

function bucketScenes(bucket: string): WeatherSources {
  return {
    clear: {
      sky: sceneRequire(bucket, 'clear', 'sky'),
      midground: sceneRequire(bucket, 'clear', 'midground'),
      foreground: sceneRequire(bucket, 'clear', 'foreground'),
    },
    cloudy: {
      sky: sceneRequire(bucket, 'cloudy', 'sky'),
      midground: sceneRequire(bucket, 'cloudy', 'midground'),
      foreground: sceneRequire(bucket, 'cloudy', 'foreground'),
    },
    rain: {
      sky: sceneRequire(bucket, 'rain', 'sky'),
      midground: sceneRequire(bucket, 'rain', 'midground'),
      foreground: sceneRequire(bucket, 'rain', 'foreground'),
    },
  };
}

// require() targets must be static string literals for Metro to resolve
// them at bundle time — this switch enumerates all 45 explicitly rather
// than building the path dynamically.
function sceneRequire(bucket: string, weather: string, layer: string): ImageSourcePropType {
  const key = `${bucket}-${weather}-${layer}`;
  switch (key) {
    case 'dawn-clear-sky': return require('../../../assets/sky/dawn-clear-sky.jpg');
    case 'dawn-clear-midground': return require('../../../assets/sky/dawn-clear-midground.jpg');
    case 'dawn-clear-foreground': return require('../../../assets/sky/dawn-clear-foreground.jpg');
    case 'dawn-cloudy-sky': return require('../../../assets/sky/dawn-cloudy-sky.jpg');
    case 'dawn-cloudy-midground': return require('../../../assets/sky/dawn-cloudy-midground.jpg');
    case 'dawn-cloudy-foreground': return require('../../../assets/sky/dawn-cloudy-foreground.jpg');
    case 'dawn-rain-sky': return require('../../../assets/sky/dawn-rain-sky.jpg');
    case 'dawn-rain-midground': return require('../../../assets/sky/dawn-rain-midground.jpg');
    case 'dawn-rain-foreground': return require('../../../assets/sky/dawn-rain-foreground.jpg');
    case 'morning-clear-sky': return require('../../../assets/sky/morning-clear-sky.jpg');
    case 'morning-clear-midground': return require('../../../assets/sky/morning-clear-midground.jpg');
    case 'morning-clear-foreground': return require('../../../assets/sky/morning-clear-foreground.jpg');
    case 'morning-cloudy-sky': return require('../../../assets/sky/morning-cloudy-sky.jpg');
    case 'morning-cloudy-midground': return require('../../../assets/sky/morning-cloudy-midground.jpg');
    case 'morning-cloudy-foreground': return require('../../../assets/sky/morning-cloudy-foreground.jpg');
    case 'morning-rain-sky': return require('../../../assets/sky/morning-rain-sky.jpg');
    case 'morning-rain-midground': return require('../../../assets/sky/morning-rain-midground.jpg');
    case 'morning-rain-foreground': return require('../../../assets/sky/morning-rain-foreground.jpg');
    case 'midday-clear-sky': return require('../../../assets/sky/midday-clear-sky.jpg');
    case 'midday-clear-midground': return require('../../../assets/sky/midday-clear-midground.jpg');
    case 'midday-clear-foreground': return require('../../../assets/sky/midday-clear-foreground.jpg');
    case 'midday-cloudy-sky': return require('../../../assets/sky/midday-cloudy-sky.jpg');
    case 'midday-cloudy-midground': return require('../../../assets/sky/midday-cloudy-midground.jpg');
    case 'midday-cloudy-foreground': return require('../../../assets/sky/midday-cloudy-foreground.jpg');
    case 'midday-rain-sky': return require('../../../assets/sky/midday-rain-sky.jpg');
    case 'midday-rain-midground': return require('../../../assets/sky/midday-rain-midground.jpg');
    case 'midday-rain-foreground': return require('../../../assets/sky/midday-rain-foreground.jpg');
    case 'dusk-clear-sky': return require('../../../assets/sky/dusk-clear-sky.jpg');
    case 'dusk-clear-midground': return require('../../../assets/sky/dusk-clear-midground.jpg');
    case 'dusk-clear-foreground': return require('../../../assets/sky/dusk-clear-foreground.jpg');
    case 'dusk-cloudy-sky': return require('../../../assets/sky/dusk-cloudy-sky.jpg');
    case 'dusk-cloudy-midground': return require('../../../assets/sky/dusk-cloudy-midground.jpg');
    case 'dusk-cloudy-foreground': return require('../../../assets/sky/dusk-cloudy-foreground.jpg');
    case 'dusk-rain-sky': return require('../../../assets/sky/dusk-rain-sky.jpg');
    case 'dusk-rain-midground': return require('../../../assets/sky/dusk-rain-midground.jpg');
    case 'dusk-rain-foreground': return require('../../../assets/sky/dusk-rain-foreground.jpg');
    case 'night-clear-sky': return require('../../../assets/sky/night-clear-sky.jpg');
    case 'night-clear-midground': return require('../../../assets/sky/night-clear-midground.jpg');
    case 'night-clear-foreground': return require('../../../assets/sky/night-clear-foreground.jpg');
    case 'night-cloudy-sky': return require('../../../assets/sky/night-cloudy-sky.jpg');
    case 'night-cloudy-midground': return require('../../../assets/sky/night-cloudy-midground.jpg');
    case 'night-cloudy-foreground': return require('../../../assets/sky/night-cloudy-foreground.jpg');
    case 'night-rain-sky': return require('../../../assets/sky/night-rain-sky.jpg');
    case 'night-rain-midground': return require('../../../assets/sky/night-rain-midground.jpg');
    case 'night-rain-foreground': return require('../../../assets/sky/night-rain-foreground.jpg');
    default:
      throw new Error(`No sky scene registered for ${key}`);
  }
}

export const SKY_SCENES: Record<TimeOfDayBucket, WeatherSources> = {
  dawn: bucketScenes('dawn'),
  morning: bucketScenes('morning'),
  midday: bucketScenes('midday'),
  dusk: bucketScenes('dusk'),
  night: bucketScenes('night'),
};
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/assets/sky/ apps/mobile/src/components/sky/skyScenes.ts
git commit -m "feat: add the 45 parallax-layer sky scene assets"
```

---

### Task 4: `SkyLayerView` — one parallax layer's time-of-day crossfade

**Files:**
- Create: `apps/mobile/src/components/sky/SkyLayerView.tsx`

**Interfaces:**
- Consumes: `useLoopingScroll` (Task 2), `LAYER_SCROLL_CONFIG`/`RESET_CROSSFADE_MS`/`SkyLayer` (Task 1).
- Produces: `SkyLayerView({ layer, sourceA, sourceB, blend, containerWidth, containerHeight, reduceMotion }: SkyLayerViewProps)`. Task 5 (`AnimatedSkyBackground.tsx`) renders 3 of these per weather-composite (6 total during a weather crossfade).

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/components/sky/SkyLayerView.tsx`:

```tsx
import { Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useLoopingScroll } from '../../hooks/useLoopingScroll';
import { LAYER_SCROLL_CONFIG, RESET_CROSSFADE_MS, type SkyLayer } from '../../utils/loopingScroll';

interface SkyLayerViewProps {
  layer: SkyLayer;
  sourceA: ImageSourcePropType;
  sourceB: ImageSourcePropType;
  /** 0-1 time-of-day blend fraction from bucketA toward bucketB (see skyTimeOfDay.ts's getSkyBlend). */
  blend: number;
  containerWidth: number;
  containerHeight: number;
  reduceMotion: boolean;
}

function useSingleLoopingImage(
  layer: SkyLayer,
  source: ImageSourcePropType,
  containerWidth: number,
  containerHeight: number,
  reduceMotion: boolean,
) {
  const config = LAYER_SCROLL_CONFIG[layer];
  const layerWidth = containerWidth * config.widthMultiplier;
  const scrollRangePx = layerWidth - containerWidth;
  const { primaryStyle, resetStyle } = useLoopingScroll(config.loopDurationMs, RESET_CROSSFADE_MS, scrollRangePx, reduceMotion);
  const imageStyle = { width: layerWidth, height: containerHeight };
  return { primaryStyle, resetStyle, imageStyle, source };
}

export function SkyLayerView({ layer, sourceA, sourceB, blend, containerWidth, containerHeight, reduceMotion }: SkyLayerViewProps) {
  const a = useSingleLoopingImage(layer, sourceA, containerWidth, containerHeight, reduceMotion);
  const b = useSingleLoopingImage(layer, sourceB, containerWidth, containerHeight, reduceMotion);

  const bucketBStyle = useAnimatedStyle(() => ({ opacity: blend }), [blend]);

  return (
    <Animated.View style={styles.fill}>
      <Animated.View style={[styles.fill, a.primaryStyle]}>
        <Image source={a.source} resizeMode="cover" style={a.imageStyle} />
      </Animated.View>
      <Animated.View style={[styles.fill, a.resetStyle]} pointerEvents="none">
        <Image source={a.source} resizeMode="cover" style={a.imageStyle} />
      </Animated.View>
      <Animated.View style={[styles.fill, bucketBStyle]}>
        <Animated.View style={[styles.fill, b.primaryStyle]}>
          <Image source={b.source} resizeMode="cover" style={b.imageStyle} />
        </Animated.View>
        <Animated.View style={[styles.fill, b.resetStyle]} pointerEvents="none">
          <Image source={b.source} resizeMode="cover" style={b.imageStyle} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/sky/SkyLayerView.tsx
git commit -m "feat: add SkyLayerView parallax layer component"
```

---

### Task 5: `AnimatedSkyBackground` component

**Files:**
- Create: `apps/mobile/src/components/sky/AnimatedSkyBackground.tsx`

**Interfaces:**
- Consumes: `computeSunTimes` (existing `../../utils/solarTime.ts`), `getSkyBlend`/`TimeOfDayBucket`/`TIME_OF_DAY_BUCKETS` (existing `../../utils/skyTimeOfDay.ts`), `getSkyWeatherCategory`/`SkyWeatherCategory` (existing `../../utils/weatherParsing.ts`), `getApproximateLocation` (existing `../../services/deviceLocation.ts`), `getCurrentWeather` (existing `../../services/weather.ts`), `SKY_SCENES` (Task 3), `SkyLayerView` (Task 4), `SkyLayer` (Task 1).
- Produces: `AnimatedSkyBackground({ style }: { style?: StyleProp<ViewStyle> })`. Task 6 (`RoninJourneyPrototype.tsx`) imports it.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/components/sky/AnimatedSkyBackground.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { computeSunTimes } from '../../utils/solarTime';
import { getSkyBlend, type TimeOfDayBucket } from '../../utils/skyTimeOfDay';
import { getSkyWeatherCategory, type SkyWeatherCategory } from '../../utils/weatherParsing';
import { getApproximateLocation } from '../../services/deviceLocation';
import { getCurrentWeather } from '../../services/weather';
import { SKY_SCENES } from './skyScenes';
import { SkyLayerView } from './SkyLayerView';
import type { SkyLayer } from '../../utils/loopingScroll';

const TICK_MS = 60 * 1000;
const FALLBACK_BUCKET: TimeOfDayBucket = 'midday';
const FALLBACK_WEATHER: SkyWeatherCategory = 'clear';
const WEATHER_CROSSFADE_MS = 3000;
const LAYERS: SkyLayer[] = ['sky', 'midground', 'foreground'];

interface AnimatedSkyBackgroundProps {
  style?: StyleProp<ViewStyle>;
}

function LayerStack({
  bucketA,
  bucketB,
  blend,
  weather,
  containerWidth,
  containerHeight,
  reduceMotion,
}: {
  bucketA: TimeOfDayBucket;
  bucketB: TimeOfDayBucket;
  blend: number;
  weather: SkyWeatherCategory;
  containerWidth: number;
  containerHeight: number;
  reduceMotion: boolean;
}) {
  return (
    <>
      {LAYERS.map((layer) => (
        <SkyLayerView
          key={layer}
          layer={layer}
          sourceA={SKY_SCENES[bucketA][weather][layer]}
          sourceB={SKY_SCENES[bucketB][weather][layer]}
          blend={blend}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

export function AnimatedSkyBackground({ style }: AnimatedSkyBackgroundProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [sunTimes, setSunTimes] = useState<{ sunrise: Date; sunset: Date } | null>(null);
  const [weatherCategory, setWeatherCategory] = useState<SkyWeatherCategory>(FALLBACK_WEATHER);
  const [previousWeatherCategory, setPreviousWeatherCategory] = useState<SkyWeatherCategory | null>(null);
  const [bucketA, setBucketA] = useState<TimeOfDayBucket>(FALLBACK_BUCKET);
  const [bucketB, setBucketB] = useState<TimeOfDayBucket>(FALLBACK_BUCKET);
  const [blend, setBlend] = useState(0);

  const weatherOpacity = useSharedValue(1);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getApproximateLocation().then((location) => {
      if (cancelled || !location) return;
      locationRef.current = location;
      setSunTimes(computeSunTimes(location.latitude, location.longitude, new Date()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function tick() {
      if (sunTimes) {
        const result = getSkyBlend(sunTimes, new Date());
        setBucketA(result.bucketA);
        setBucketB(result.bucketB);
        setBlend(result.blend);
      }
      const location = locationRef.current;
      if (location) {
        getCurrentWeather(location.latitude, location.longitude).then((weather) => {
          if (!weather) return;
          const category = getSkyWeatherCategory(weather.conditionCode);
          setWeatherCategory((current) => {
            if (current === category) return current;
            setPreviousWeatherCategory(current);
            weatherOpacity.value = 0;
            weatherOpacity.value = withTiming(1, {
              duration: reduceMotion ? 0 : WEATHER_CROSSFADE_MS,
              easing: Easing.inOut(Easing.sin),
              reduceMotion: ReduceMotion.Never,
            });
            return category;
          });
        });
      }
    }
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [sunTimes, reduceMotion, weatherOpacity]);

  const currentWeatherStyle = useAnimatedStyle(() => ({ opacity: weatherOpacity.value }));
  const previousWeatherStyle = useAnimatedStyle(() => ({ opacity: 1 - weatherOpacity.value }));

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={[styles.fill, style]} onLayout={handleLayout}>
      {size.width > 0 && size.height > 0 && (
        <>
          <Animated.View style={[styles.fill, currentWeatherStyle]}>
            <LayerStack
              bucketA={bucketA}
              bucketB={bucketB}
              blend={blend}
              weather={weatherCategory}
              containerWidth={size.width}
              containerHeight={size.height}
              reduceMotion={reduceMotion}
            />
          </Animated.View>
          {previousWeatherCategory !== null && (
            <Animated.View style={[styles.fill, previousWeatherStyle]} pointerEvents="none">
              <LayerStack
                bucketA={bucketA}
                bucketB={bucketB}
                blend={blend}
                weather={previousWeatherCategory}
                containerWidth={size.width}
                containerHeight={size.height}
                reduceMotion={reduceMotion}
              />
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/sky/AnimatedSkyBackground.tsx
git commit -m "feat: add AnimatedSkyBackground component"
```

---

### Task 6: Wire `AnimatedSkyBackground` into `RoninJourneyPrototype`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx` (import near the other local imports; remove the unused `sunsetTrail` require; replace the `background` prop's `Image`)

**Interfaces:**
- Consumes: `AnimatedSkyBackground` from `../sky/AnimatedSkyBackground` (Task 5).
- No change to `RoninJourneyPrototype`'s own exported props.

- [ ] **Step 1: Add the import**

In `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`, add after the `import { RoninWalkCycleSprite } from './RoninWalkCycleSprite';` import:

```ts
import { AnimatedSkyBackground } from '../sky/AnimatedSkyBackground';
```

- [ ] **Step 2: Remove the now-unused static background require**

Find and remove this line:

```ts
const sunsetTrail = require('../../../assets/ronin/journey/sunset-trail-background-v1.jpg');
```

- [ ] **Step 3: Replace the background render**

Find:

```tsx
      background={<Image source={sunsetTrail} resizeMode="cover" style={styles.background} />}
```

Replace with:

```tsx
      background={<AnimatedSkyBackground style={styles.background} />}
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error, and no unused-variable warning for `sunsetTrail` (it's removed, not just unreferenced).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: use AnimatedSkyBackground as the journey widget's scrolling sky"
```

---

### Task 7: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Run the full test suite and typecheck**

Run (from `apps/mobile/`): `npm test && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: all tests pass (including `loopingScroll.test.ts`), only the pre-existing `database.ts` typecheck error.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (port 8082 per `apps/mobile/CLAUDE.md`'s convention), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm the parallax scroll is visible and depth reads correctly**

Watch the widget for at least 30 seconds. Expected: all 3 layers are continuously, slowly drifting left; the foreground (pine trees/ground) moves visibly faster than the midground (mountain/torii), which moves faster than the sky — a clear sense of depth, not all layers moving in lockstep.

- [ ] **Step 4: Confirm the scene matches real time/weather**

Expected: matches the actual current time of day and weather condition (cross-check against a weather app), same as the original spec's verification.

- [ ] **Step 5: Watch through a full loop-reset on the fastest layer**

Since `foreground` loops every 3 minutes, watch continuously for that long. Expected: at the reset point, a brief (~1.5s) soft dissolve — not a hard jump-cut — as the foreground layer restarts its scroll from the beginning.

- [ ] **Step 6: Confirm the fallback with location denied**

In iOS Settings → Privacy & Security → Location Services, deny location for the RKA OS dev client, relaunch, and check the journey widget. Expected: the `midday`/`clear` fallback scene renders and scrolls normally, no crash, no blank view. Restore location permission afterward.

- [ ] **Step 7: Confirm Reduce Motion behavior**

Enable iOS Settings → Accessibility → Motion → Reduce Motion, force-reload. Expected: all 3 layers are frozen (no scrolling), showing the correct current bucket/weather scene statically. Turn Reduce Motion back off afterward.

- [ ] **Step 8: Performance check**

With Reduce Motion off (full animation running), interact with the rest of Home (scroll the task list, switch tabs) while the journey widget is on-screen. Expected: no visible frame drops or stutter attributable to the sky background specifically. If there is a noticeable performance issue, the documented follow-up optimization (per the spec's §6) is mounting each layer's reset copy only shortly before it's needed rather than keeping all copies permanently mounted — do not build that optimization speculatively if this check passes.

- [ ] **Step 9: Confirm existing journey widget behavior is unaffected**

Re-run the tap/Jump/Bow button checks from `docs/superpowers/plans/2026-08-16-ronin-jump-bow-buttons.md`'s Task 5 — the sky change only touches the `background` prop.

- [ ] **Step 10: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
