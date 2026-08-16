# Ronin Sprite State System + Tap-Reaction Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `RoninWalkCycleSprite`'s hardcoded `isWalking` boolean branch with a generic, extensible sprite-state registry (loop + one-shot states), then pilot it with an upgraded tap-reaction animation that replaces the current text-bubble reaction — and fix the green-fringe artifact in the shared PNG-slicing pipeline along the way.

**Architecture:** `RoninWalkCycleSprite` takes a `state: RoninSpriteState` prop and looks up `{frames, intervalMs, loopMode}` from a module-level registry instead of branching on `isWalking`; one-shot (`loopMode: 'once'`) states stop advancing at the last frame and fire an `onComplete` callback. `RoninJourneyPrototype` computes `spriteState` from its existing `isProgressAnimating`/`isHolding` state plus a new `isTapReacting` flag, and removes the old `REACTIONS` text-bubble UI in favor of the new one-shot pose. `build-ronin-walk-cycle-frames.py` gets a tighter alpha falloff + edge erosion/feather pass to kill the green fringe, validated first against the existing walk-cycle frames before slicing the new tap-reaction sheet.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), `react-native-reanimated` (host widget only, unchanged), Python 3 + Pillow/numpy/scipy (existing asset-script stack), Node's built-in test runner (`node:test` + `node:assert/strict`).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-16-ronin-sprite-state-system-design.md` — every task below implements part of it.
- Pure-logic unit tests follow this codebase's existing convention: `node:test` + `node:assert/strict`, a `// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.` header comment, imports using the explicit `.ts` extension. Run via `npm test` or `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test <file>` from `apps/mobile/`.
- No new npm dependencies. No new Python dependencies beyond the existing `numpy`/`Pillow`/`scipy`.
- iOS-first; no desktop web work and no `WEB_PARITY.md` update in this pass.
- `npx tsc --noEmit` (from `apps/mobile/`) must stay clean after every task that touches `.ts`/`.tsx` files (ignore pre-existing `Cannot find module './DetailPanel'`-style errors under `src/webApp/` — known false alarm per `apps/mobile/CLAUDE.md`).
- This plan does not build celebration, time-of-day, or any state beyond `tapReaction` — those are future specs/plans built on top of the registry this plan lands.

---

### Task 1: Fringe fix — tighten alpha falloff + edge erosion in the slicing script

**Files:**
- Modify: `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`

**Interfaces:**
- No change to the script's CLI (`--source`, `--output-dir`, `--frame-count`, `--prefix`) or its role as the shared slicer for every state's frames — Task 2 (idle-cycle regen check) and Task 6 (tap-reaction slicing) both invoke it unchanged.

- [ ] **Step 1: Add erosion import**

In `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`, change:

```python
from scipy.ndimage import label, find_objects
```

to:

```python
from scipy.ndimage import binary_erosion, gaussian_filter, label, find_objects
```

- [ ] **Step 2: Narrow the alpha falloff band and erode+feather the mask**

Replace the `build_frame` function's alpha-computation block:

```python
    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.5) / (GREEN_TOLERANCE * 0.5), 0.0, 1.0)
    alpha[~crop_mask] = 0.0
    corrected_rgb = despill(crop_rgb, alpha)
```

with:

```python
    # Erode the mask by EDGE_EROSION_PX before compositing: the outermost
    # ring of keyed pixels is the least reliable green-key data (most mixed
    # with background), so we discard it rather than try to color-correct
    # it — this is what actually kills the residual green fringe that a
    # despill-only pass leaves behind.
    eroded_mask = binary_erosion(crop_mask, iterations=EDGE_EROSION_PX) if EDGE_EROSION_PX > 0 else crop_mask

    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    # Narrower falloff band (0.85x tolerance instead of 0.5x) means fewer
    # semi-transparent edge pixels retain any green tint at all.
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.85) / (GREEN_TOLERANCE * 0.15), 0.0, 1.0)
    alpha[~eroded_mask] = 0.0
    if ALPHA_FEATHER_SIGMA > 0:
        alpha = gaussian_filter(alpha, sigma=ALPHA_FEATHER_SIGMA)
    corrected_rgb = despill(crop_rgb, alpha)
```

- [ ] **Step 3: Add the two new tuning constants**

In `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`, near the existing `GREEN_TOLERANCE`/`HEAD_TOP_MARGIN_PX` constants, add:

```python
EDGE_EROSION_PX = 1  # shrink the foreground mask by this many px before compositing, to drop unreliable green-key edge pixels
ALPHA_FEATHER_SIGMA = 0.6  # Gaussian blur radius applied to the alpha channel only, softens the eroded edge instead of leaving a hard cutoff
```

- [ ] **Step 4: Typecheck is N/A (Python) — syntax-check instead**

Run (from `apps/mobile/`): `python3 -c "import ast; ast.parse(open('scripts/build-ronin-walk-cycle-frames.py').read())"`
Expected: no output (parses cleanly).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/scripts/build-ronin-walk-cycle-frames.py
git commit -m "fix: tighten green-key alpha falloff and erode/feather mask edges"
```

---

### Task 2: Validate the fringe fix against the existing walk-cycle frames

**Files:** none modified — regenerates `apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-01.png` … `ronin-walk-08.png` in place.

**Interfaces:** none — this task only validates Task 1's script change before Task 6 uses it on new content.

- [ ] **Step 1: Back up current output for comparison**

Run (from `apps/mobile/`): `mkdir -p /tmp/ronin-walk-before && cp assets/ronin/journey/walk-cycle/ronin-walk-*.png /tmp/ronin-walk-before/`
Expected: 8 files copied.

- [ ] **Step 2: Re-run the slicer with the fixed script**

Run (from `apps/mobile/`): `python3 scripts/build-ronin-walk-cycle-frames.py --source assets/ronin/journey/walk-cycle/source/ronin-walk-cycle-sheet-raw.png --output-dir assets/ronin/journey/walk-cycle --frame-count 8 --prefix ronin-walk`
Expected: 8 lines of `wrote .../ronin-walk-0N.png (WxH)`, all with the same `WxH` as before (dimensions shouldn't change, only edge pixels).

- [ ] **Step 3: Visually compare old vs. new**

Run: `open /tmp/ronin-walk-before/ronin-walk-01.png assets/ronin/journey/walk-cycle/ronin-walk-01.png /tmp/ronin-walk-before/ronin-walk-05.png assets/ronin/journey/walk-cycle/ronin-walk-05.png`
Expected: new versions show no visible green fringe around the silhouette edge (previously visible, per the user's earlier report) against Preview's default checkerboard/white background. Also confirm the silhouette isn't visibly over-eroded (no missing fingers/notches, no doubled edge). If over-eroded, lower `EDGE_EROSION_PX` to 0 in Task 1's script and re-run this step; if fringe persists, raise the alpha falloff narrowing (e.g. `0.9` instead of `0.85`) and re-run.

- [ ] **Step 4: Verify alpha still present**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-0{1..8}.png`
Expected: `hasAlpha: yes` for all 8.

- [ ] **Step 5: Commit the regenerated frames**

```bash
git add apps/mobile/assets/ronin/journey/walk-cycle/
git commit -m "fix: regenerate walk-cycle frames with despill/erosion fix"
```

---

### Task 3: Pure helper — one-shot frame advance

**Files:**
- Modify: `apps/mobile/src/utils/walkCycle.ts`
- Test: `apps/mobile/src/utils/walkCycle.test.ts`

**Interfaces:**
- Produces (new, alongside existing `WALK_CYCLE_FRAME_COUNT`/`WALK_CYCLE_FRAME_INTERVAL_MS`/`getNextWalkCycleFrame`): `getNextSpriteFrame(currentFrame: number, frameCount: number, loopMode: 'loop' | 'once'): { frame: number; didComplete: boolean }`. Task 5 (`RoninWalkCycleSprite.tsx`) imports `getNextSpriteFrame`.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/utils/walkCycle.test.ts` (append — do not remove the existing three tests):

```ts
import { getNextSpriteFrame } from './walkCycle.ts';

test('loop mode wraps back to 0 after the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(3, 4, 'loop'), { frame: 0, didComplete: false });
});

test('loop mode advances normally before the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(1, 4, 'loop'), { frame: 2, didComplete: false });
});

test('once mode advances normally before the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(1, 4, 'once'), { frame: 2, didComplete: false });
});

test('once mode holds on the last frame and reports completion', () => {
  assert.deepEqual(getNextSpriteFrame(3, 4, 'once'), { frame: 3, didComplete: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/mobile/`): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/walkCycle.test.ts`
Expected: FAIL — `getNextSpriteFrame` is not exported yet.

- [ ] **Step 3: Write the implementation**

Append to `apps/mobile/src/utils/walkCycle.ts`:

```ts
export function getNextSpriteFrame(
  currentFrame: number,
  frameCount: number,
  loopMode: 'loop' | 'once',
): { frame: number; didComplete: boolean } {
  if (loopMode === 'once' && currentFrame >= frameCount - 1) {
    return { frame: frameCount - 1, didComplete: true };
  }
  return { frame: getNextWalkCycleFrame(currentFrame, frameCount), didComplete: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/walkCycle.test.ts`
Expected: PASS, 7 tests total (3 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/walkCycle.ts apps/mobile/src/utils/walkCycle.test.ts
git commit -m "feat: add one-shot-aware sprite frame advance helper"
```

---

### Task 4: Sprite state registry types

**Files:**
- Create: `apps/mobile/src/components/home/roninSpriteStates.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `RoninSpriteState = 'idle' | 'walking' | 'tapReaction'`, `SpriteStateConfig { frames: number[]; intervalMs: number; loopMode: 'loop' | 'once' }`. Task 5 (`RoninWalkCycleSprite.tsx`) imports both, builds the registry with these types, and imports `RoninSpriteState` for its own prop.

- [ ] **Step 1: Write the file**

Create `apps/mobile/src/components/home/roninSpriteStates.ts`:

```ts
export type RoninSpriteState = 'idle' | 'walking' | 'tapReaction';

export interface SpriteStateConfig {
  frames: number[];
  intervalMs: number;
  loopMode: 'loop' | 'once';
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors (this file has no runtime logic, just types — should be a no-op on typecheck).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/roninSpriteStates.ts
git commit -m "feat: add Ronin sprite state registry types"
```

---

### Task 5: Rewrite `RoninWalkCycleSprite` as a generic state player

**Files:**
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx` (full rewrite of the component body; frame `require()` arrays stay, `IDLE_CYCLE_FRAME_COUNT` const is removed since the registry derives it)

**Interfaces:**
- Consumes: `getNextSpriteFrame` from `../../utils/walkCycle` (Task 3). Consumes `RoninSpriteState`, `SpriteStateConfig` from `./roninSpriteStates` (Task 4).
- Produces: `RoninWalkCycleSprite({ style, state, onComplete }: { style?: StyleProp<ImageStyle>; state: RoninSpriteState; onComplete?: () => void })`. Task 7 (`RoninJourneyPrototype.tsx`) imports this new prop shape, replacing its current `isWalking` usage.
- The `'tapReaction'` entry in the registry built here has an empty `frames: []` placeholder array — Task 6 fills in the real `require()`s once the sliced PNGs exist. Task 5's own typecheck/tests do not depend on those files existing.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextSpriteFrame, WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';
import type { RoninSpriteState, SpriteStateConfig } from './roninSpriteStates';

const WALK_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-01.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-02.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-03.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-04.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-05.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-06.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-07.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-08.png'),
];

const IDLE_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle/ronin-idle-01.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-02.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-03.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-04.png'),
];

// Populated by a later task once the tap-reaction sheet is sliced. Kept as
// its own registry entry now (rather than added later) so every consumer of
// SPRITE_STATES already handles an arbitrary state count.
const TAP_REACTION_FRAMES: number[] = [];

// Single source of truth for every sprite state's playback: which frames,
// how fast, and whether it loops forever or plays once and holds. Adding a
// new state (celebration, time-of-day, ...) means adding one entry here and
// to RoninSpriteState — nothing else in this component changes.
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: WALK_CYCLE_FRAMES, intervalMs: WALK_CYCLE_FRAME_INTERVAL_MS, loopMode: 'loop' },
  idle: { frames: IDLE_CYCLE_FRAMES, intervalMs: 650, loopMode: 'loop' },
  tapReaction: { frames: TAP_REACTION_FRAMES, intervalMs: 90, loopMode: 'once' },
};

interface RoninWalkCycleSpriteProps {
  style?: StyleProp<ImageStyle>;
  /** Which animation to play right now — see SPRITE_STATES for the full registry. */
  state: RoninSpriteState;
  /** Fires once when a `loopMode: 'once'` state reaches its last frame. Never called for looping states. */
  onComplete?: () => void;
}

export function RoninWalkCycleSprite({ style, state, onComplete }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setFrameIndex(0);
    const config = SPRITE_STATES[state];
    if (config.frames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => {
        const { frame, didComplete } = getNextSpriteFrame(current, config.frames.length, config.loopMode);
        if (didComplete) {
          clearInterval(interval);
          onCompleteRef.current?.();
        }
        return frame;
      });
    }, config.intervalMs);
    return () => clearInterval(interval);
  }, [state]);

  const frames = SPRITE_STATES[state].frames;
  if (frames.length === 0) return null;
  return <Image source={frames[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors from this file. `RoninJourneyPrototype.tsx` will now error on its old `isWalking` prop — that's expected and fixed in Task 7; confirm the *only* new errors are in `RoninJourneyPrototype.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/RoninWalkCycleSprite.tsx
git commit -m "feat: rewrite RoninWalkCycleSprite as a generic sprite-state player"
```

---

### Task 6: Slice the tap-reaction sprite sheet

**Files:**
- Create: `apps/mobile/assets/ronin/journey/tap-reaction/source/ronin-tap-reaction-sheet-raw.png` (user places this)
- Produces: `apps/mobile/assets/ronin/journey/tap-reaction/ronin-tap-01.png` … `ronin-tap-NN.png`

**Interfaces:**
- Produces: N frame PNGs (N = however many poses are in the generated sheet) at identical canvas dimensions, named `ronin-tap-01.png`…`ronin-tap-NN.png`. Task 7's `RoninWalkCycleSprite.tsx` `TAP_REACTION_FRAMES` array `require()`s these by exact name — the exact frame count must be confirmed here before writing Task 7's step.

- [ ] **Step 1: Save the raw sheet**

Save a green-screen sprite sheet of a bow/wave gesture (side-profile, matching the walk/idle sheets' style) to:

```
apps/mobile/assets/ronin/journey/tap-reaction/source/ronin-tap-reaction-sheet-raw.png
```

Note the number of poses in the sheet — this is `N` for the next step.

- [ ] **Step 2: Run the (already-fixed) slicing script**

Run (from `apps/mobile/`), substituting the actual pose count for `N`:

```bash
python3 scripts/build-ronin-walk-cycle-frames.py \
  --source assets/ronin/journey/tap-reaction/source/ronin-tap-reaction-sheet-raw.png \
  --output-dir assets/ronin/journey/tap-reaction \
  --frame-count N \
  --prefix ronin-tap
```

Expected: N lines of `wrote .../ronin-tap-0N.png (WxH)`, all identical `WxH`.

- [ ] **Step 3: Verify alpha and inspect for fringe/alignment**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/tap-reaction/ronin-tap-*.png`
Expected: `hasAlpha: yes` for all frames.

Run: `open apps/mobile/assets/ronin/journey/tap-reaction/ronin-tap-*.png`
Expected: no visible green fringe (this uses Task 1's fixed script already); head height consistent across frames; poses read as a continuous bow/wave gesture in sequence.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/assets/ronin/journey/tap-reaction/
git commit -m "feat: slice Ronin tap-reaction sprite sheet into aligned frames"
```

---

### Task 7: Wire the tap-reaction frames into the registry

**Files:**
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`

**Interfaces:**
- Consumes: the frame PNGs from Task 6, by the exact filenames/count confirmed there.
- No change to the component's exported props/behavior from Task 5 — this only fills in real frame data.

- [ ] **Step 1: Replace the empty tap-reaction frame array**

In `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`, replace:

```ts
const TAP_REACTION_FRAMES: number[] = [];
```

with the real list, using Task 6's actual frame count (example shown for N=6 — adjust to match):

```ts
const TAP_REACTION_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/RoninWalkCycleSprite.tsx
git commit -m "feat: wire tap-reaction frames into the sprite state registry"
```

---

### Task 8: Swap `RoninJourneyPrototype` to the new state prop and remove the text bubble

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`

**Interfaces:**
- Consumes: `RoninWalkCycleSprite`'s new `state`/`onComplete` props (Task 5), `RoninSpriteState` from `./roninSpriteStates` (Task 4).
- No change to `RoninJourneyPrototype`'s own exported props (`completedCount`, `totalCount`, `isDark`, `potentialPercent`).

- [ ] **Step 1: Add the `RoninSpriteState` import**

In `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`, add alongside the existing `RoninWalkCycleSprite` import (line 17):

```ts
import type { RoninSpriteState } from './roninSpriteStates';
```

- [ ] **Step 2: Remove the `REACTIONS` array and `reactionIndex` state**

Remove line 28:

```ts
const REACTIONS = ['Onward.', 'One step at a time.', 'The path is yours.'];
```

Remove line 54:

```ts
  const [reactionIndex, setReactionIndex] = useState(0);
```

- [ ] **Step 3: Add `isTapReacting` state**

Immediately after the `isProgressAnimating` state declaration (currently line 60), add:

```ts
  // True while the one-shot tap-reaction sprite animation is playing —
  // takes priority over walking/idle until RoninWalkCycleSprite's
  // onComplete fires and reverts it.
  const [isTapReacting, setIsTapReacting] = useState(false);
```

- [ ] **Step 4: Compute the sprite state**

Immediately after the `const isWalking = isHolding || isProgressAnimating;` line (currently line 143), replace it with:

```ts
  const isWalking = isHolding || isProgressAnimating;
  const spriteState: RoninSpriteState = isTapReacting ? 'tapReaction' : isWalking ? 'walking' : 'idle';
```

- [ ] **Step 5: Update `handlePress` to trigger the tap reaction instead of cycling reaction text**

Replace the `handlePress` function:

```ts
  const handlePress = () => {
    setReactionIndex((current) => (current + 1) % REACTIONS.length);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reaction.value = 0;
    reaction.value = withSequence(
      ReduceMotion.Never,
      withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      }),
      withTiming(0, {
        duration: 460,
        easing: Easing.out(Easing.bounce),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  };
```

with:

```ts
  const handlePress = () => {
    setIsTapReacting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reaction.value = 0;
    reaction.value = withSequence(
      ReduceMotion.Never,
      withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      }),
      withTiming(0, {
        duration: 460,
        easing: Easing.out(Easing.bounce),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  };

  const handleTapReactionComplete = () => setIsTapReacting(false);
```

- [ ] **Step 6: Remove the `bubbleStyle` animated style**

Remove the `bubbleStyle` block:

```ts
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reaction.value, [0, 0.15, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(reaction.value, [0, 1], [5, 0]) },
      { scale: interpolate(reaction.value, [0, 1], [0.9, 1]) },
    ],
  }));
```

- [ ] **Step 7: Replace the walker render**

Replace:

```tsx
        <Animated.View pointerEvents="none" style={[styles.walker, walkerStyle]}>
          <RoninWalkCycleSprite style={styles.walkerImage} isWalking={isWalking} />
          <Animated.View style={[styles.reactionBubble, bubbleStyle]}>
            <Text style={styles.reactionText}>{REACTIONS[reactionIndex]}</Text>
          </Animated.View>
        </Animated.View>
```

with:

```tsx
        <Animated.View pointerEvents="none" style={[styles.walker, walkerStyle]}>
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleTapReactionComplete} />
        </Animated.View>
```

- [ ] **Step 8: Remove the now-unused `reactionBubble`/`reactionText` styles**

Remove from the `StyleSheet.create` block:

```ts
  reactionBubble: {
    position: 'absolute',
    right: -28,
    top: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  reactionText: {
    color: '#26203c',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
  },
```

- [ ] **Step 9: Remove the now-unused `Text` import if nothing else in the file uses it**

Check remaining `Text` usage: `progressLabel`/`eyebrow`/`percent`/`potentialCaption` Text elements in the JSX (around lines 208-216) still use `Text` — **keep** the `Text` import from `react-native` (line 2). Do not remove it.

- [ ] **Step 10: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors. Confirm no unused-import/unused-variable warnings for `REACTIONS`, `reactionIndex`, `bubbleStyle`, `interpolate` (check `interpolate` is still used elsewhere in the file — it is, in `walkerStyle`, so keep that import).

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: replace text-bubble tap reaction with animated sprite pose"
```

---

### Task 9: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Run the full test suite and typecheck**

Run (from `apps/mobile/`): `npm test && npx tsc --noEmit`
Expected: all tests pass (including Task 3's 4 new one-shot tests), no typecheck errors.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (port 8082 per this project's convention), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm idle and walking states still work exactly as before**

Watch the widget while stationary (idle loop plays) and complete a task (walk cycle plays while progress animates). Expected: identical behavior to before this plan — the registry rewrite should be behavior-preserving for these two states.

- [ ] **Step 4: Confirm the new tap-reaction animation**

Tap the widget. Expected: haptic fires, hop/scale bounce plays (unchanged), and instead of a text bubble the sprite itself plays the bow/wave animation once, then returns to whatever it was doing before the tap (idle if stationary, walking if a completion was still animating).

- [ ] **Step 5: Confirm tap during an active walk**

Complete a task (triggering the walk cycle) and tap the widget while it's still walking. Expected: tap reaction plays, then the sprite resumes the walk cycle (not idle) once the reaction completes and the character is still mid-animation.

- [ ] **Step 6: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
