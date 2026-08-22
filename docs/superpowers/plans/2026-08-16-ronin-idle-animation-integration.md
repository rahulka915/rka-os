# Ronin Idle Animation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the two approved new-reference idle sprite sheets (front-¾ and straight-on-front, each a 6-frame breathing/sway loop) into a real animated idle state in the Home journey widget, replacing the current 4-frame old-art idle hold.

**Architecture:** Reuse the existing generic slicing script (`apps/mobile/scripts/build-ronin-walk-cycle-frames.py`) unmodified — it already supports arbitrary `--output-dir`/`--frame-count`/`--prefix`, so no new Python is needed, just two invocations against the two raw sheets. `RoninWalkCycleSprite.tsx`'s `idle` sprite state is changed from a single static frame array to a random pick between two 6-frame variant arrays, rerolled each time the component enters `idle` from a different state — giving visual variety without adding a new `RoninSpriteState` value or touching any call site that requests `'idle'`.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), Python 3 + Pillow/numpy/scipy (already installed per the walk-cycle/jump pipeline), existing `build-ronin-walk-cycle-frames.py` script.

## Global Constraints

- Full context: `docs/superpowers/specs/2026-08-16-ronin-idle-animation-prompts-design.md` (prompt design) — this plan is the "follow-up" work it explicitly deferred.
- Side-profile idle sheet (`sidefacingright-idle.png`) has a known motion bug (frames 4-6 freeze) and is explicitly **out of scope** for this pass — do not slice or wire it.
- No new npm dependencies. No new Python script — reuse `build-ronin-walk-cycle-frames.py` as-is.
- `RoninSpriteState` type (`'idle' | 'walking' | 'jump' | 'bow'`) does not change — `idle` stays a single state name; the two variants are an internal implementation detail of `RoninWalkCycleSprite.tsx`.
- This widget is native/iOS-only (per the jump/bow plan's precedent) — no `WEB_PARITY.md` update needed.
- `npx tsc --noEmit` (run from `apps/mobile/`) must stay clean after every task that touches `.ts`/`.tsx` files.

---

### Task 1: Slice the front-¾ idle sheet into aligned, keyed frame PNGs

**Files:**
- Create: `apps/mobile/assets/ronin/journey/idle-front34/source/ronin-idle-front34-sheet-raw.png` (copy of the already-generated, already-approved sheet)
- Produces: `apps/mobile/assets/ronin/journey/idle-front34/ronin-idle-front34-01.png` … `ronin-idle-front34-06.png`

**Interfaces:**
- Produces: 6 PNG files at fixed, identical canvas dimensions, real alpha transparency, named `ronin-idle-front34-01.png`…`ronin-idle-front34-06.png` in left-to-right frame order (frame 6 loops back into frame 1). Task 3 (`RoninWalkCycleSprite.tsx`) `require()`s these files by these exact names.

- [ ] **Step 1: Copy the raw sheet into the asset pipeline location**

```bash
mkdir -p apps/mobile/assets/ronin/journey/idle-front34/source
cp "RONIN CHARACTER REFERENCE 16:08:2026/Animation state/3-4facingright-idle.png" \
   apps/mobile/assets/ronin/journey/idle-front34/source/ronin-idle-front34-sheet-raw.png
```

Expected: the file now exists at the destination path (source stays in place too — this is a copy, not a move, since the reference folder is the canonical archive of generated sheets).

- [ ] **Step 2: Run the slicing script**

Run (from `apps/mobile/`):

```bash
python3 scripts/build-ronin-walk-cycle-frames.py \
  --source assets/ronin/journey/idle-front34/source/ronin-idle-front34-sheet-raw.png \
  --output-dir assets/ronin/journey/idle-front34 \
  --frame-count 6 \
  --prefix ronin-idle-front34
```

Expected: 6 lines `wrote .../ronin-idle-front34-0N.png (WxH)`, all sharing the same `WxH`. If it raises `ValueError` about the wrong number of characters found, inspect the sheet for touching/merged silhouettes — do not adjust `GREEN_TOLERANCE` without first visually confirming the sheet itself is clean, since this sheet was already approved.

- [ ] **Step 3: Verify alpha and visually spot-check the loop**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/idle-front34/ronin-idle-front34-*.png`
Expected: `hasAlpha: yes` for all 6 files.

Run: `open apps/mobile/assets/ronin/journey/idle-front34/ronin-idle-front34-01.png apps/mobile/assets/ronin/journey/idle-front34/ronin-idle-front34-06.png`
Expected: frame 1 and frame 6 look close enough in pose that looping frame 6 → frame 1 reads as continuous breathing, not a jump-cut. Confirm no visible green fringe on hair/cloth edges.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/assets/ronin/journey/idle-front34/
git commit -m "feat: slice Ronin front-3/4 idle sprite sheet into aligned frames"
```

---

### Task 2: Slice the straight-on-front idle sheet into aligned, keyed frame PNGs

**Files:**
- Create: `apps/mobile/assets/ronin/journey/idle-front/source/ronin-idle-front-sheet-raw.png` (copy of the already-generated, already-approved sheet)
- Produces: `apps/mobile/assets/ronin/journey/idle-front/ronin-idle-front-01.png` … `ronin-idle-front-06.png`

**Interfaces:**
- Produces: 6 PNG files at fixed, identical canvas dimensions, real alpha transparency, named `ronin-idle-front-01.png`…`ronin-idle-front-06.png` in left-to-right frame order. Task 3 (`RoninWalkCycleSprite.tsx`) `require()`s these files by these exact names.

- [ ] **Step 1: Copy the raw sheet into the asset pipeline location**

```bash
mkdir -p apps/mobile/assets/ronin/journey/idle-front/source
cp "RONIN CHARACTER REFERENCE 16:08:2026/Animation state/frontfacing-idle.png" \
   apps/mobile/assets/ronin/journey/idle-front/source/ronin-idle-front-sheet-raw.png
```

Expected: the file now exists at the destination path.

- [ ] **Step 2: Run the slicing script**

Run (from `apps/mobile/`):

```bash
python3 scripts/build-ronin-walk-cycle-frames.py \
  --source assets/ronin/journey/idle-front/source/ronin-idle-front-sheet-raw.png \
  --output-dir assets/ronin/journey/idle-front \
  --frame-count 6 \
  --prefix ronin-idle-front
```

Expected: 6 lines `wrote .../ronin-idle-front-0N.png (WxH)`, all sharing the same `WxH`.

- [ ] **Step 3: Verify alpha and visually spot-check the loop**

Run: `sips -g hasAlpha apps/mobile/assets/ronin/journey/idle-front/ronin-idle-front-*.png`
Expected: `hasAlpha: yes` for all 6 files.

Run: `open apps/mobile/assets/ronin/journey/idle-front/ronin-idle-front-01.png apps/mobile/assets/ronin/journey/idle-front/ronin-idle-front-06.png`
Expected: frame 1 and frame 6 pose close enough to loop cleanly; arm asymmetry (sword arm vs jewellery arm) looks identical between the two frames — a swapped arm between frames would be a visible identity bug, not just a rough loop.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/assets/ronin/journey/idle-front/
git commit -m "feat: slice Ronin straight-on-front idle sprite sheet into aligned frames"
```

---

### Task 3: Wire both idle variants into `RoninWalkCycleSprite.tsx`, replacing the old static idle

**Files:**
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx:1,18-23,49-51,64-99`
- Delete: `apps/mobile/assets/ronin/journey/idle/ronin-idle-01.png` … `ronin-idle-04.png` (old-art, no longer referenced by any code after this task)

**Interfaces:**
- Consumes: `ronin-idle-front34-01.png`…`06.png` (Task 1) and `ronin-idle-front-01.png`…`06.png` (Task 2).
- Produces: no change to `RoninSpriteState` or to any prop/exported signature — `idle` still means the same thing to every caller (`RoninJourneyPrototype.tsx`'s `spriteState` derivation is untouched). The only externally-visible change is that `idle` now renders one of two randomly-chosen 6-frame animated loops instead of a single static 4-frame loop.

- [ ] **Step 1: Replace the `IDLE_CYCLE_FRAMES` constant with two variant arrays**

In `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`, replace lines 18-23:

```ts
const IDLE_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle/ronin-idle-01.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-02.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-03.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-04.png'),
];
```

with:

```ts
// Two camera-angle variants of the same 6-frame breathing/sway loop
// (new-reference art, 2026-08-16) — RoninWalkCycleSprite randomly picks one
// each time it enters the 'idle' state, for visual variety. Both arrays
// must stay the same length (6) since SPRITE_STATES.idle.frames (below) is
// only used for that shared length/interval/loopMode, not for rendering.
const IDLE_FRONT34_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-01.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-02.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-03.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-04.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-05.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-06.png'),
];

const IDLE_FRONT_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-01.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-02.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-03.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-04.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-05.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-06.png'),
];

const IDLE_VARIANTS: number[][] = [IDLE_FRONT34_FRAMES, IDLE_FRONT_FRAMES];
```

- [ ] **Step 2: Point `SPRITE_STATES.idle.frames` at one variant (used only for length/timing)**

Locate the `SPRITE_STATES` registry (originally lines 49-54) and replace:

```ts
  idle: { frames: IDLE_CYCLE_FRAMES, intervalMs: 650, loopMode: 'loop' },
```

with:

```ts
  // frames here is a placeholder used only for SPRITE_STATES.idle.frames.length
  // (both IDLE_VARIANTS arrays are the same length) — actual rendering for
  // 'idle' uses the randomly-picked variant in idleVariantFramesRef, set in
  // the state-change effect below, not this array directly.
  idle: { frames: IDLE_FRONT34_FRAMES, intervalMs: 420, loopMode: 'loop' },
```

- [ ] **Step 3: Pick a random idle variant on entering the `idle` state**

Locate the component body. Replace:

```ts
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
        if (didComplete) clearInterval(interval);
        return frame;
      });
    }, config.intervalMs);
    return () => clearInterval(interval);
  }, [state]);
```

with:

```ts
export function RoninWalkCycleSprite({ style, state, onComplete }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // Which idle variant is currently showing — rerolled only when freshly
  // entering 'idle' (the effect below), so it stays stable for the whole
  // duration of one idle stretch rather than reshuffling every frame.
  const idleVariantFramesRef = useRef<number[]>(IDLE_VARIANTS[0]);

  useEffect(() => {
    setFrameIndex(0);
    if (state === 'idle') {
      idleVariantFramesRef.current = IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)];
    }
    const config = SPRITE_STATES[state];
    if (config.frames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => {
        const { frame, didComplete } = getNextSpriteFrame(current, config.frames.length, config.loopMode);
        if (didComplete) clearInterval(interval);
        return frame;
      });
    }, config.intervalMs);
    return () => clearInterval(interval);
  }, [state]);
```

- [ ] **Step 4: Render the picked variant for `idle`, other states unchanged**

Locate:

```ts
  const frames = SPRITE_STATES[state].frames;
  if (frames.length === 0) return null;
  return <Image source={frames[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
```

Replace with:

```ts
  const frames = state === 'idle' ? idleVariantFramesRef.current : SPRITE_STATES[state].frames;
  if (frames.length === 0) return null;
  return <Image source={frames[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
```

- [ ] **Step 5: Delete the now-unreferenced old-art idle frames**

```bash
rm apps/mobile/assets/ronin/journey/idle/ronin-idle-01.png \
   apps/mobile/assets/ronin/journey/idle/ronin-idle-02.png \
   apps/mobile/assets/ronin/journey/idle/ronin-idle-03.png \
   apps/mobile/assets/ronin/journey/idle/ronin-idle-04.png
```

Leave `apps/mobile/assets/ronin/journey/idle/source/ronin-idle-sheet-raw.png` in place (historical source, harmless, not loaded at runtime).

- [ ] **Step 6: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no new errors. (Pre-existing `Cannot find module './DetailPanel'`-style errors under `src/webApp/` are a known false alarm per `apps/mobile/CLAUDE.md` — ignore those specifically.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/home/RoninWalkCycleSprite.tsx apps/mobile/assets/ronin/journey/idle/
git commit -m "feat: replace static old-art idle with randomized new-reference breathing loops"
```

---

### Task 4: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Typecheck the whole project one more time**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no errors beyond the pre-existing `src/webApp/` false alarms.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (port 8082 per `apps/mobile/CLAUDE.md`'s convention), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm the idle loop plays and looks right**

With no walk in progress, watch the character for at least 10 seconds. Expected: a visibly animated breathing/sway loop (chest, hair, sash, bag moving subtly) — not a single static frame — and no visible seam/jump-cut where frame 6 loops back to frame 1. No green fringe on any edge.

- [ ] **Step 4: Confirm both variants appear across repeated idle entries**

Trigger a few walking → idle transitions (e.g. by completing/uncompleting a Today item, or backgrounding/foregrounding the app to remount) several times in a row. Expected: across enough repeats, both the front-¾ pose and the straight-on-front pose are each observed at least once — confirms the random pick isn't silently stuck on one variant (e.g. a `Math.random()` call accidentally hoisted outside the effect).

- [ ] **Step 5: Confirm walking and one-shot actions are unaffected**

Hold to preview the walk cycle, then tap the Jump and Bow buttons. Expected: all three behave exactly as before this change — this task only touched the `idle` branch.

- [ ] **Step 6: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
