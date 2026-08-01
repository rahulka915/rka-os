# Exercise Images — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

The exercise library feature ([2026-08-01-workout-exercise-library-design.md](2026-08-01-workout-exercise-library-design.md)) shipped with a hand-picked 20-item starter catalog and no images. A retired PWA (checked out at `.worktrees/ronin-hero-painterly-png/`, a stray leftover worktree, not part of `main`) has a real asset set: `public/images/exercises/` — 184 PNG files (one true duplicate: `CloseGripLatPulldown.png` and `CloseGripLatPulldown .png`, a trailing-space-filename copy of the same exercise, so 183 unique exercises) — plus `src/db/generated-exercises.json`, a generated catalog mapping each image to a title, equipment, and muscle tags, built by `scripts/generateExercises.cjs`'s filename-inference heuristic.

This spec pulls that asset set into the mobile app's exercise library.

## Constraint: static asset requires

React Native's Metro bundler cannot `require()` a dynamically-computed path — only literal string arguments are statically analyzable and get bundled. This app's existing convention for exactly this situation is `src/domain/ronin/roninAssets.ts`: an `assets/<category>/*.png` folder plus a hand-generated `Record<string, ImageSourcePropType>` of literal `require()` calls. This spec follows the same pattern.

## Data Model

Extends `ExerciseMeta` (`src/utils/exerciseLibrary.ts`) with one new optional field:

```
metadata: {
  muscleGroup: MuscleGroup,
  equipment?: Equipment,
  notes?: string,
  imageKey?: string,   // key into EXERCISE_IMAGES; undefined = no image
}
```

`imageKey` is opaque outside the image registry — screens never construct a require path themselves, they look up `EXERCISE_IMAGES[imageKey]`.

No image-picker UI is added in this pass: `imageKey` is set only by the starter-catalog bulk-create path. Manually created exercises (via `ExerciseEditSheet`) have no `imageKey` and show a placeholder. Editing an existing (possibly starter-sourced) exercise must preserve its `imageKey` even though the edit sheet has no control for it — `ExerciseDraft` carries `imageKey` through untouched.

## Assets

- Copy the 183 unique PNGs from the old worktree's `public/images/exercises/` into `apps/mobile/assets/exercises/`, normalizing the one trailing-space filename to its canonical form during copy (so the resulting registry has no whitespace-key ambiguity) and dropping the duplicate file.
- Generate `apps/mobile/src/utils/exerciseImages.ts`: `export const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = { ArcherPushUp: require('../../assets/exercises/ArcherPushUp.png'), ... }` for all 183 images. Keys are the filename without extension (PascalCase, matching the source filenames — no reformatting).
- The codegen script that produces both `exerciseImages.ts` and the regenerated `STARTER_EXERCISES` list lives at `apps/mobile/scripts/generateExerciseAssets.cjs`, committed to the repo so a future asset addition can be regenerated the same way (append new PNGs to `assets/exercises/`, rerun the script, commit the diff). It is a one-off dev tool, not part of the app runtime or build.

## Starter Catalog

`STARTER_EXERCISES` (`src/utils/starterExercises.ts`) is regenerated from all 183 images instead of the current hand-picked 20. Each entry gains `imageKey: string`. Muscle/equipment inference reuses the old PWA script's filename heuristic (keyword matching on push/press/row/pull/squat/curl/etc.), adapted to this app's 8-group `MuscleGroup` taxonomy — the source data's finer `biceps`/`triceps`/`forearms` tags fold into this app's single `arms` group; `chest`/`back`/`shoulders`/`legs`/`core` map 1:1. Equipment values (`band`/`barbell`/`bodyweight`/`cable`/`dumbbell`/`kettlebell`/`machine`) already match this app's `Equipment` union exactly — no mapping needed (`'other'` and `'trx'` are unused by this asset set). Where a filename implies multiple muscle groups (e.g. a press implies chest + triceps), the first/primary group from the heuristic is kept, since `ExerciseMeta.muscleGroup` is single-select by design.

"Add starter exercises" (`ExerciseLibraryScreen`'s empty-state action) is otherwise unchanged — it already loops `STARTER_EXERCISES` and calls `createItem`/`updateItemMetadata` per entry; it now just processes 183 instead of 20. `updateItemMetadata` additionally writes `imageKey` for these.

## UI

New shared component `ExerciseThumbnail` (`src/components/ExerciseThumbnail.tsx`): given an optional `imageKey`, renders a 40×40 rounded `Image` if `EXERCISE_IMAGES[imageKey]` resolves, otherwise a muted placeholder box (existing `Dumbbell` icon, per the app's icon set). Used in:
- `ExerciseLibraryScreen` rows
- `ExercisePickerSheet` rows
- `WorkoutTemplateDetailScreen` block rows

Row layout in all three gains the thumbnail as a leading element; existing title/subtitle text is unaffected.

## Out of Scope

- No image picker/gallery UI for attaching an image to a manually-created exercise.
- No image compression/optimization pass — the 183 PNGs are used as-is (~21MB total added to the bundle), matching how the old PWA shipped them. Revisit only if bundle size becomes a problem.
- No change to the desktop web shell (`src/webApp/`), consistent with the parent spec's scope decision.
