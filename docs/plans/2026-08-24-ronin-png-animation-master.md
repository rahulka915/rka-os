# Ronin PNG Animation Master Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build a versioned Ronin identity pack and deterministic 640×640 PNG-sheet pipeline, prove it with an approved idle animation, then migrate all Home journey actions without identity or alignment drift.

**Architecture:** Preserve the approved polished portrait as immutable source art and derive a simplified, versioned animation identity pack from it. Extend the existing Python frame builder with fixed-coordinate export plus manifests and automated visual QA, then centralize the React Native sprite registry so every runtime action consumes the same declared timing and frame contract. Replace actions one at a time only after 120-point visual approval.

**Tech Stack:** Python 3, Pillow, NumPy, SciPy, `unittest`, TypeScript, React Native `Image`, Node test runner, transparent PNG assets, image-generation/editing workflow.

---

## Preconditions and Safety

- Work in the current workspace because the approved portrait is presently uncommitted source input; do not create a worktree that omits it.
- Preserve all unrelated dirty-worktree files.
- Never overwrite or delete current journey sprite frames during production.
- Stage only files listed by each task.
- Use the accepted design at `docs/superpowers/specs/2026-08-24-ronin-png-animation-master-design.md`.
- Treat `RONIN CHARACTER REFERENCE 16:08:2026/CANONICAL RONIN BALANCED CLEAN REGENERATION 24-08-2026.png` as the canonical visual source.
- The pendant photograph is authoritative only for the small Trishul–Om hybrid.

### Task 1: Establish the Versioned Identity-Pack Skeleton

**Files:**
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/README.md`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/manifest.json`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/canonical/ronin-balanced-canonical-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/templates/canvas-contract.json`

**Step 1: Copy the approved portrait without modifying it**

Run:

```bash
mkdir -p apps/mobile/assets/ronin/reference/animation-master-v1/canonical apps/mobile/assets/ronin/reference/animation-master-v1/templates
cp 'RONIN CHARACTER REFERENCE 16:08:2026/CANONICAL RONIN BALANCED CLEAN REGENERATION 24-08-2026.png' apps/mobile/assets/ronin/reference/animation-master-v1/canonical/ronin-balanced-canonical-v1.png
cmp 'RONIN CHARACTER REFERENCE 16:08:2026/CANONICAL RONIN BALANCED CLEAN REGENERATION 24-08-2026.png' apps/mobile/assets/ronin/reference/animation-master-v1/canonical/ronin-balanced-canonical-v1.png
```

Expected: `cmp` prints nothing and exits 0.

**Step 2: Write the canvas contract**

Create `canvas-contract.json` with exact geometry:

```json
{
  "schemaVersion": 1,
  "width": 640,
  "height": 640,
  "rootAnchor": { "x": 320, "y": 390 },
  "groundBaselineY": 580,
  "neutralHeadTopY": 72,
  "safePadding": 32,
  "displaySizePoints": 120
}
```

**Step 3: Write the identity manifest**

Create `manifest.json` containing `identityPackVersion`, canonical relative path, pendant-source description, character-side terminology, immutable identity traits, required deliverables, and canvas-contract relative path. Set not-yet-produced deliverable paths to `null`; do not invent assets.

**Step 4: Document the pack**

In `README.md`, explain the source hierarchy, portrait immutability, difference between portrait and animation master, exact accessory constraints, and approval state of every deliverable.

**Step 5: Validate JSON and image identity**

Run:

```bash
python3 -m json.tool apps/mobile/assets/ronin/reference/animation-master-v1/manifest.json >/dev/null
python3 -m json.tool apps/mobile/assets/ronin/reference/animation-master-v1/templates/canvas-contract.json >/dev/null
cmp 'RONIN CHARACTER REFERENCE 16:08:2026/CANONICAL RONIN BALANCED CLEAN REGENERATION 24-08-2026.png' apps/mobile/assets/ronin/reference/animation-master-v1/canonical/ronin-balanced-canonical-v1.png
```

Expected: all commands exit 0.

**Step 6: Commit**

```bash
git add apps/mobile/assets/ronin/reference/animation-master-v1
git commit -m "feat: establish versioned Ronin animation identity pack" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 2: Add Fixed-Canvas Tests to the Frame Builder

**Files:**
- Create: `apps/mobile/scripts/tests/test_build_ronin_frames.py`
- Modify: `apps/mobile/scripts/build-ronin-walk-cycle-frames.py`

**Step 1: Write failing tests**

Load the hyphenated script with `importlib.util.spec_from_file_location`. Add tests that construct temporary transparent sheets and assert:

```python
def test_fixed_canvas_preserves_source_coordinates(self):
    # Two components at known sheet-local coordinates.
    # Export into 640x640 cells and assert their alpha bounds retain those coordinates.

def test_fixed_canvas_rejects_out_of_bounds_foreground(self):
    # A component outside the 32px safe area must raise ValueError.

def test_legacy_mode_still_uses_shared_auto_sized_canvas(self):
    # Existing invocations without --canvas-contract retain current behaviour.
```

Use only generated temporary images; no production asset fixtures.

**Step 2: Run tests to verify failure**

Run:

```bash
cd apps/mobile && python3 -m unittest scripts.tests.test_build_ronin_frames -v
```

Expected: FAIL because fixed-canvas APIs/options do not exist.

**Step 3: Implement contract loading and fixed-canvas mode**

Add:

```python
@dataclass(frozen=True)
class CanvasContract:
    width: int
    height: int
    safe_padding: int
    ground_baseline_y: int
    root_x: int
    root_y: int
```

Add `--canvas-contract` and `--cell-width` arguments. In fixed mode:

- Require the sheet height to equal contract height.
- Require sheet width to equal `cell_width * frame_count`.
- Crop each declared cell, preserving its internal coordinates.
- Remove the cell background/key without centring or scaling the character.
- Write exactly the contract width/height.
- Reject foreground outside safe padding unless `--allow-safe-area-overflow` is passed.
- Keep legacy connected-component/max-dimension/head-anchor behaviour when no contract is provided.

**Step 4: Run the focused tests**

Run:

```bash
cd apps/mobile && python3 -m unittest scripts.tests.test_build_ronin_frames -v
```

Expected: all tests PASS.

**Step 5: Smoke-test the legacy path without overwriting assets**

Run the current walk source into a temporary directory using its current flags.

Expected: eight frames are produced with the existing shared legacy dimensions.

**Step 6: Commit**

```bash
git add apps/mobile/scripts/build-ronin-walk-cycle-frames.py apps/mobile/scripts/tests/test_build_ronin_frames.py
git commit -m "feat: add fixed-canvas Ronin frame export" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 3: Add Action Manifests and Automated PNG QA

**Files:**
- Create: `apps/mobile/scripts/validate-ronin-action.py`
- Create: `apps/mobile/scripts/tests/test_validate_ronin_action.py`
- Create: `apps/mobile/assets/ronin/journey/manifests/schema-v1.json`

**Step 1: Write failing validator tests**

Cover:

- Valid 640×640 RGBA sequence passes.
- Wrong dimensions fail.
- Wrong frame count or filename gap fails.
- Opaque background fails.
- Safe-area overflow fails unless declared.
- Contact-frame foot bounds outside baseline tolerance fail.
- Invalid manifest paths/version fail.

Use a CLI entry function returning an error list so tests do not parse console text.

**Step 2: Run tests to verify failure**

```bash
cd apps/mobile && python3 -m unittest scripts.tests.test_validate_ronin_action -v
```

Expected: FAIL because validator is absent.

**Step 3: Implement the minimal validator**

Manifest shape:

```json
{
  "schemaVersion": 1,
  "action": "idle-calm",
  "identityPackVersion": "animation-master-v1",
  "framePrefix": "ronin-idle-calm",
  "frameCount": 8,
  "intervalMs": 420,
  "loopMode": "loop",
  "canvasContract": "../../reference/animation-master-v1/templates/canvas-contract.json",
  "contactFrames": [0],
  "baselineTolerancePx": 3,
  "allowSafeAreaOverflow": false,
  "overlays": []
}
```

The validator inspects dimensions, mode, alpha extrema, filenames, bounds, and declared contact frames. It must not pretend to recognize jewellery or pendant semantics automatically; those remain explicit visual-review checklist items.

**Step 4: Add a documented JSON schema**

Create `schema-v1.json` describing the exact required fields and enums.

**Step 5: Run tests**

```bash
cd apps/mobile && python3 -m unittest scripts.tests.test_validate_ronin_action scripts.tests.test_build_ronin_frames -v
```

Expected: all tests PASS.

**Step 6: Commit**

```bash
git add apps/mobile/scripts/validate-ronin-action.py apps/mobile/scripts/tests/test_validate_ronin_action.py apps/mobile/assets/ronin/journey/manifests/schema-v1.json
git commit -m "feat: validate Ronin PNG action contracts" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 4: Produce and Approve the Animation Identity Pack

**Files:**
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/master/ronin-animation-master-front-three-quarter.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/turnaround/ronin-turnaround-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/face/ronin-face-sheet-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/guides/ronin-palette-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/guides/ronin-hair-map-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/guides/ronin-silhouettes-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/templates/ronin-canvas-template-v1.png`
- Modify: `apps/mobile/assets/ronin/reference/animation-master-v1/manifest.json`
- Modify: `apps/mobile/assets/ronin/reference/animation-master-v1/README.md`

**Step 1: Build the visible canvas template**

Render a transparent 640×640 guide containing the root, baseline, head guide, safe area, centre line, and character-left/right labels. This is guide art, never a runtime asset.

**Step 2: Generate the animation master from the canonical portrait**

Use the canonical portrait as the sole character image reference and the pendant photo only for pendant geometry. Preserve the balanced face and full costume while applying the simplification contract from the design. Request transparent background, neutral front-three-quarter pose, and full body on the universal template.

**Step 3: Inspect before deriving further sheets**

Reject and regenerate if the master has the wrong pendant, wrong ring count, missing bracelet, multiple swords, changed hand wraps, changed bag side, changed face age/cuteness, cropped silhouette, or noisy texture.

**Step 4: Generate the remaining reference sheets from the approved master**

Produce turnaround, face, palette, hair map, and silhouette sheets. Do not use one generated turnaround view to generate the next; reference the approved master and canonical portrait for the whole sheet.

**Step 5: Create 120-point review renders**

Downsample the master and each turnaround view into a single comparison sheet against the canonical portrait. Use high-quality downsampling and do not sharpen artificially.

**Step 6: User approval checkpoint**

Show the master, turnaround, face sheet, accessory visibility, silhouettes, and 120-point comparison. Do not generate animation actions until approved.

**Step 7: Update manifest and commit approved references**

Replace `null` paths with approved asset paths and record approval date. Then:

```bash
git add apps/mobile/assets/ronin/reference/animation-master-v1
git commit -m "feat: add approved Ronin animation identity references" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 5: Build Deterministic Accessory Overlays

**Files:**
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/ronin-accessories-v1.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/pendant-front.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/pendant-three-quarter.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/pendant-side.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/rings-front.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/rings-three-quarter.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/bracelet-front.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/bracelet-three-quarter.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/katana-side.png`
- Create: `apps/mobile/assets/ronin/reference/animation-master-v1/accessories/katana-three-quarter.png`
- Modify: `apps/mobile/assets/ronin/reference/animation-master-v1/manifest.json`

**Step 1: Produce the accessory sheet**

Use the master, canonical portrait, and real pendant photo. The pendant must be a small silver vertical Trishul–Om hybrid; the enlarged sheet shows geometry, while runtime variants remain small.

**Step 2: Extract clean transparent variants**

Create front, three-quarter, and side pendant variants plus only the ring, bracelet, and katana orientations visibly required by the current states. Avoid speculative variants.

**Step 3: Composite variants onto a copy of the master**

Review full-size and 120-point versions. Confirm overlays match line weight, palette, perspective, and lighting.

**Step 4: User approval checkpoint**

Approve the pendant size and hybrid geometry specifically before animation-sheet production.

**Step 5: Record variants and commit**

```bash
git add apps/mobile/assets/ronin/reference/animation-master-v1
git commit -m "feat: add stable Ronin accessory overlays" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 6: Produce the Idle-Calm Pilot

**Files:**
- Create: `apps/mobile/assets/ronin/journey-v2/idle-calm/source/ronin-idle-calm-sheet-v1.png`
- Create: `apps/mobile/assets/ronin/journey-v2/idle-calm/manifest.json`
- Create: `apps/mobile/assets/ronin/journey-v2/idle-calm/ronin-idle-calm-01.png` through `08.png`
- Create: `apps/mobile/assets/ronin/journey-v2/review/idle-calm-120pt.gif`

**Step 1: Define the eight-frame pose layout**

Use one restrained breathing loop with feet planted, root fixed, and secondary motion limited to chest, hair tips, bandana tails, sash tips, and bag cords. Frames 1 and 8 must transition cleanly.

**Step 2: Generate the full sheet at once**

Reference the whole approved identity pack. Do not reference a prior generated frame as the next frame's source.

**Step 3: Apply approved overlays**

Composite pendant and visible jewellery variants consistently across frames.

**Step 4: Slice using fixed-canvas mode**

Run the builder with the versioned canvas contract and eight 640-pixel cells.

Expected: eight 640×640 transparent frames with no scaling or recentering.

**Step 5: Validate**

Run the action validator against `manifest.json`.

Expected: PASS with no dimension, alpha, naming, safe-area, or baseline errors.

**Step 6: Review animation**

Create a 120-point looping preview plus full-size contact sheet and difference/onion-skin sheet. Reject texture shimmer, face drift, root motion, accessory drift, or loop hitch.

**Step 7: User approval checkpoint**

Do not wire the pilot into the app until approved beside the current idle.

**Step 8: Commit approved pilot assets**

```bash
git add apps/mobile/assets/ronin/journey-v2/idle-calm
git commit -m "feat: add Ronin idle animation pilot" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 7: Centralize the Runtime Sprite Registry

**Files:**
- Create: `apps/mobile/src/components/home/roninSpriteRegistry.ts`
- Create: `apps/mobile/src/components/home/roninSpriteRegistry.test.ts`
- Modify: `apps/mobile/src/components/home/RoninWalkCycleSprite.tsx:7-82`
- Modify: `apps/mobile/src/components/home/roninSpriteStates.ts:1-7`

**Step 1: Write failing registry tests**

Test that every state has frames, positive timing, valid loop mode, expected counts, and equal frame counts across idle variants. Test a pure `selectIdleVariantIndex(randomValue, variantCount)` helper at boundaries.

**Step 2: Run the tests to verify failure**

```bash
cd apps/mobile && npm test -- roninSpriteRegistry.test.ts
```

Expected: FAIL because the registry module does not exist.

**Step 3: Move imports and playback declarations into the registry**

Export:

```ts
export const RONIN_SPRITE_REGISTRY: Record<RoninSpriteState, SpriteStateConfig>;
export const RONIN_IDLE_VARIANTS: readonly (readonly number[])[];
export function selectIdleVariantIndex(randomValue: number, variantCount: number): number;
```

Keep existing production assets for all states initially. Do not change timing or behaviour during this refactor.

**Step 4: Update the component**

Import the registry and replace local arrays/config. Preserve reset, one-shot completion, and idle selection behaviour.

**Step 5: Run focused and full tests**

```bash
cd apps/mobile && npm test -- roninSpriteRegistry.test.ts walkCycle.test.ts
cd apps/mobile && npm test
```

Expected: focused tests pass; full suite introduces no new failure.

**Step 6: Commit**

```bash
git add apps/mobile/src/components/home/roninSpriteRegistry.ts apps/mobile/src/components/home/roninSpriteRegistry.test.ts apps/mobile/src/components/home/RoninWalkCycleSprite.tsx apps/mobile/src/components/home/roninSpriteStates.ts
git commit -m "refactor: centralize Ronin sprite action registry" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 8: Wire and Validate the Idle Pilot

**Files:**
- Modify: `apps/mobile/src/components/home/roninSpriteRegistry.ts`
- Test: `apps/mobile/src/components/home/roninSpriteRegistry.test.ts`

**Step 1: Change only the calm-idle imports to `journey-v2`**

Keep alert, walk, bow, and jump on current assets.

**Step 2: Run tests and typecheck**

```bash
cd apps/mobile && npm test -- roninSpriteRegistry.test.ts walkCycle.test.ts
cd apps/mobile && npm run typecheck
```

Expected: tests pass. If typecheck has pre-existing failures, record them verbatim and prove no new errors originate from changed files.

**Step 3: Review in the real Home journey**

Verify at device scale: idle loop, transitions to walking, jump, bow, Reduce Motion, tap hop, and hold-to-walk. Confirm no scale or baseline pop when entering/leaving the pilot idle.

**Step 4: Commit**

```bash
git add apps/mobile/src/components/home/roninSpriteRegistry.ts apps/mobile/src/components/home/roninSpriteRegistry.test.ts
git commit -m "feat: adopt the approved Ronin idle pilot" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 9: Produce and Migrate Remaining Actions

**Files:**
- Create: `apps/mobile/assets/ronin/journey-v2/idle-alert/**`
- Create: `apps/mobile/assets/ronin/journey-v2/walk-cycle/**`
- Create: `apps/mobile/assets/ronin/journey-v2/tap-reaction/**`
- Create: `apps/mobile/assets/ronin/journey-v2/jump/**`
- Modify: `apps/mobile/src/components/home/roninSpriteRegistry.ts`
- Modify: `apps/mobile/src/components/home/roninSpriteRegistry.test.ts`

Repeat these steps separately for idle alert, walk, bow, and jump:

**Step 1: Define the action manifest and pose/contact layout**

Retain current frame count and timing unless visual review demonstrates a concrete need to change it.

**Step 2: Generate the complete sheet from the identity pack**

Never daisy-chain frames.

**Step 3: Apply approved overlays, slice, and validate**

Require the action validator to pass.

**Step 4: Review at 120 points and in difference/onion-skin views**

Approve identity, motion, loop/hold, scale, root, baseline, and accessories.

**Step 5: User approval checkpoint**

Approve each action before runtime adoption.

**Step 6: Switch only that action in the registry**

Run focused tests and device review after each switch.

**Step 7: Commit that action separately**

Use one commit per approved action, for example:

```bash
git commit -m "feat: adopt the approved Ronin walk cycle" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

### Task 10: Synchronize Documentation and Close the Migration

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/mobile/CLAUDE.md`
- Modify: `apps/mobile/RONIN_RIVE.md`
- Modify: `HANDOVER_SUMMARY.md`
- Modify or create: `apps/mobile/assets/ronin/journey-v2/README.md`

**Step 1: Verify actual Rive usage before documenting retirement**

Run:

```bash
rg -n "@rive-app/react-native|rka_journey_rig|RoninJourneyRiveWalker|Rive" apps/mobile/src apps/mobile/package.json
```

Do not remove dependencies or assets unless this proves they are unused and dependency cleanup is explicitly included.

**Step 2: Update current-state documentation**

- Declare PNG sheets as the canonical Ronin animation workflow.
- Point to the identity pack, action manifests, validator, runtime registry, and accepted design.
- Remove claims that active Ronin work is a Rive rig.
- Retain accurate historical notes clearly marked archived.

**Step 3: Update the mandatory handover**

Record date, files and actions migrated, visual approval state, tests, typecheck/build status, and remaining work.

**Step 4: Run final verification**

```bash
cd apps/mobile && python3 -m unittest scripts.tests.test_build_ronin_frames scripts.tests.test_validate_ronin_action -v
cd apps/mobile && npm test
cd apps/mobile && npm run typecheck
git diff --check
```

Expected: all new tests pass; no new TypeScript failures; no whitespace errors.

**Step 5: Commit**

```bash
git add AGENTS.md apps/mobile/CLAUDE.md apps/mobile/RONIN_RIVE.md HANDOVER_SUMMARY.md apps/mobile/assets/ronin/journey-v2/README.md
git commit -m "docs: make PNG sheets the canonical Ronin workflow" -m "Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>"
```

## Completion Criteria

- The exact approved balanced portrait is preserved in a versioned identity pack.
- The animation master and its reference sheets are approved at full size and 120 points.
- Every new frame is 640×640 with fixed scale, root, and baseline semantics.
- The pendant is the correct small Trishul–Om hybrid and identity-critical accessories remain stable.
- Idle calm, idle alert, walk, bow, and jump are each visually approved and validated.
- The Home journey shows no scale, baseline, or identity pop between states.
- Current sprites remain recoverable.
- Runtime registry, tests, manifests, project docs, and handover all agree on the PNG workflow.
