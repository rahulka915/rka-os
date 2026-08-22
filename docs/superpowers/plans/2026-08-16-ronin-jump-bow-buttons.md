# Ronin Jump/Bow Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home journey widget's single ambiguous tap (which currently plays a hop transform and a bow-down sprite animation simultaneously) with two explicit, distinct actions — a Jump button and a Bow button — while the character tap itself keeps only the light hop reaction.

**Architecture:** A one-time Python script slices a new jump-pose sprite sheet into individually-usable transparent PNGs, following the exact pattern already used for the walk-cycle and tap-reaction sheets. The existing `tapReaction` sprite state is renamed to `bow` (same frames, same behavior, new name) and a new `jump` state is added to the same registry. `RoninJourneyPrototype.tsx`'s tap handler is decoupled from sprite-state switching, and two small overlay icon buttons are added that each drive one one-shot sprite animation via a new `activeAction` state.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), `react-native-reanimated` (unchanged, reused hop/scale sequence), `lucide-react-native` (already a dependency, used for button glyphs), Python 3 + Pillow/numpy/scipy for the one-time asset script (matches this repo's existing convention).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md` — every task below implements part of it.
- No changes to walk-cycle, idle, or hold-to-preview-walk behavior.
- No new npm dependencies.
- No web port in this pass — this widget is native/iOS-only; no `WEB_PARITY.md` update needed.
- Only one one-shot animation (jump or bow) plays at a time — a button press while one is already mid-animation is a no-op.
- `npx tsc --noEmit` (run from `apps/mobile/`) must stay clean after every task that touches `.ts`/`.tsx` files.

---

### Task 1: Slice the raw jump sprite sheet into aligned, keyed frame PNGs

**Files:**
- Create: `apps/mobile/assets/ronin/journey/jump/source/ronin-jump-sheet-raw.png` (you place this — generated externally, per the design spec)
- Create: `apps/mobile/scripts/build-ronin-jump-frames.py`
- Produces: `apps/mobile/assets/ronin/journey/jump/ronin-jump-01.png` … `ronin-jump-0N.png` (N = however many poses the sheet actually contains, printed by the script)

**Interfaces:**
- Produces: N PNG files at fixed, identical canvas dimensions, each with real alpha transparency, named `ronin-jump-01.png`…`ronin-jump-0N.png` in left-to-right pose order. Task 2 (`RoninWalkCycleSprite.tsx`) `require()`s these files by these exact names — the exact value of N must be read from this task's script output before starting Task 2.

- [ ] **Step 1: Save the raw sheet**

Save the externally-generated green-screen (`#00FF00`) jump-pose sprite sheet to exactly this path (create the directory if it doesn't exist):

```
apps/mobile/assets/ronin/journey/jump/source/ronin-jump-sheet-raw.png
```

- [ ] **Step 2: Install the Python image-processing dependencies**

Run: `python3 -m pip install --user numpy Pillow scipy`
Expected: install succeeds (or reports already satisfied).

- [ ] **Step 3: Write the slicing/alignment/despill script**

Create `apps/mobile/scripts/build-ronin-jump-frames.py`:

```python
#!/usr/bin/env python3
"""Slice, align, and key the Ronin jump sprite sheet into individual frame PNGs.

Input: a single green-screen (#00FF00) sheet containing side-profile jump-pose
frames, left to right, generated per
docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md.

Output: apps/mobile/assets/ronin/journey/jump/ronin-jump-01.png ..
ronin-jump-0N.png (N auto-detected from the sheet), each on an identical-size
transparent canvas, head-top-anchored so frame-swapping doesn't jitter.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = MOBILE_ROOT / "assets" / "ronin" / "journey" / "jump" / "source" / "ronin-jump-sheet-raw.png"
OUTPUT_DIR = MOBILE_ROOT / "assets" / "ronin" / "journey" / "jump"
MIN_FRAME_COUNT = 2
MAX_FRAME_COUNT = 12
PAD_PX = 24
GREEN_KEY = np.array([0, 255, 0], dtype=np.float32)
GREEN_TOLERANCE = 90.0  # euclidean RGB distance under which a pixel counts as background
HEAD_TOP_MARGIN_PX = 20  # distance from canvas top to each frame's topmost foreground pixel


def load_source() -> np.ndarray:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {SOURCE_PATH}. Save the generated sheet there before running this script."
        )
    image = Image.open(SOURCE_PATH).convert("RGB")
    return np.array(image)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    distance = np.linalg.norm(rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    return distance > GREEN_TOLERANCE


def find_character_boxes(mask: np.ndarray) -> list[tuple[slice, slice]]:
    labeled, count = label(mask)
    if not (MIN_FRAME_COUNT <= count <= MAX_FRAME_COUNT):
        raise ValueError(
            f"Found {count} separate characters in the sheet, expected between "
            f"{MIN_FRAME_COUNT} and {MAX_FRAME_COUNT}. Check the source sheet for "
            "touching/merged silhouettes or stray specks before re-running."
        )
    boxes = find_objects(labeled)
    # Sort left-to-right by the box's horizontal start, matching pose order.
    return sorted(boxes, key=lambda box: box[1].start)


def despill(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    # Standard green-spill fix: where a pixel is semi-transparent (edge of the
    # key), pull its green channel down toward the min of red/blue so no green
    # fringe survives compositing over a non-green background.
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    spill_strength = np.clip(1.0 - alpha, 0.0, 1.0)
    corrected_g = np.where(
        g > np.minimum(r, b),
        np.minimum(r, b) + (g - np.minimum(r, b)) * (1.0 - spill_strength),
        g,
    )
    return np.stack([r, corrected_g, b], axis=-1)


def build_frame(rgb: np.ndarray, mask: np.ndarray, box: tuple[slice, slice], canvas_size: int) -> Image.Image:
    row_slice, col_slice = box
    top = max(row_slice.start - PAD_PX, 0)
    bottom = min(row_slice.stop + PAD_PX, rgb.shape[0])
    left = max(col_slice.start - PAD_PX, 0)
    right = min(col_slice.stop + PAD_PX, rgb.shape[1])

    crop_rgb = rgb[top:bottom, left:right]
    crop_mask = mask[top:bottom, left:right]

    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.5) / (GREEN_TOLERANCE * 0.5), 0.0, 1.0)
    alpha[~crop_mask] = 0.0
    corrected_rgb = despill(crop_rgb, alpha)

    rgba = np.dstack([corrected_rgb, alpha * 255.0]).astype(np.uint8)
    frame = Image.fromarray(rgba, mode="RGBA")

    # Head-top anchor: topmost foreground row within this crop.
    foreground_rows = np.where(crop_mask.any(axis=1))[0]
    head_top_y = int(foreground_rows[0]) if len(foreground_rows) else 0
    foreground_cols = np.where(crop_mask.any(axis=0))[0]
    center_x = int((foreground_cols[0] + foreground_cols[-1]) / 2) if len(foreground_cols) else frame.width // 2

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    paste_x = canvas_size // 2 - center_x
    paste_y = HEAD_TOP_MARGIN_PX - head_top_y
    canvas.paste(frame, (paste_x, paste_y), frame)
    return canvas


def main() -> None:
    rgb = load_source()
    mask = foreground_mask(rgb)
    boxes = find_character_boxes(mask)

    # Canvas must fit the largest cropped frame plus padding, shared by all
    # frames so swapping never changes the Image element's own size.
    max_dim = 0
    for row_slice, col_slice in boxes:
        height = (row_slice.stop - row_slice.start) + PAD_PX * 2
        width = (col_slice.stop - col_slice.start) + PAD_PX * 2
        max_dim = max(max_dim, height, width)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, box in enumerate(boxes, start=1):
        frame = build_frame(rgb, mask, box, max_dim)
        out_path = OUTPUT_DIR / f"ronin-jump-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")

    print(f"TOTAL FRAMES: {len(boxes)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the script**

Run (from `apps/mobile/`): `python3 scripts/build-ronin-jump-frames.py`
Expected: one `wrote .../ronin-jump-0N.png (WxH)` line per frame (all with the same `WxH`), followed by `TOTAL FRAMES: <N>`. **Write down the printed `<N>` value — Task 2 needs it.** If it raises `ValueError`, inspect the raw sheet for touching/merged silhouettes or stray specks and either re-crop the source or adjust `GREEN_TOLERANCE`, then re-run.

- [ ] **Step 5: Verify alpha and inspect alignment**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/jump/ronin-jump-*.png`
Expected: `hasAlpha: yes` for every file.

Open the first, middle, and last frame side by side (e.g. `open apps/mobile/assets/ronin/journey/jump/ronin-jump-01.png apps/mobile/assets/ronin/journey/jump/ronin-jump-0N.png` substituting the real N) and confirm the head-top anchor keeps the character roughly aligned across the pose — some limb/torso movement between frames is expected (that's the jump), not a bug.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/scripts/build-ronin-jump-frames.py apps/mobile/assets/ronin/journey/jump/
git commit -m "feat: slice Ronin jump sprite sheet into aligned frames"
```

---

### Task 2: Rename `tapReaction` to `bow` and register the new `jump` state

**Files:**
- Modify: `apps/mobile/src/components/home/roninSpriteStates.ts:1`
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx:5,28-45`

**Interfaces:**
- Consumes: the exact frame count N and filenames from Task 1's output.
- Produces: `RoninSpriteState = 'idle' | 'walking' | 'jump' | 'bow'`; `SPRITE_STATES` registry entries for `'jump'` and `'bow'`. Task 3 (`RoninJourneyPrototype.tsx`) consumes both new state names.

- [ ] **Step 1: Update the `RoninSpriteState` union**

In `apps/mobile/src/components/home/roninSpriteStates.ts`, replace line 1:

```ts
export type RoninSpriteState = 'idle' | 'walking' | 'tapReaction';
```

with:

```ts
export type RoninSpriteState = 'idle' | 'walking' | 'jump' | 'bow';
```

- [ ] **Step 2: Rename the tap-reaction frame constant and add the jump frame constant**

In `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`, replace lines 25-35:

```ts
// Populated by a later task once the tap-reaction sheet is sliced. Kept as
// its own registry entry now (rather than added later) so every consumer of
// SPRITE_STATES already handles an arbitrary state count.
const TAP_REACTION_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];
```

with (this is the bow-down-to-pet-the-cat animation, triggered by the Bow button, not by tapping the character):

```ts
const BOW_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];

const JUMP_FRAMES: number[] = [
  require('../../../assets/ronin/journey/jump/ronin-jump-01.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-02.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-03.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-04.png'),
];
```

**Before saving, replace the `JUMP_FRAMES` array above with one `require(...)` line per frame Task 1 actually produced** (`ronin-jump-01.png` through `ronin-jump-0N.png`, using Task 1's real printed `N` — the four lines shown are a placeholder shape only, not a claim about the real count).

- [ ] **Step 3: Update the `SPRITE_STATES` registry**

Replace lines 41-45 (now shifted by the edits above — locate by content, not line number):

```ts
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: WALK_CYCLE_FRAMES, intervalMs: WALK_CYCLE_FRAME_INTERVAL_MS, loopMode: 'loop' },
  idle: { frames: IDLE_CYCLE_FRAMES, intervalMs: 650, loopMode: 'loop' },
  tapReaction: { frames: TAP_REACTION_FRAMES, intervalMs: 90, loopMode: 'once' },
};
```

with:

```ts
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: WALK_CYCLE_FRAMES, intervalMs: WALK_CYCLE_FRAME_INTERVAL_MS, loopMode: 'loop' },
  idle: { frames: IDLE_CYCLE_FRAMES, intervalMs: 650, loopMode: 'loop' },
  bow: { frames: BOW_FRAMES, intervalMs: 90, loopMode: 'once' },
  jump: { frames: JUMP_FRAMES, intervalMs: 90, loopMode: 'once' },
};
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors. (Pre-existing `Cannot find module './DetailPanel'`-style errors under `src/webApp/` are a known false alarm per `apps/mobile/CLAUDE.md` — ignore those specifically.) This will fail if `RoninJourneyPrototype.tsx` still references the old `tapReaction`/`isTapReacting` names — that's expected until Task 3.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/roninSpriteStates.ts apps/mobile/src/components/home/RoninWalkCycleSprite.tsx
git commit -m "feat: rename tap-reaction sprite state to bow and add jump state"
```

---

### Task 3: Decouple character tap from sprite state, add `activeAction`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx:60-63,108-128,149,223`

**Interfaces:**
- Consumes: `RoninSpriteState` (`'idle' | 'walking' | 'jump' | 'bow'`) from Task 2.
- Produces: `activeAction: 'jump' | 'bow' | null` state and `triggerAction(action: 'jump' | 'bow')` / `handleActionComplete()` functions. Task 4 (same file) wires the two new buttons to `triggerAction`.

- [ ] **Step 1: Replace `isTapReacting` state with `activeAction`**

In `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`, replace lines 60-63:

```ts
  // True while the one-shot tap-reaction sprite animation is playing —
  // takes priority over walking/idle until RoninWalkCycleSprite's
  // onComplete fires and reverts it.
  const [isTapReacting, setIsTapReacting] = useState(false);
```

with:

```ts
  // Which one-shot sprite animation (if any) is currently playing — takes
  // priority over walking/idle until RoninWalkCycleSprite's onComplete
  // fires and reverts it to null. Only one plays at a time: triggerAction
  // no-ops while this is already non-null.
  const [activeAction, setActiveAction] = useState<'jump' | 'bow' | null>(null);
```

- [ ] **Step 2: Split `handlePress` into a light tap reaction and a `triggerAction` helper**

Replace lines 109-128:

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

with:

```ts
  const playHopReaction = () => {
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

  // Character tap keeps only a light acknowledgment (the hop) — it no
  // longer switches the sprite to a one-shot animation. Jump/Bow buttons
  // (Task 4) are the explicit way to trigger those.
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playHopReaction();
  };

  // Ignores the press if an action is already playing, so a jump and a bow
  // can never run at once. Jump also plays the hop transform (it's an
  // upward motion, consistent with the hop); Bow does not (it's a downward
  // motion that would visually fight an upward hop).
  const triggerAction = (action: 'jump' | 'bow') => {
    if (activeAction !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveAction(action);
    if (action === 'jump') playHopReaction();
  };

  const handleActionComplete = () => setActiveAction(null);
```

- [ ] **Step 3: Update `spriteState` derivation**

Replace line 149:

```ts
  const spriteState: RoninSpriteState = isTapReacting ? 'tapReaction' : isWalking ? 'walking' : 'idle';
```

with:

```ts
  const spriteState: RoninSpriteState = activeAction ?? (isWalking ? 'walking' : 'idle');
```

- [ ] **Step 4: Update the sprite's `onComplete` wiring**

Replace line 223:

```tsx
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleTapReactionComplete} />
```

with:

```tsx
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleActionComplete} />
```

- [ ] **Step 5: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors. (The Jump/Bow buttons don't exist yet — `triggerAction` is unused until Task 4, which is fine, TypeScript doesn't flag unused local functions as errors under this project's config; if it does, proceed to Task 4 immediately rather than committing an unused-function warning.)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: decouple Ronin character tap from sprite-state switching"
```

---

### Task 4: Add Jump and Bow overlay buttons

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx:1-2,186-225,320-338`

**Interfaces:**
- Consumes: `triggerAction` from Task 3 (same file).
- No change to `RoninJourneyPrototype`'s own exported props (`completedCount`, `totalCount`, `isDark`, `potentialPercent`).

- [ ] **Step 1: Import the button icons**

Replace line 1-2:

```ts
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
```

with:

```ts
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, ChevronsDown } from 'lucide-react-native';
```

- [ ] **Step 2: Add the two buttons inside the widget's `Pressable`**

Replace lines 186-225 (the `<Pressable>` block through its closing tag):

```tsx
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`Today’s path. ${progressLabel}. Ronin and cat.`}
        accessibilityHint="Tap for a reaction, hold to preview the walk"
      >
        <View pointerEvents="none" style={styles.scrim} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(7,10,28,0.55)', 'rgba(7,10,28,0)']}
          locations={[0, 1]}
          style={styles.headingScrim}
        />

        <View pointerEvents="none" style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>{'TODAY’S PATH'}</Text>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
          </View>
          <View style={styles.percentColumn}>
            <Text style={styles.percent}>{Math.round(ratio * 100)}%</Text>
            {potentialPercent !== undefined && (
              <Text style={styles.potentialCaption}>Potential {Math.round(potentialPercent)}%</Text>
            )}
          </View>
        </View>

        <Svg pointerEvents="none" width="100%" height={54} style={styles.progressPath} viewBox="0 0 360 54" preserveAspectRatio="none">
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="rgba(7,17,40,0.48)" strokeWidth={8} strokeLinecap="round" fill="none" />
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="#f2b35f" strokeWidth={3.5} strokeLinecap="round" fill="none" strokeDasharray={`${ratio * 390} 390`} />
        </Svg>

        <Animated.View pointerEvents="none" style={[styles.walker, walkerStyle]}>
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleActionComplete} />
        </Animated.View>
      </Pressable>
```

with:

```tsx
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`Today’s path. ${progressLabel}. Ronin and cat.`}
        accessibilityHint="Tap for a reaction, hold to preview the walk"
      >
        <View pointerEvents="none" style={styles.scrim} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(7,10,28,0.55)', 'rgba(7,10,28,0)']}
          locations={[0, 1]}
          style={styles.headingScrim}
        />

        <View pointerEvents="none" style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>{'TODAY’S PATH'}</Text>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
          </View>
          <View style={styles.percentColumn}>
            <Text style={styles.percent}>{Math.round(ratio * 100)}%</Text>
            {potentialPercent !== undefined && (
              <Text style={styles.potentialCaption}>Potential {Math.round(potentialPercent)}%</Text>
            )}
          </View>
        </View>

        <Svg pointerEvents="none" width="100%" height={54} style={styles.progressPath} viewBox="0 0 360 54" preserveAspectRatio="none">
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="rgba(7,17,40,0.48)" strokeWidth={8} strokeLinecap="round" fill="none" />
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="#f2b35f" strokeWidth={3.5} strokeLinecap="round" fill="none" strokeDasharray={`${ratio * 390} 390`} />
        </Svg>

        <Animated.View pointerEvents="none" style={[styles.walker, walkerStyle]}>
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleActionComplete} />
        </Animated.View>

        <View style={styles.actionButtonRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => triggerAction('jump')}
            disabled={activeAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Jump"
          >
            <ArrowUp size={16} color={JOURNEY_TEXT} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => triggerAction('bow')}
            disabled={activeAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Bow"
          >
            <ChevronsDown size={16} color={JOURNEY_TEXT} strokeWidth={2.5} />
          </Pressable>
        </View>
      </Pressable>
```

- [ ] **Step 3: Add the button styles**

Replace lines 320-338 (from `progressPath:` through the closing `});`):

```ts
  progressPath: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
  },
  walker: {
    position: 'absolute',
    left: 2,
    bottom: 10,
    width: WALKER_SIZE,
    height: WALKER_SIZE,
    zIndex: 4,
  },
  walkerImage: {
    width: '100%',
    height: '100%',
  },
});
```

with:

```ts
  progressPath: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
  },
  walker: {
    position: 'absolute',
    left: 2,
    bottom: 10,
    width: WALKER_SIZE,
    height: WALKER_SIZE,
    zIndex: 4,
  },
  walkerImage: {
    width: '100%',
    height: '100%',
  },
  // In-game HUD-style action buttons, top-right of the card — above the
  // heading scrim/text (zIndex) but out of the way of both the heading copy
  // and the walker's path along the bottom.
  actionButtonRow: {
    position: 'absolute',
    top: 15,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,12,34,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(245,239,228,0.28)',
  },
});
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: add Jump and Bow action buttons to the Ronin journey widget"
```

---

### Task 5: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Typecheck the whole project one more time**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no errors beyond the pre-existing `src/webApp/` false alarms.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (port 8082 per `apps/mobile/CLAUDE.md`'s convention), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm the character tap is now light-only**

Tap the character directly (not the buttons). Expected: a light haptic + a brief hop/scale bounce, and the sprite does **not** switch to the bow pose — it stays on `idle` or `walking` throughout.

- [ ] **Step 4: Confirm the Jump button**

Tap the Jump button (top-right, up-arrow icon). Expected: a light haptic, the hop/scale bounce plays, and the sprite plays through the full jump animation once before reverting to idle/walking.

- [ ] **Step 5: Confirm the Bow button**

Tap the Bow button (top-right, chevrons-down icon). Expected: a light haptic, no hop/scale bounce, and the sprite plays through the full bow-down-to-pet-the-cat animation once before reverting to idle/walking.

- [ ] **Step 6: Confirm mutual exclusion**

Tap Jump, then immediately tap Bow (or the character) while the jump animation is still playing. Expected: the second tap is ignored (no haptic, no state change) until the jump animation completes and `activeAction` reverts to `null`.

- [ ] **Step 7: Confirm existing behavior is unaffected**

Re-run the walk-cycle, Reduce Motion, and progress-driven-travel checks from the original walking-Ronin plan (`docs/superpowers/plans/2026-08-15-simplified-walking-ronin-avatar.md`, Task 7, Steps 3/4/6) to confirm nothing regressed.

- [ ] **Step 8: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
