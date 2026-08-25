# Ronin Expanded Idle Library Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Replace the temporary minimal Ronin idle with a varied, clearly readable PNG-frame idle library while preserving the approved character identity and supporting Reduce Motion.

**Architecture:** Keep every clip as a fixed-canvas transparent PNG sequence registered through one typed sprite registry. A pure scheduler selects clips using weighted randomness, an 8–18 second calm interval, and no immediate repetition; the existing journey component remains responsible for interruptions and playback. Generate and approve one identity-locked clip at a time, using deterministic transforms for small motions and image generation only where new anatomy is required.

**Tech Stack:** React Native, Expo, TypeScript, Jest, PNG sprite frames, ImageMagick asset validation, Codex image generation.

---

## Approved motion contract

| Clip | Frames | Frame duration | Motion |
|---|---:|---:|---|
| `calm` | 8 | 420 ms | Visible breathing, gentle hand/cloth sway |
| `lookAround` | 8 | 180 ms | Small head/eye turn with a held glance |
| `blinkDip` | 6 | 160 ms | Blink plus slight head dip; eyelids only under Reduce Motion |
| `yawn` | 10 | 180 ms | Hand-to-mouth yawn, rare |
| `adjustWrap` | 10 | 150 ms | Brief forearm-wrap/accessory adjustment |
| `shoulderStretch` | 10 | 180 ms | Small shoulder/upper-body stretch, rare |

All frames are 640×640 transparent PNGs with identical foot anchor, scale, palette, outlines, sword, backpack, jewellery, bag, facial identity, and trishul/Om hybrid pendant. Each special clip begins and ends on the exact calm neutral pose.

### Task 1: Add the pure idle scheduler

**Files:**
- Create: `apps/mobile/src/utils/roninIdleScheduler.ts`
- Create: `apps/mobile/src/utils/__tests__/roninIdleScheduler.test.ts`

**Step 1: Write failing scheduler tests**

Cover these exact behaviours:

```ts
expect(nextIdleDelayMs(() => 0)).toBe(8_000);
expect(nextIdleDelayMs(() => 1)).toBe(18_000);
expect(selectIdleClip({ random: () => 0, previous: 'lookAround', reduceMotion: false }))
  .not.toBe('lookAround');
expect(selectIdleClip({ random: () => 0.99, previous: null, reduceMotion: true }))
  .not.toBe('shoulderStretch');
```

Also sample deterministic random values to prove normal clips (`lookAround`, `blinkDip`, `adjustWrap`) occupy more weight than rare clips (`yawn`, `shoulderStretch`).

**Step 2: Run the test and verify failure**

Run: `cd apps/mobile && npm test -- --runInBand src/utils/__tests__/roninIdleScheduler.test.ts`

Expected: FAIL because `roninIdleScheduler` does not exist.

**Step 3: Implement the minimal pure API**

Export:

```ts
export type RoninIdleClip =
  | 'lookAround'
  | 'blinkDip'
  | 'yawn'
  | 'adjustWrap'
  | 'shoulderStretch';

export function nextIdleDelayMs(random: () => number = Math.random): number;
export function selectIdleClip(options: {
  random?: () => number;
  previous: RoninIdleClip | null;
  reduceMotion: boolean;
}): RoninIdleClip;
```

Use an inclusive 8,000–18,000 ms range, explicit weights, filtered selection to prevent immediate repeats, and exclude `yawn`/`shoulderStretch` when Reduce Motion is enabled.

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile/src/utils/roninIdleScheduler.ts apps/mobile/src/utils/__tests__/roninIdleScheduler.test.ts
git commit -m "feat: add Ronin idle scheduler"
```

### Task 2: Centralize the Ronin sprite registry

**Files:**
- Create: `apps/mobile/src/components/home/roninSpriteRegistry.ts`
- Create: `apps/mobile/src/components/home/__tests__/roninSpriteRegistry.test.ts`
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`

**Step 1: Write failing registry tests**

Assert every clip declares `frames`, `frameDurationMs`, `loops`, and `reduceMotionClip`; assert the calm contract is 8 × 420 ms and each special clip matches the approved table.

**Step 2: Run the focused test**

Run: `cd apps/mobile && npm test -- --runInBand src/components/home/__tests__/roninSpriteRegistry.test.ts`

Expected: FAIL because the registry does not exist.

**Step 3: Implement the typed registry**

Define `RoninSpriteClipName`, `RoninSpriteClip`, and `RONIN_SPRITE_CLIPS`. Move existing frame `require(...)` arrays out of `RoninWalkCycleSprite.tsx`; keep rendering behaviour unchanged.

**Step 4: Run registry and existing Ronin tests**

Run: `cd apps/mobile && npm test -- --runInBand src/components/home/__tests__/roninSpriteRegistry.test.ts src/components/home/__tests__/RoninWalkCycleSprite.source.test.ts`

Expected: PASS. If the source-text test asserts the old inline layout, replace it with behavioural registry assertions rather than preserving implementation coupling.

**Step 5: Commit**

```bash
git add apps/mobile/src/components/home/roninSpriteRegistry.ts apps/mobile/src/components/home/RoninWalkCycleSprite.tsx apps/mobile/src/components/home/__tests__
git commit -m "refactor: centralize Ronin sprite clips"
```

### Task 3: Establish asset contracts and validation

**Files:**
- Create: `apps/mobile/assets/ronin/idle-v2/README.md`
- Create: `apps/mobile/scripts/validate-ronin-idle-assets.mjs`
- Create: `apps/mobile/src/components/home/__tests__/roninIdleAssets.test.ts`

**Step 1: Write a failing asset test**

For every expected filename, assert it exists and has dimensions 640×640. Assert the file list contains exactly 52 runtime frames: 8 calm + 8 look-around + 6 blink/dip + 10 yawn + 10 adjust-wrap + 10 shoulder-stretch.

**Step 2: Run the test**

Expected: FAIL because `idle-v2` is not populated.

**Step 3: Add the validator and README**

The validator must check dimensions, alpha channel, non-empty visible bounds, consistent foot-anchor tolerance, and identical naming:

```text
calm-01.png … calm-08.png
look-around-01.png … look-around-08.png
blink-dip-01.png … blink-dip-06.png
yawn-01.png … yawn-10.png
adjust-wrap-01.png … adjust-wrap-10.png
shoulder-stretch-01.png … shoulder-stretch-10.png
```

Document the canonical source image, pendant geometry, exact accessories, palette lock, and approval checklist. Do not copy generated alternatives into runtime folders until approved.

**Step 4: Run the validator against the current incomplete folder**

Run: `cd apps/mobile && node scripts/validate-ronin-idle-assets.mjs`

Expected: non-zero with a precise missing-frame report.

**Step 5: Commit the contract**

```bash
git add apps/mobile/assets/ronin/idle-v2/README.md apps/mobile/scripts/validate-ronin-idle-assets.mjs apps/mobile/src/components/home/__tests__/roninIdleAssets.test.ts
git commit -m "test: define Ronin idle asset contract"
```

### Task 4: Produce and approve the calm, look-around, and blink clips

**Files:**
- Create: `apps/mobile/assets/ronin/idle-v2/calm-01.png` through `calm-08.png`
- Create: `apps/mobile/assets/ronin/idle-v2/look-around-01.png` through `look-around-08.png`
- Create: `apps/mobile/assets/ronin/idle-v2/blink-dip-01.png` through `blink-dip-06.png`

**Step 1: Generate calm deterministically**

Use the approved canonical neutral frame. Keep feet and gear fixed; apply only a small torso breathing arc, subtle hand sway, and secondary sash/bandana motion. Frame 1 and frame 8 must loop without a pop.

**Step 2: Generate look-around and blink/dip**

Prefer deterministic eye/eyelid/head edits. The held glance is represented by repeating the turned pose, not lengthening the entire clip. Create an eyelids-only Reduce Motion mapping from the same blink frames.

**Step 3: Make review sheets**

Create temporary labelled contact sheets outside the runtime asset directory. Review at native size and at the app’s rendered size for silhouette drift, face drift, pendant/ring corruption, and anchor movement.

**Step 4: Validate and test**

Run: `cd apps/mobile && node scripts/validate-ronin-idle-assets.mjs --allow-missing-specials`

Expected: PASS for these three clips, with only the three not-yet-produced special clips reported as allowed missing.

**Step 5: Commit approved frames only**

```bash
git add apps/mobile/assets/ronin/idle-v2
git commit -m "feat: add subtle Ronin idle frames"
```

### Task 5: Produce and approve each expressive idle separately

**Files:**
- Create: `apps/mobile/assets/ronin/idle-v2/yawn-01.png` through `yawn-10.png`
- Create: `apps/mobile/assets/ronin/idle-v2/adjust-wrap-01.png` through `adjust-wrap-10.png`
- Create: `apps/mobile/assets/ronin/idle-v2/shoulder-stretch-01.png` through `shoulder-stretch-10.png`

**Step 1: Generate the yawn clip**

Use image generation because hand-to-mouth anatomy changes. Supply the canonical identity reference and exact neutral endpoint. Preserve every unrelated detail. Review and approve before continuing.

**Step 2: Generate the adjust-wrap clip**

Move only the relevant forearms/hands and wrap. Preserve exactly one rudraksha bracelet, exactly two silver rings, glove/wrap side assignment, bag, sword, pendant, and outfit. Review and approve before continuing.

**Step 3: Generate the shoulder-stretch clip**

Keep it compact and relaxed: no dramatic lean, no weapon draw, no backpack removal. Review and approve before continuing.

**Step 4: Validate the complete library**

Run: `cd apps/mobile && node scripts/validate-ronin-idle-assets.mjs`

Expected: PASS for all 52 transparent 640×640 frames.

**Step 5: Run asset tests and commit**

Run: `cd apps/mobile && npm test -- --runInBand src/components/home/__tests__/roninIdleAssets.test.ts`

Expected: PASS.

```bash
git add apps/mobile/assets/ronin/idle-v2
git commit -m "feat: add expressive Ronin idle frames"
```

### Task 6: Wire runtime playback and interruption rules

**Files:**
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`
- Create: `apps/mobile/src/components/home/__tests__/RoninIdleController.test.tsx`

**Step 1: Write failing controller tests**

Use fake timers and injected random values to verify:

- calm playback schedules a special idle after 8–18 seconds;
- only one special idle plays at once;
- the same special idle never plays twice consecutively;
- every special idle returns to calm neutral;
- walk, bow, and jump interrupt a special idle immediately;
- Reduce Motion uses the reduced clip mapping and never selects yawn/stretch.

**Step 2: Run the focused test**

Run: `cd apps/mobile && npm test -- --runInBand src/components/home/__tests__/RoninIdleController.test.tsx`

Expected: FAIL because the controller behaviour is not implemented.

**Step 3: Implement minimal scheduling and playback**

Use one timeout while calm, cancel it on unmount or higher-priority state, remember the last selected clip, and restart scheduling only after returning to calm. The journey’s existing walk/bow/jump state remains authoritative.

**Step 4: Run focused tests**

Run: `cd apps/mobile && npm test -- --runInBand src/components/home/__tests__/RoninIdleController.test.tsx src/components/home/__tests__/roninSpriteRegistry.test.ts src/utils/__tests__/roninIdleScheduler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile/src/components/home/RoninWalkCycleSprite.tsx apps/mobile/src/components/home/RoninJourneyPrototype.tsx apps/mobile/src/components/home/__tests__/RoninIdleController.test.tsx
git commit -m "feat: add varied Ronin idle playback"
```

### Task 7: Verify in-app behaviour and synchronize documentation

**Files:**
- Modify: `apps/mobile/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `HANDOVER_SUMMARY.md`

**Step 1: Run the Ronin and full test suites**

Run:

```bash
cd apps/mobile
npm test -- --runInBand src/components/home/__tests__ src/utils/__tests__/roninIdleScheduler.test.ts
npm test -- --runInBand
npx tsc --noEmit
```

Expected: new Ronin tests PASS. Record any unrelated pre-existing full-suite or typecheck failures explicitly rather than silently broadening scope.

**Step 2: Inspect the app**

Run the app through the normal RKA Launcher/Expo workflow. Observe long enough to see several clips and verify clear but restrained breathing/hand motion, rare yawn/stretch, no repetition, no visual pop, correct interruptions, stable feet, and preserved accessories. Repeat with Reduce Motion enabled.

**Step 3: Update documentation**

Document the shipped `idle-v2` asset location, six-clip contract, scheduler behaviour, Reduce Motion handling, test results, and immediate follow-ups in all three required project documents.

**Step 4: Run final repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files are staged for the final commit.

**Step 5: Commit documentation**

```bash
git add AGENTS.md HANDOVER_SUMMARY.md apps/mobile/CLAUDE.md
git commit -m "docs: record expanded Ronin idle library"
```

## Completion criteria

- Six approved clips exist as exactly 52 fixed-canvas transparent frames.
- Breathing and hand/cloth sway are visibly readable at actual app size without looking restless.
- Special idles occur every 8–18 seconds with the approved weights and no immediate repeat.
- Calm separates special clips; walk, bow, and jump interrupt cleanly.
- Reduce Motion avoids the larger expressive motions and preserves a restrained blink.
- Identity, skin tone, trishul/Om pendant, jewellery count, side-specific wraps/glove, gear, palette, scale, and foot anchor remain consistent across every frame.
- Focused tests and asset validation pass; full-suite status is documented.
