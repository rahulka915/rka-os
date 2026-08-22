# Simplified Walking Ronin Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reactivate the dormant Home "Today's Path" widget with a small, always-animating chibi Ronin walk-cycle sprite (8-frame flipbook), instead of the parked full-body Rive rig.

**Architecture:** A one-time Python script slices/aligns/keys a generated 8-pose sprite sheet into 8 individually-usable transparent PNGs. A new `RoninWalkCycleSprite` component cycles those frames on a timer. It replaces `RoninJourneyRiveWalker` as the walker rendered inside the existing (currently unmounted) `RoninJourneyPrototype` widget, which is then reactivated in `HomeScreen.tsx`. Two small pure helpers (frame advance, today's completed/total task count) are extracted and unit-tested; the RN component itself is verified manually on-device, matching this codebase's existing test convention (pure logic tested, RN rendering verified live).

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), `react-native-reanimated` (unchanged, used by the host widget only), Python 3 + Pillow/numpy/scipy for the one-time asset script, Node's built-in test runner (`node:test` + `node:assert/strict`) for unit tests.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-15-simplified-walking-ronin-avatar-design.md` — every task below implements part of it.
- Do not modify `apps/mobile/RONIN_RIVE.md`, the `RONIN RIG CLEAN REBUILD` Rive file, or `RoninJourneyRiveWalker.tsx`'s own behavior — the full-body rig stays parked exactly as-is.
- Pure-logic unit tests follow this codebase's existing convention exactly: `node:test` + `node:assert/strict`, a `// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.` header comment, and imports using the explicit `.ts` extension (e.g. `from './walkCycle.ts'`). Run via `npm test` (runs `src/**/*.test.ts`) or directly via `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test <file>` from `apps/mobile/`.
- No new npm dependencies. No new Python dependencies beyond `numpy`/`Pillow`/`scipy`, which are already this repo's convention for one-time asset scripts (see `apps/mobile/scripts/process-hero-environment.py`).
- Reduce Motion must fully stop the walk-cycle animation (freeze on one frame), not just slow it — matching the host widget's existing Reduce Motion behavior for its own bob/rotate animation.
- iOS-first; no desktop web work and no `WEB_PARITY.md` update in this pass — the spec explicitly defers a web port as a separate later decision.
- `npx tsc --noEmit` (run from `apps/mobile/`) must stay clean after every task that touches `.ts`/`.tsx` files.

---

### Task 1: Slice the raw sprite sheet into 8 aligned, keyed frame PNGs

**Files:**
- Create: `apps/mobile/assets/ronin/journey/walk-cycle/source/ronin-walk-cycle-sheet-raw.png` (you place this — the sheet already generated earlier in this project)
- Create: `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`
- Produces: `apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-01.png` … `ronin-walk-08.png`

**Interfaces:**
- Produces: 8 PNG files at fixed, identical canvas dimensions, each with real alpha transparency, named `ronin-walk-01.png`…`ronin-walk-08.png` in left-to-right walk-cycle pose order. Task 5 (`RoninWalkCycleSprite.tsx`) `require()`s these 8 files by these exact names.

- [ ] **Step 1: Save the raw sheet**

Save the previously-generated 8-pose green-screen walk-cycle sprite sheet to exactly this path (create the directory if it doesn't exist):

```
apps/mobile/assets/ronin/journey/walk-cycle/source/ronin-walk-cycle-sheet-raw.png
```

- [ ] **Step 2: Install the Python image-processing dependencies**

Run: `python3 -m pip install --user numpy Pillow scipy`
Expected: install succeeds (or reports already satisfied).

- [ ] **Step 3: Write the slicing/alignment/despill script**

Create `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`:

```python
#!/usr/bin/env python3
"""Slice, align, and key the 8-frame Ronin walk-cycle sprite sheet into individual frame PNGs.

Input: a single green-screen (#00FF00) sheet containing 8 side-profile walk-cycle poses,
left to right, generated per docs/superpowers/specs/2026-08-15-simplified-walking-ronin-avatar-design.md.

Output: apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-01.png .. ronin-walk-08.png,
each on an identical-size transparent canvas, head-top-anchored so frame-swapping doesn't jitter.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = MOBILE_ROOT / "assets" / "ronin" / "journey" / "walk-cycle" / "source" / "ronin-walk-cycle-sheet-raw.png"
OUTPUT_DIR = MOBILE_ROOT / "assets" / "ronin" / "journey" / "walk-cycle"
FRAME_COUNT = 8
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
    if count != FRAME_COUNT:
        raise ValueError(
            f"Expected {FRAME_COUNT} separate characters in the sheet, found {count}. "
            "Check the source sheet for touching/merged silhouettes before re-running."
        )
    boxes = find_objects(labeled)
    # Sort left-to-right by the box's horizontal start, matching walk-cycle pose order.
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

    # Canvas must fit the largest cropped frame plus padding, shared by all 8
    # frames so swapping never changes the Image element's own size.
    max_dim = 0
    for row_slice, col_slice in boxes:
        height = (row_slice.stop - row_slice.start) + PAD_PX * 2
        width = (col_slice.stop - col_slice.start) + PAD_PX * 2
        max_dim = max(max_dim, height, width)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, box in enumerate(boxes, start=1):
        frame = build_frame(rgb, mask, box, max_dim)
        out_path = OUTPUT_DIR / f"ronin-walk-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the script**

Run (from `apps/mobile/`): `python3 scripts/build-ronin-walk-cycle-frames.py`
Expected: 8 lines of `wrote .../ronin-walk-0N.png (WxH)` output, all with the same `WxH`. If it raises `ValueError: Expected 8 separate characters...`, inspect the raw sheet for two poses whose silhouettes touch/overlap and either re-crop the source or increase `GREEN_TOLERANCE` slightly, then re-run.

- [ ] **Step 5: Verify alpha and inspect alignment**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-0{1..8}.png`
Expected: `hasAlpha: yes` for all 8 files.

Open frames 1, 3, 5, 7 side by side (e.g. `open apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-0{1,3,5,7}.png`) and confirm the head sits at a consistent height across all four — that's the anchor this script targets. Some hip/foot shift between frames is expected and correct (real gait), not a bug.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/scripts/build-ronin-walk-cycle-frames.py apps/mobile/assets/ronin/journey/walk-cycle/
git commit -m "feat: slice Ronin walk-cycle sprite sheet into 8 aligned frames"
```

---

### Task 2: Pure helper — walk-cycle frame advance

**Files:**
- Create: `apps/mobile/src/utils/walkCycle.ts`
- Test: `apps/mobile/src/utils/walkCycle.test.ts`

**Interfaces:**
- Produces: `WALK_CYCLE_FRAME_COUNT: number` (= 8), `WALK_CYCLE_FRAME_INTERVAL_MS: number` (= 83), `getNextWalkCycleFrame(currentFrame: number, frameCount?: number): number`. Task 5 (`RoninWalkCycleSprite.tsx`) imports all three.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/walkCycle.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextWalkCycleFrame, WALK_CYCLE_FRAME_COUNT } from './walkCycle.ts';

test('advances to the next frame index', () => {
  assert.equal(getNextWalkCycleFrame(0), 1);
  assert.equal(getNextWalkCycleFrame(3), 4);
});

test('wraps back to 0 after the last frame', () => {
  assert.equal(getNextWalkCycleFrame(WALK_CYCLE_FRAME_COUNT - 1), 0);
});

test('supports a custom frame count', () => {
  assert.equal(getNextWalkCycleFrame(2, 3), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/mobile/`): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/walkCycle.test.ts`
Expected: FAIL — `walkCycle.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/walkCycle.ts`:

```ts
export const WALK_CYCLE_FRAME_COUNT = 8;
export const WALK_CYCLE_FRAME_INTERVAL_MS = 83; // ~12fps; one full 8-frame loop ≈ 660ms

export function getNextWalkCycleFrame(currentFrame: number, frameCount: number = WALK_CYCLE_FRAME_COUNT): number {
  return (currentFrame + 1) % frameCount;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/walkCycle.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/walkCycle.ts apps/mobile/src/utils/walkCycle.test.ts
git commit -m "feat: add walk-cycle frame advance helper"
```

---

### Task 3: Pure helper — today's journey completed/total count

**Files:**
- Create: `apps/mobile/src/utils/todayJourneyProgress.ts`
- Test: `apps/mobile/src/utils/todayJourneyProgress.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PendingActionKind = 'complete' | 'delete' | 'move'`, `TodayJourneyProgressItem { id: string; type: string; status: string }`, `TodayJourneyProgress { completedCount: number; totalCount: number }`, `computeTodayJourneyProgress(items: TodayJourneyProgressItem[], pendingActions: Map<string, PendingActionKind>): TodayJourneyProgress`. Task 7 (`HomeScreen.tsx`) imports `computeTodayJourneyProgress`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/todayJourneyProgress.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTodayJourneyProgress } from './todayJourneyProgress.ts';

const items = [
  { id: '1', type: 'task', status: 'pending' },
  { id: '2', type: 'task', status: 'completed' },
  { id: '3', type: 'task', status: 'pending' },
  { id: '4', type: 'habit', status: 'pending' },
];

test('counts only task-type items', () => {
  assert.deepEqual(computeTodayJourneyProgress(items, new Map()), { completedCount: 1, totalCount: 3 });
});

test('counts a pending "complete" action as done immediately', () => {
  const pendingActions = new Map([['1', 'complete']]);
  assert.deepEqual(computeTodayJourneyProgress(items, pendingActions), { completedCount: 2, totalCount: 3 });
});

test('excludes items pending delete or move from the total', () => {
  const pendingActions = new Map([['3', 'delete']]);
  assert.deepEqual(computeTodayJourneyProgress(items, pendingActions), { completedCount: 1, totalCount: 2 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/todayJourneyProgress.test.ts`
Expected: FAIL — `todayJourneyProgress.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/todayJourneyProgress.ts`:

```ts
export type PendingActionKind = 'complete' | 'delete' | 'move';

export interface TodayJourneyProgressItem {
  id: string;
  type: string;
  status: string;
}

export interface TodayJourneyProgress {
  completedCount: number;
  totalCount: number;
}

// 'complete' keeps a task counted as done immediately, matching HomeScreen's
// undo-grace-window behavior where the row hides right away but the action
// hasn't committed yet. 'delete'/'move' drop the item from the count
// entirely, same as they already drop it from the visible task list.
export function computeTodayJourneyProgress(
  items: TodayJourneyProgressItem[],
  pendingActions: Map<string, PendingActionKind>,
): TodayJourneyProgress {
  let completedCount = 0;
  let totalCount = 0;

  for (const item of items) {
    if (item.type !== 'task') continue;
    const pending = pendingActions.get(item.id);
    if (pending === 'delete' || pending === 'move') continue;
    totalCount += 1;
    if (item.status === 'completed' || pending === 'complete') {
      completedCount += 1;
    }
  }

  return { completedCount, totalCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/todayJourneyProgress.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/todayJourneyProgress.ts apps/mobile/src/utils/todayJourneyProgress.test.ts
git commit -m "feat: add today's journey completed/total count helper"
```

---

### Task 4: `RoninWalkCycleSprite` component

**Files:**
- Create: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`

**Interfaces:**
- Consumes: `getNextWalkCycleFrame`, `WALK_CYCLE_FRAME_COUNT`, `WALK_CYCLE_FRAME_INTERVAL_MS` from `../../utils/walkCycle` (Task 2). Consumes the 8 frame PNGs from Task 1 by exact filename.
- Produces: `RoninWalkCycleSprite({ style }: { style?: StyleProp<ImageStyle> })` — a React component. Task 5 (`RoninJourneyPrototype.tsx`) imports `RoninWalkCycleSprite` from `./RoninWalkCycleSprite`.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextWalkCycleFrame, WALK_CYCLE_FRAME_COUNT, WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';

// eslint-disable-next-line @typescript-eslint/no-var-requires
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

interface RoninWalkCycleSpriteProps {
  style?: StyleProp<ImageStyle>;
}

export function RoninWalkCycleSprite({ style }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => getNextWalkCycleFrame(current, WALK_CYCLE_FRAME_COUNT));
    }, WALK_CYCLE_FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return <Image source={WALK_CYCLE_FRAMES[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
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
Expected: no new errors. (Pre-existing `Cannot find module './DetailPanel'`-style errors under `src/webApp/` are a known false alarm per `apps/mobile/CLAUDE.md` — ignore those specifically, nothing else should appear.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/RoninWalkCycleSprite.tsx
git commit -m "feat: add RoninWalkCycleSprite flipbook component"
```

---

### Task 5: Wire `RoninWalkCycleSprite` into `RoninJourneyPrototype`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx:17` (import), `:27-28` (unused asset consts), `:177-181` (walker render)

**Interfaces:**
- Consumes: `RoninWalkCycleSprite` from `./RoninWalkCycleSprite` (Task 4).
- No change to `RoninJourneyPrototype`'s own exported props (`completedCount`, `totalCount`, `isDark`, `potentialPercent`) — Task 7 keeps using them unchanged.

- [ ] **Step 1: Swap the import**

In `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`, replace line 17:

```ts
import { RoninJourneyRiveWalker } from './RoninJourneyRiveWalker';
```

with:

```ts
import { RoninWalkCycleSprite } from './RoninWalkCycleSprite';
```

- [ ] **Step 2: Remove the now-unused Rive/static-walker asset requires**

Remove these two lines (currently 27-28):

```ts
const roninAndCat = require('../../../assets/ronin/journey/ronin-cat-walkers-v1.png');
const roninJourneyRive = require('../../../assets/rka_journey_rig.riv');
```

Leave `const sunsetTrail = require('../../../assets/ronin/journey/sunset-trail-background-v1.jpg');` in place — it's still used for the background.

- [ ] **Step 3: Replace the walker render**

Replace:

```tsx
          <RoninJourneyRiveWalker
            source={roninJourneyRive}
            style={styles.walkerImage}
            fallback={<Image source={roninAndCat} resizeMode="contain" style={styles.walkerImage} />}
          />
```

with:

```tsx
          <RoninWalkCycleSprite style={styles.walkerImage} />
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors, and no "unused variable" warnings for `roninAndCat`/`roninJourneyRive` (they're removed, not just unreferenced).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: use RoninWalkCycleSprite as the journey widget's walker"
```

---

### Task 6: Reactivate the journey widget on Home

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (imports; add a `journeyProgress` memo after the existing `visibleSomedayItems` memo, currently ending at line 331; replace the widget-row comment/JSX at lines 410-419)

**Interfaces:**
- Consumes: `RoninJourneyPrototype` from `../components/home/RoninJourneyPrototype` (already exists, untouched by this task besides its internals from Task 5). Consumes `computeTodayJourneyProgress` from `../utils/todayJourneyProgress` (Task 3).

- [ ] **Step 1: Add the two new imports**

In `apps/mobile/src/screens/HomeScreen.tsx`, add near the other `home/` component imports (after the `HomeTaskRow` import):

```ts
import { RoninJourneyPrototype } from '../components/home/RoninJourneyPrototype';
```

Add near the other `utils`/local imports (any existing import block is fine — there isn't currently a `utils` import in this file, so add it as its own line near the top-level imports):

```ts
import { computeTodayJourneyProgress } from '../utils/todayJourneyProgress';
```

- [ ] **Step 2: Compute today's journey progress**

Add this `useMemo` immediately after the existing `visibleSomedayItems` memo (the block ending `);` right before the file's `return (`):

```ts
  const journeyProgress = useMemo(
    () => computeTodayJourneyProgress(todayItems, pendingActions),
    [todayItems, pendingActions],
  );
```

- [ ] **Step 3: Reactivate the widget**

Replace this block:

```tsx
        {/* Widget row: Medication + Weather (Journey/Potential strip, Daily
            Check-In, and Plan Backwards countdown stay off Home for now). */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 }}>
          <View style={{ width: '31%' }}>
            <MedicationQuickLogWidget isDark={isDark} />
          </View>
          <View style={{ width: '31%' }}>
            <WeatherWidget isDark={isDark} />
          </View>
        </View>
```

with:

```tsx
        {/* Journey strip: always-walking Ronin sprite (see
            docs/superpowers/specs/2026-08-15-simplified-walking-ronin-avatar-design.md),
            reactivated 2026-08-15. Daily Check-In and Plan Backwards countdown
            still stay off Home for now. */}
        <RoninJourneyPrototype
          completedCount={journeyProgress.completedCount}
          totalCount={journeyProgress.totalCount}
          isDark={isDark}
        />

        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 }}>
          <View style={{ width: '31%' }}>
            <MedicationQuickLogWidget isDark={isDark} />
          </View>
          <View style={{ width: '31%' }}>
            <WeatherWidget isDark={isDark} />
          </View>
        </View>
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: reactivate Home journey widget with the walk-cycle sprite"
```

---

### Task 7: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Run the full test suite and typecheck**

Run (from `apps/mobile/`): `npm test && npx tsc --noEmit`
Expected: all tests pass (including the two new files from Tasks 2–3), no typecheck errors.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (per `apps/mobile/CLAUDE.md`'s Quick Reference — remember this project's convention is port 8082, not the Expo default), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm the walk-cycle reads as smooth motion**

Watch the widget for at least two full loops. Expected: legs/arms cycle through a continuous walking stride with no visible pop/jitter in head height between frames. If it reads choppy, that's the documented fallback trigger in the spec (generate 8 more in-between frames) — not a bug in this plan's code.

- [ ] **Step 4: Confirm Reduce Motion freezes the sprite**

Enable iOS Settings → Accessibility → Motion → Reduce Motion, return to the app (or force-reload), and watch the widget. Expected: the sprite holds on a single frame (no leg-cycling), while the rest of the widget's existing Reduce Motion behavior (slower bob, no rotation, no pathRise change) is unaffected — this was already true before this plan's changes. Turn Reduce Motion back off afterward.

- [ ] **Step 5: Confirm the tap reaction is unaffected**

Tap the widget. Expected: medium haptic, a brief hop/scale, and a reaction bubble showing one of "Onward.", "One step at a time.", "The path is yours." — cycling through them on repeated taps, exactly as before this plan's changes (this logic was untouched).

- [ ] **Step 6: Confirm progress-driven travel**

With at least one incomplete task scheduled today, complete it from the Today list and watch the widget. Expected: the character's horizontal position advances toward the right as `completedCount`/`totalCount` increases. Undo the completion (via the undo toast) and confirm the character's position reverts.

- [ ] **Step 7: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
