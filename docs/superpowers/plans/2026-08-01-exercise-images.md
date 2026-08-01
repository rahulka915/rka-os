# Exercise Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Note: this plan was executed inline in the authoring session rather than via subagent dispatch — the plan already specifies complete code for every file, so a fresh subagent would only re-derive context already established here. See the `feedback-execution-approach-efficiency` policy: default to inline execution when a plan is fully code-specified.

**Goal:** Copy the 183-image exercise PNG set recovered from a retired PWA worktree into the mobile app, generate a static asset registry + a full starter-exercise catalog from it (title/muscle-group/equipment inferred from filename), and show thumbnails in the exercise library, picker, and template block rows.

**Architecture:** Static `require()` asset registry (Metro cannot resolve dynamic paths), generated once by a committed codegen script from the copied PNGs — same pattern as `src/domain/ronin/roninAssets.ts`. `ExerciseMeta` gains an opaque `imageKey` string; only the starter-catalog bulk-create path sets it. A new `ExerciseThumbnail` component resolves `imageKey` to an image or a placeholder.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Node.js (codegen script, `.cjs`, run once via plain `node`).

## Global Constraints

- Metro/RN cannot `require()` a computed path — every image `require()` in the generated registry must be a literal string argument.
- `metadata` on `items` is a JSON string column, always `JSON.parse`/`JSON.stringify`'d — `imageKey` is just one more optional field in that blob.
- No image-picker UI in this pass — `imageKey` is set only by the starter-catalog bulk-create path; `ExerciseEditSheet` has no control for it, but must preserve an existing exercise's `imageKey` through an edit (it currently would silently drop unknown metadata fields it doesn't manage — this must NOT happen for `imageKey`).
- Follow the codebase's existing static-asset-registry pattern (`src/domain/ronin/roninAssets.ts`): `assets/<category>/*.png` + a hand-generated `Record<string, ImageSourcePropType>`.
- `src/utils/*.test.ts` files run under plain `node --test` (no RN/Metro), so nothing they import may itself `require()` a `.png` — this is why `starterExercises.ts` stores only a string `imageKey`, never importing `exerciseImages.ts`.
- This is a native Expo app with no browser preview — UI verification (thumbnails rendering, placeholder fallback) is manual/on-device, not automated. Verify non-UI changes via `npx tsc --noEmit` and `npm test` from `apps/mobile/`.

---

### Task 1: Copy and dedupe exercise PNGs

**Files:**
- Create: `apps/mobile/assets/exercises/*.png` (183 files, copied from `.worktrees/ronin-hero-painterly-png/public/images/exercises/`)

**Interfaces:**
- Produces: the physical asset files Task 2's codegen script reads.

- [ ] **Step 1: Copy, dropping the one true duplicate**

The source directory has 184 files, but `CloseGripLatPulldown.png` and `CloseGripLatPulldown .png` (trailing-space filename) are the same exercise — copy only the canonical one.

```bash
cd "apps/mobile"
mkdir -p assets/exercises
rsync -a --exclude='CloseGripLatPulldown .png' \
  "../../.worktrees/ronin-hero-painterly-png/public/images/exercises/" \
  "assets/exercises/"
```

- [ ] **Step 2: Verify count and no stray files**

```bash
ls apps/mobile/assets/exercises | wc -l   # expect 183
ls apps/mobile/assets/exercises | grep -v '\.png$'   # expect no output
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/assets/exercises
git commit -m "feat(mobile): add exercise reference image assets"
```

---

### Task 2: Codegen script — generate the image registry and starter catalog

**Files:**
- Create: `apps/mobile/scripts/generateExerciseAssets.cjs`

**Interfaces:**
- Consumes: `apps/mobile/assets/exercises/*.png` (Task 1).
- Produces: `apps/mobile/src/utils/exerciseImages.ts` (Task 3) and `apps/mobile/src/utils/starterExercises.ts` (Task 4) — this script writes both files when run; Tasks 3 and 4 below show their expected final content after running it once.

This is a one-off dev tool (not part of the app runtime/build), validated by manual inspection of its output (title quality, muscle-group distribution, no duplicate titles/keys) rather than an automated test — see the "Prototype validation" note below.

- [ ] **Step 1: Write the script**

```javascript
// apps/mobile/scripts/generateExerciseAssets.cjs
// One-off codegen: reads assets/exercises/*.png and writes
// src/utils/exerciseImages.ts (static require() registry) and
// src/utils/starterExercises.ts (full starter catalog with inferred
// title/muscleGroup/equipment/imageKey). Re-run after adding new PNGs
// to assets/exercises/ and commit the regenerated output.
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../assets/exercises');
const IMAGES_OUT = path.join(__dirname, '../src/utils/exerciseImages.ts');
const STARTERS_OUT = path.join(__dirname, '../src/utils/starterExercises.ts');

const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.png')).sort();

function splitPascal(stem) {
  // Two-pass acronym-aware split: lower/digit->upper boundaries first (most
  // filenames), then "run of capitals followed by a new capitalized word"
  // (e.g. "TRXCloseGripPushUps" -> "TRX Close Grip Push Ups", not
  // "T R X Close Grip Push Ups").
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Vocabulary harvested from filenames that already split cleanly (have
// internal capitals) — reused to segment the ~20% of filenames that are
// all-lowercase and would otherwise produce one unreadable run-on word.
const vocab = new Set();
for (const file of files) {
  const stem = file.replace(/\.png$/i, '');
  const words = splitPascal(stem);
  if (words.length > 1) {
    for (const w of words) vocab.add(w.toLowerCase());
  }
}

// Supplement words the harvested vocabulary doesn't cover (validated by
// running this script and checking no filename still produces a single
// run-on word longer than 12 characters).
const SUPPLEMENT_VOCAB = [
  'biceps', 'triceps', 'good', 'morning', 'face', 'shrug', 'skull', 'crusher',
  'hyper', 'extension', 'cross', 'body', 'concentration', 'pseudo', 'planche',
  'push', 'up', 'rear', 'delt', 'rope', 'straight', 'arm', 'sumo', 'wrist',
  'adduction', 'lat', 'pulldown', 'seated', 'deadlift', 'renegade', 'rows', 'trap',
];
for (const w of SUPPLEMENT_VOCAB) vocab.add(w);

function segmentWords(s, vocabSet) {
  const n = s.length;
  const dp = new Array(n + 1).fill(null);
  const wordCount = new Array(n + 1).fill(Infinity);
  wordCount[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < i; j++) {
      const sub = s.slice(j, i);
      if (sub.length >= 2 && vocabSet.has(sub) && wordCount[j] + 1 < wordCount[i]) {
        wordCount[i] = wordCount[j] + 1;
        dp[i] = j;
      }
    }
  }
  if (wordCount[n] === Infinity) return null;
  const words = [];
  let i = n;
  while (i > 0) {
    const j = dp[i];
    words.unshift(s.slice(j, i));
    i = j;
  }
  return words;
}

function capitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function formatTitle(file) {
  // Title formatting strips "final"/"image"/"img" filename suffixes (a few
  // source files have them, e.g. "CableSeatedRowimage.png"); imageKey below
  // uses the *raw* stem unchanged so it still matches the real filename.
  const rawStem = file.replace(/\.png$/i, '');
  const cleanedStem = rawStem.replace(/final/gi, '').replace(/image/gi, '').replace(/img/gi, '');
  let words = splitPascal(cleanedStem);
  if (words.length === 1) {
    const seg = segmentWords(cleanedStem.toLowerCase(), vocab);
    if (seg) words = seg;
  }
  return words.map(capitalize).join(' ');
}

function inferEquipment(stem) {
  const n = stem.toLowerCase();
  if (n.includes('dumbbell')) return 'dumbbell';
  if (n.includes('barbell') || n.includes('ezbar') || n.includes('smith')) return 'barbell';
  if (n.includes('cable')) return 'cable';
  if (n.includes('machine')) return 'machine';
  if (n.includes('band')) return 'band';
  if (n.includes('kettlebell')) return 'kettlebell';
  return 'bodyweight';
}

function inferMuscleGroup(stem) {
  const n = stem.toLowerCase();
  if (n.includes('goodmorning') || n.includes('sumo')) return 'legs';
  if ((n.includes('curl') && !n.includes('leg') && !n.includes('wrist')) || n.includes('tricep') || n.includes('bicep') || n.includes('skull') || n.includes('wrist') || n.includes('forearm')) return 'arms';
  if (n.includes('chest')) return 'chest';
  if ((n.includes('push') || n.includes('press') || n.includes('dip') || n.includes('fly')) && !n.includes('leg') && !n.includes('shoulder') && !n.includes('overhead') && !n.includes('delt')) return 'chest';
  if (n.includes('shoulder') || n.includes('delt') || n.includes('raise') || n.includes('shrug') || n.includes('overhead')) return 'shoulders';
  if (n.includes('row') || n.includes('pull') || n.includes('chin') || n.includes('lat')) return 'back';
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('calf') || n.includes('deadlift')) return 'legs';
  if (n.includes('plank') || n.includes('core') || n.includes('abs') || n.includes('bird') || n.includes('adduction') || n.includes('hyperextension')) return 'core';
  return 'full-body';
}

const entries = files.map((file) => {
  const stem = file.replace(/\.png$/i, '');
  return {
    file,
    imageKey: stem,
    title: formatTitle(file),
    equipment: inferEquipment(stem),
    muscleGroup: inferMuscleGroup(stem),
  };
});

// Sanity checks — fail loudly rather than silently emit bad data. A
// single-word title is usually a sign segmentation failed to fully break up
// a run-on filename; a few titles are legitimately one word, so those are
// allowlisted explicitly rather than filtered by a length threshold (a
// length threshold previously let two real bugs slip through at exactly the
// cutoff length).
const ALLOWED_SINGLE_WORD_TITLES = new Set(['Burpees', 'Wrist']);
const uglyTitles = entries.filter((e) => !e.title.includes(' ') && !ALLOWED_SINGLE_WORD_TITLES.has(e.title));
if (uglyTitles.length > 0) {
  console.error('Un-segmented titles (add words to SUPPLEMENT_VOCAB, or allowlist if legitimate):', uglyTitles.map((e) => `${e.file} -> ${e.title}`));
  process.exit(1);
}
const dupeTitles = entries.map((e) => e.title).filter((t, i, arr) => arr.indexOf(t) !== i);
if (dupeTitles.length > 0) {
  console.error('Duplicate titles:', dupeTitles);
  process.exit(1);
}

// --- Write src/utils/exerciseImages.ts ---
const imagesSorted = [...entries].sort((a, b) => a.imageKey.localeCompare(b.imageKey));
const imagesBody = imagesSorted
  .map((e) => `  '${e.imageKey}': require('../../assets/exercises/${e.file}'),`)
  .join('\n');
const imagesFile = `import type { ImageSourcePropType } from 'react-native';

// Generated by scripts/generateExerciseAssets.cjs — do not hand-edit.
// Static require() registry: Metro cannot resolve a dynamically-computed
// require() path, so every bundled exercise image needs a literal entry
// here (same pattern as src/domain/ronin/roninAssets.ts).
export const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
${imagesBody}
};
`;
fs.writeFileSync(IMAGES_OUT, imagesFile);

// --- Write src/utils/starterExercises.ts ---
const startersSorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));
const startersBody = startersSorted
  .map((e) => `  { title: '${e.title.replace(/'/g, "\\'")}', muscleGroup: '${e.muscleGroup}', equipment: '${e.equipment}', imageKey: '${e.imageKey}' },`)
  .join('\n');
const startersFile = `import type { MuscleGroup, Equipment } from './exerciseLibrary';

export interface StarterExercise {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  imageKey?: string;
}

// Generated by scripts/generateExerciseAssets.cjs from assets/exercises/ —
// do not hand-edit; re-run the script after adding new images.
export const STARTER_EXERCISES: StarterExercise[] = [
${startersBody}
];
`;
fs.writeFileSync(STARTERS_OUT, startersFile);

console.log(`Wrote ${entries.length} entries to ${path.relative(process.cwd(), IMAGES_OUT)} and ${path.relative(process.cwd(), STARTERS_OUT)}`);
```

**Prototype validation (already performed during design, not a step to repeat):** this exact algorithm — including the acronym-aware split, the `image`/`img`/`final` suffix stripping, and the full `SUPPLEMENT_VOCAB` list above — was run against the 183 files ahead of writing this plan, then iterated three times after manual review surfaced real defects (a naive length-based "ugly title" threshold missed `Renegaderows`→`Trapbarshrug`-style bugs at exactly the cutoff length; `EzBarLyingTricepsExtensionImg`/`CableSeatedRowimage` weren't having their `img`/`image` suffix stripped; `TRXCloseGripPushUps` was splitting into single letters "T R X" instead of keeping the acronym together). Final result: 0 un-segmented titles beyond the two legitimate ones (`Burpees`, `Wrist`), 0 duplicate titles, 183 unique `imageKey`s, muscle-group distribution `{chest: 62, arms: 69, back: 33, shoulders: 5, core: 4, legs: 4, 'full-body': 6}` (no `cardio` — this asset set is strength-only, which is why Task 4 relaxes the starter-catalog test's "covers every muscle group" assertion).

- [ ] **Step 2: Run it**

```bash
cd apps/mobile && node scripts/generateExerciseAssets.cjs
```

Expected: `Wrote 183 entries to src/utils/exerciseImages.ts and src/utils/starterExercises.ts`, no error output.

- [ ] **Step 3: Spot-check the output**

```bash
head -5 apps/mobile/src/utils/exerciseImages.ts
grep -c "require(" apps/mobile/src/utils/exerciseImages.ts   # expect 183
head -10 apps/mobile/src/utils/starterExercises.ts
grep -c "imageKey:" apps/mobile/src/utils/starterExercises.ts   # expect 183
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/scripts/generateExerciseAssets.cjs apps/mobile/src/utils/exerciseImages.ts apps/mobile/src/utils/starterExercises.ts
git commit -m "feat(mobile): generate exercise image registry and full starter catalog"
```

---

### Task 3: Add `imageKey` to `ExerciseMeta` and preserve it through edits

**Files:**
- Modify: `apps/mobile/src/utils/exerciseLibrary.ts`
- Modify: `apps/mobile/src/utils/exerciseLibrary.test.ts`
- Modify: `apps/mobile/src/components/ExerciseEditSheet.tsx`

**Interfaces:**
- Produces: `ExerciseMeta.imageKey?: string`, `ExerciseDraft.imageKey?: string` — consumed by Task 4 (starter catalog already emits `imageKey`), Task 6 (`ExerciseLibraryScreen`), Task 7 (`ExercisePickerSheet`), Task 8 (`WorkoutTemplateDetailScreen`).

- [ ] **Step 1: Extend the failing test**

Add to `apps/mobile/src/utils/exerciseLibrary.test.ts`, inside the existing `'parseExerciseMeta reads valid fields and drops invalid ones'` test (replace that whole test):

```typescript
test('parseExerciseMeta reads valid fields and drops invalid ones', () => {
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' })),
    { muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' },
  );
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'not-a-group', equipment: 'not-equipment', imageKey: 123 })),
    { muscleGroup: 'full-body' },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — actual result has no `imageKey` field yet.

- [ ] **Step 3: Update `ExerciseMeta`/`parseExerciseMeta`**

In `apps/mobile/src/utils/exerciseLibrary.ts`:

```typescript
export interface ExerciseMeta {
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  imageKey?: string;
}
```

```typescript
  try {
    const parsed = JSON.parse(metadata);
    const muscleGroup: MuscleGroup = MUSCLE_GROUPS.includes(parsed.muscleGroup) ? parsed.muscleGroup : 'full-body';
    const meta: ExerciseMeta = { muscleGroup };
    if (EQUIPMENT_OPTIONS.includes(parsed.equipment)) meta.equipment = parsed.equipment;
    if (typeof parsed.notes === 'string' && parsed.notes.trim()) meta.notes = parsed.notes;
    if (typeof parsed.imageKey === 'string' && parsed.imageKey.trim()) meta.imageKey = parsed.imageKey;
    return meta;
  } catch {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS.

- [ ] **Step 5: Preserve `imageKey` through `ExerciseEditSheet`**

In `apps/mobile/src/components/ExerciseEditSheet.tsx`, add `imageKey` to `ExerciseDraft`:

```typescript
export interface ExerciseDraft {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  imageKey?: string;
}
```

The sheet has no UI for `imageKey` — it must pass through whatever `initialValue` carried, unmodified, since it's not part of any editable local state. Change `handleSave`:

```typescript
  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ title: trimmedTitle, muscleGroup, equipment, notes: notes.trim() || undefined, imageKey: initialValue?.imageKey });
    onClose();
  };
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (some pre-existing unrelated errors in `webApp/`/`App.tsx` are expected — see the parent plan's Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/utils/exerciseLibrary.ts apps/mobile/src/utils/exerciseLibrary.test.ts apps/mobile/src/components/ExerciseEditSheet.tsx
git commit -m "feat(mobile): add imageKey to exercise metadata, preserved through edits"
```

---

### Task 4: Relax the starter-catalog test for the real (non-uniform) data, verify imageKeys

**Files:**
- Modify: `apps/mobile/src/utils/starterExercises.test.ts`

**Interfaces:**
- Consumes: `STARTER_EXERCISES` (now 183 entries with `imageKey`, from Task 2).

The original test asserted every `MuscleGroup` has at least one starter exercise — true for the hand-picked 20, false for the real asset set (no `cardio` exercises exist in it). Replace the coverage assertion with an `imageKey`-focused one.

- [ ] **Step 1: Rewrite the test**

Replace the full contents of `apps/mobile/src/utils/starterExercises.test.ts`:

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EXERCISES } from './starterExercises.ts';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from './exerciseLibrary.ts';

test('starter exercises are non-empty with unique titles and image keys', () => {
  assert.ok(STARTER_EXERCISES.length >= 100);
  const titles = STARTER_EXERCISES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  const imageKeys = STARTER_EXERCISES.map((e) => e.imageKey);
  assert.equal(new Set(imageKeys).size, imageKeys.length);
});

test('every starter exercise has a valid muscle group, equipment, and non-empty image key', () => {
  for (const exercise of STARTER_EXERCISES) {
    assert.ok(MUSCLE_GROUPS.includes(exercise.muscleGroup), `${exercise.title} has invalid muscle group`);
    if (exercise.equipment) {
      assert.ok(EQUIPMENT_OPTIONS.includes(exercise.equipment), `${exercise.title} has invalid equipment`);
    }
    assert.ok(typeof exercise.imageKey === 'string' && exercise.imageKey.length > 0, `${exercise.title} missing imageKey`);
  }
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/utils/starterExercises.test.ts
git commit -m "test(mobile): update starter exercise assertions for the full image catalog"
```

---

### Task 5: `ExerciseThumbnail` component

**Files:**
- Create: `apps/mobile/src/components/ExerciseThumbnail.tsx`

**Interfaces:**
- Consumes: `EXERCISE_IMAGES` (Task 2, `src/utils/exerciseImages.ts`), `Dumbbell` icon (existing, `src/icons.tsx`), `useThemeContext`/`getThemeColors` (existing).
- Produces: `ExerciseThumbnail` component — `{ imageKey?: string; size?: number }` — consumed by Tasks 6, 7, 8.

UI component, no automated test (see Global Constraints) — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/ExerciseThumbnail.tsx
import { Image, StyleSheet, View } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { EXERCISE_IMAGES } from '../utils/exerciseImages';
import { Dumbbell } from '../icons';

interface ExerciseThumbnailProps {
  imageKey?: string;
  size?: number;
}

export function ExerciseThumbnail({ imageKey, size = 40 }: ExerciseThumbnailProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const source = imageKey ? EXERCISE_IMAGES[imageKey] : undefined;
  const dimensions = { width: size, height: size, borderRadius: size / 4 };

  if (source) {
    return <Image source={source} style={[styles.image, dimensions]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.placeholder, dimensions, { backgroundColor: palette.fill }]}>
      <Dumbbell size={size * 0.5} color={palette.textTertiary} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ExerciseThumbnail.tsx
git commit -m "feat(mobile): add ExerciseThumbnail component"
```

---

### Task 6: Wire thumbnails + full starter catalog into `ExerciseLibraryScreen`

**Files:**
- Modify: `apps/mobile/src/screens/ExerciseLibraryScreen.tsx`

**Interfaces:**
- Consumes: `ExerciseThumbnail` (Task 5), `STARTER_EXERCISES` with `imageKey` (Task 2, already imported).

- [ ] **Step 1: Import the thumbnail component**

```typescript
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
```

- [ ] **Step 2: Pass `imageKey` through when bulk-creating starters**

Change `addStarters`:

```typescript
  const addStarters = () => {
    for (const starter of STARTER_EXERCISES) {
      const id = createItem('exercise', starter.title, 'active');
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment, imageKey: starter.imageKey });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };
```

- [ ] **Step 3: Preserve `imageKey` when saving from the edit sheet**

Change `handleSubmit`:

```typescript
  const handleSubmit = (draft: ExerciseDraft) => {
    if (editTarget) {
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };
```

- [ ] **Step 4: Show the thumbnail in each row**

The row currently is:

```typescript
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => openEdit(item)}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={400}
                >
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                    {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                  </Text>
                </TouchableOpacity>
```

Change to a row layout with the thumbnail leading a text column:

```typescript
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => openEdit(item)}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={400}
                >
                  <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                      {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                    </Text>
                  </View>
                </TouchableOpacity>
```

- [ ] **Step 5: Update styles**

The `row` style currently has `gap: 2` (vertical text gap) with no horizontal layout — change it to a row flex container and move the text gap onto a new `rowText` style:

```typescript
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
```

(Replace the existing `row: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },` line with the two lines above.)

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/ExerciseLibraryScreen.tsx
git commit -m "feat(mobile): show exercise thumbnails in the library, use full starter catalog"
```

---

### Task 7: Wire thumbnails into `ExercisePickerSheet`

**Files:**
- Modify: `apps/mobile/src/components/ExercisePickerSheet.tsx`

**Interfaces:**
- Consumes: `ExerciseThumbnail` (Task 5).

- [ ] **Step 1: Import the thumbnail component**

```typescript
import { ExerciseThumbnail } from './ExerciseThumbnail';
```

- [ ] **Step 2: Preserve `imageKey` when inline-creating from the picker**

`handleCreateSubmit` builds a full `Item` object manually — it already spreads `draft`'s fields into `metadata`; add `imageKey`:

```typescript
  const handleCreateSubmit = (draft: ExerciseDraft) => {
    const id = createItem('exercise', draft.title, 'active');
    updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    refresh();
    const created: Item = {
      id,
      type: 'exercise',
      title: draft.title,
      status: 'active',
      metadata: JSON.stringify({ muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCreateOpen(false);
    setQuery('');
    onClose();
    onPick(created);
  };
```

- [ ] **Step 3: Show the thumbnail in each row**

Change:

```typescript
                <TouchableOpacity key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                    {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                  </Text>
                </TouchableOpacity>
```

to:

```typescript
                <TouchableOpacity key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                  <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={36} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                      {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                    </Text>
                  </View>
                </TouchableOpacity>
```

- [ ] **Step 4: Update styles**

Replace `row: { paddingVertical: 8, gap: 2 },` with:

```typescript
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  rowText: { flex: 1, gap: 2 },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ExercisePickerSheet.tsx
git commit -m "feat(mobile): show exercise thumbnails in the exercise picker"
```

---

### Task 8: Wire thumbnails into `WorkoutTemplateDetailScreen` block rows

**Files:**
- Modify: `apps/mobile/src/screens/WorkoutTemplateDetailScreen.tsx`

**Interfaces:**
- Consumes: `ExerciseThumbnail` (Task 5), `parseExerciseMeta` (existing, `src/utils/exerciseLibrary.ts`).

Block rows currently only carry `exerciseTitle` (looked up via the block's `exercise` relation) — add `exerciseImageKey`.

- [ ] **Step 1: Import what's needed**

```typescript
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
```

- [ ] **Step 2: Extend `BlockRow` and populate it in `refresh`**

```typescript
interface BlockRow {
  block: Item;
  exerciseTitle: string;
  exerciseImageKey?: string;
}
```

```typescript
  const refresh = useCallback(() => {
    const blocks = applyManualOrder(listKey, getRelatedItems(templateId, 'workout-template'));
    const nextRows: BlockRow[] = blocks.map((block) => {
      const exerciseId = getRelation(block.id, 'exercise');
      const exercise = exerciseId ? getItemWithMetadata(exerciseId) : null;
      return {
        block,
        exerciseTitle: exercise?.title ?? block.title,
        exerciseImageKey: exercise ? parseExerciseMeta(exercise.metadata).imageKey : undefined,
      };
    });
    setRows(nextRows);
  }, [templateId, listKey]);
```

- [ ] **Step 3: Show the thumbnail in each row**

Change:

```typescript
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.exerciseTitle}</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
              {formatBlockSummary(parseBlockMeta(row.block.metadata))}
            </Text>
          </View>
          <DragHandleButton color={palette.textMuted} />
```

to:

```typescript
          <ExerciseThumbnail imageKey={row.exerciseImageKey} size={36} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.exerciseTitle}</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
              {formatBlockSummary(parseBlockMeta(row.block.metadata))}
            </Text>
          </View>
          <DragHandleButton color={palette.textMuted} />
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/WorkoutTemplateDetailScreen.tsx
git commit -m "feat(mobile): show exercise thumbnails in template block rows"
```

---

### Task 9: Update schema/platform docs

**Files:**
- Modify: `apps/mobile/SCHEMA.md`
- Modify: `apps/mobile/CLAUDE.md`

Per the repo's Multi-Agent Rule, metadata/component additions must be documented immediately.

- [ ] **Step 1: Update `SCHEMA.md`**

Change the `exercise` row's metadata fields:

```
| `exercise` | built | `muscleGroup`, `equipment`, `notes` |
```

to:

```
| `exercise` | built | `muscleGroup`, `equipment`, `notes`, `imageKey` |
```

- [ ] **Step 2: Update `CLAUDE.md`**

Add one row to the Components table:

```
| `ExerciseThumbnail.tsx` | RN primitives (Image) | Exercise image or placeholder, used in library/picker/template rows |
```

Also add a short note near wherever static assets are documented (or, if there's no existing "assets" subsection, add one under the Components section) pointing at the new registry:

```
### Exercise Images

`assets/exercises/*.png` (183 images) + `src/utils/exerciseImages.ts` (generated static `require()` registry) + `src/utils/starterExercises.ts` (generated full starter catalog). Regenerate both via `node scripts/generateExerciseAssets.cjs` from `apps/mobile/` after adding new PNGs to `assets/exercises/` — do not hand-edit the two generated files.
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/SCHEMA.md apps/mobile/CLAUDE.md
git commit -m "docs(mobile): document exercise image registry and starter catalog"
```

---

### Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors beyond the pre-existing baseline (`webApp/` missing-module errors, unrelated in-progress `App.tsx`/`HomeScreen.tsx` prop-type errors from other work in this repo).

- [ ] **Step 2: Full unit test suite**

Run: `cd apps/mobile && npm test`
Expected: all tests pass, including the updated `exerciseLibrary.test.ts` and `starterExercises.test.ts`.

- [ ] **Step 3: Report manual verification steps to the user**

No browser preview exists for this native app — report which of the following were verified by code review only vs. actually run:

1. Menu → Workouts → Exercise Library → empty-state "Add starter exercises" now creates 183 exercises (not 20), each showing a real photo thumbnail in the row.
2. Exercises created manually (no starter image) show the placeholder dumbbell box instead.
3. Editing a starter-sourced exercise (rename, change muscle group) and saving still shows its thumbnail afterward (imageKey wasn't dropped).
4. Exercise picker (inside a template's "+") shows thumbnails too, and search still filters correctly.
5. A template's exercise block rows show the linked exercise's thumbnail next to its title/summary.

- [ ] **Step 4: Commit (only if Step 3 surfaced fixes)**
