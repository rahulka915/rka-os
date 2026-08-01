# Web Exercise Library + Workout Template Builder — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

`apps/mobile/src/webApp/` is a genuinely separate, actively-developed desktop/web target (Expo web, `.web.tsx` platform-specific screens, run via `npm run web`) — distinct from the retired Vite/Dexie PWA that `CLAUDE.md`/`HANDOVER_SUMMARY.md` still describe as the project's web history. It shares the same SQLite-backed data layer (`db/database.ts`, `hooks/useDb.ts`, `utils/`) as mobile, but has its own screens, its own theme (`webColors`/`webSpacing` from `theme/webTheme.ts`), its own icon set (`lucide-react-native`), and a different navigation model: a `Sidebar` of top-level views, each rendering a single screen (list + capture row) with a right-side sliding `DetailPanel` for viewing/editing one item, rather than mobile's `react-navigation` screen stack.

Today, `WorkoutsScreen.web.tsx` only lists workout-template titles and edits them with the fully generic `ItemDetailForm` (title/notes/date/priority) — there is no web equivalent of mobile's exercise library (`ExerciseLibraryScreen`, `ExerciseMuscleGroupScreen`, `ExerciseDetailScreen`) or its workout-template block editor (`WorkoutTemplateDetailScreen`, `ExercisePickerSheet`, `BlockEditSheet`). This spec brings both to web, adapted to the web app's existing list+panel idiom rather than a literal port of mobile's screen-stack UI.

**No schema or shared-logic changes are needed.** Every helper this spec uses (`groupExercisesByMuscle`, `filterExercisesByQuery`, `pickGroupThumbnailImageKey`, `parseExerciseMeta`, `formatExerciseSubtitle`, `parseBlockMeta`, `formatBlockSummary`, `getRelatedItems`, `getRelation`, `setRelation`, `getTemplatesForExercise`, `applyManualOrder`, `setManualOrder`) already lives in platform-agnostic `db/` and `utils/` files, shared verbatim between mobile and web.

## Screens & Components

### 1. `WorkoutsScreen.web.tsx` (modified)

- Adds a segmented control at the top ("Templates" | "Exercises") backed by `activeTab: 'templates' | 'exercises'` state, default `'templates'`.
- The `'templates'` branch is today's existing list/capture/`DetailPanel` logic, unchanged except the `DetailPanel`'s content: when the selected item's `type === 'workout-template'`, render the new `WorkoutTemplateDetailPanel` (Task 4) instead of the generic `ItemDetailForm`; the panel's own `mode` state still supports switching to `ItemDetailForm` for title/notes-only editing via a secondary "Edit details" affordance inside `WorkoutTemplateDetailPanel`, mirroring `HabitsScreen`'s `mode: 'detail' | 'edit'` split.
- The `'exercises'` branch renders the new `ExerciseLibraryScreen` (Task 2).

### 2. `ExerciseLibraryScreen.web.tsx` (new)

- Owns `query`, `selectedMuscleGroup: MuscleGroup | null`, and `selectedExerciseId` state.
- Default view (no query, no selected group): 2-column-equivalent CSS-flex-wrap grid of `MuscleGroupCard.web.tsx` (Task 3) — same data as mobile (`groupExercisesByMuscle`, `pickGroupThumbnailImageKey`), one card per non-empty muscle group.
- Typing a query switches to a flat filtered list (`filterExercisesByQuery`) regardless of `selectedMuscleGroup`; clearing it restores whichever view `selectedMuscleGroup` implies.
- Tapping a card sets `selectedMuscleGroup`, switching the grid to a flat list of just that group's exercises (same row style as the filtered-search list) with a "‹ Back to groups" link above it that clears `selectedMuscleGroup`. This is a single screen with two rendering modes, not a second screen/route.
- Tapping an exercise row sets `selectedExerciseId`, opening the shared `DetailPanel` with `ExerciseDetailPanel` content (Task 3b/5).
- Empty-state (no exercises at all): same "Add starter exercises" CTA as mobile, reusing `STARTER_EXERCISES`.

### 3. `MuscleGroupCard.web.tsx` (new)

- Presentational: `{ label: string; count: number; imageKey?: string; onPress: () => void }`.
- Uses a new `ExerciseThumbnail.web.tsx` (Task 3a) for the photo/placeholder, `webColors`/`webSpacing`/`webRadius` for styling.

### 3a. `ExerciseThumbnail.web.tsx` (new)

- Web port of mobile's `ExerciseThumbnail`: `{ imageKey?: string; size?: number }`, resolves `EXERCISE_IMAGES[imageKey]`, renders an `Image` or a placeholder box with a dumbbell icon (`lucide-react-native`'s `Dumbbell`) at `webColors.muted`/`webColors.mutedForeground`. Reused by the card grid, the exercise-library flat list rows, the exercise detail hero, and the template block rows/picker.

### 4. `ExerciseDetailPanel.web.tsx` (new)

- `DetailPanel` content for one exercise, mirroring `HabitDetailPanel`'s structure: props `{ item: Item; onEdit: () => void }`.
- Hero `ExerciseThumbnail` (size 160), muscle-group + equipment badges (pill `View`s using `webColors.muted` background), Tips section (only if `notes` present), Used In section (`getTemplatesForExercise`, each row tappable), Progress section (static empty-state text, same copy as mobile: "Log a workout to see stats and history here").
- Tapping a "Used In" template row calls a passed-in `onOpenTemplate(templateId)` prop rather than managing navigation itself — `ExerciseLibraryScreen` doesn't own template state, so this prop is threaded from `WorkoutsScreen` down through `ExerciseLibraryScreen` to `ExerciseDetailPanel`: selecting a template closes the exercise panel, switches `activeTab` to `'templates'`, and sets that template as `WorkoutsScreen`'s selected item.
- Pencil icon (header, matching `HabitDetailPanel`'s `onEdit` pattern) switches the panel to `ExerciseEditForm`.

### 5. `ExerciseEditForm.web.tsx` (new)

- `DetailPanel` content for create/edit: `{ initialValue?: ExerciseDraft; onSubmit: (draft: ExerciseDraft) => void; onCancel: () => void }` (reuses mobile's `ExerciseDraft` type, imported from `components/ExerciseEditSheet.tsx` — a type-only import, no RN-sheet-specific code pulled in).
- Inline form fields: title `TextInput`, muscle-group chip row, equipment chip row (single-select, includes "Any" clearing `equipment`), notes `TextInput` (multiline) — same chip-picker visual pattern `ItemDetailForm` already uses for priority/repeat.
- Save button disabled until title is non-empty, matching `ExerciseEditSheet`'s validation.

### 6. `WorkoutTemplateDetailPanel.web.tsx` (new)

- `DetailPanel` content for a workout-template item: props `{ item: Item; onEditDetails: () => void }` (the `onEditDetails` callback switches to the existing generic `ItemDetailForm` for title/notes-only edits, matching `HabitsScreen`'s two-mode split).
- Loads blocks via `applyManualOrder(`workout-template:${item.id}`, getRelatedItems(item.id, 'workout-template'))`, resolves each block's exercise via `getRelation(block.id, 'exercise')` + `getItemWithMetadata` — identical query shape to mobile's `WorkoutTemplateDetailScreen`.
- Renders each block as a row: `ExerciseThumbnail` + title + `formatBlockSummary(parseBlockMeta(block.metadata))`, draggable via the `useDraggableRef`/`useDropZoneRef` hooks adapted from `CalendarScreen.web.tsx` (Task 7) — dropping a row on another row's position reorders and persists via `setManualOrder`.
- Row click opens `BlockEditForm` (Task 8) inline in place of the block list (single-panel content swap, same pattern as detail↔edit elsewhere) for that block's sets/reps/weight/rest; a delete button on that form removes the block (`deleteItem`) and returns to the list.
- "+ Add exercise" button opens `ExercisePickerModal` (Task 9).

### 7. Drag-reorder hooks (extracted)

- `useDraggableRef(itemId: string)` and `useDropZoneRef(onDropItemId, onHoverChange)` currently live inline in `CalendarScreen.web.tsx`. Extract them to a new shared file `apps/mobile/src/webApp/hooks/useDomDragAndDrop.ts` (both `CalendarScreen.web.tsx` and the new `WorkoutTemplateDetailPanel.web.tsx` import from there); `CalendarScreen.web.tsx` is updated to import instead of defining them locally. No behavior change to `CalendarScreen`.
- `WorkoutTemplateDetailPanel` computes the new order by finding the dragged block's id and the drop-target block's id in the current `blocks` array, removing the dragged one and re-inserting it at the target's index, then persisting the whole resulting id order via `setManualOrder` — same "always rewrite the whole ordering" approach `setManualOrder`'s existing doc comment describes.

### 8. `BlockEditForm.web.tsx` (new)

- Inline form (not a modal): `{ exerciseTitle: string; initialValue?: BlockMeta; onSubmit: (meta: BlockMeta) => void; onCancel: () => void; onDelete: () => void }`.
- Sets/reps/weight/rest numeric inputs, matching the fields `parseBlockMeta`/`formatBlockSummary` already define — no new metadata shape.

### 9. `ExercisePickerModal.web.tsx` (new)

- Centered overlay dialog (own `Modal`-style overlay component, not `DetailPanel` — transient/focused search UI, and avoids nesting a second `DetailPanel` while a template's panel is already open).
- Search input (`filterExercisesByQuery`) + muscle-group sections (`groupExercisesByMuscle`) when empty, same structure as mobile's `ExercisePickerSheet`.
- Row tap calls `onPick(exercise)` and closes; a "+ New Exercise" row at the top opens `ExerciseEditForm` inline within the same modal (create mode), and on submit calls `onPick` with the newly created item.

## Data Layer

No new functions — this spec is pure UI composition over what already exists:
- `getTemplatesForExercise` (added for mobile, already platform-agnostic).
- `getRelatedItems`, `getRelation`, `setRelation`, `getItemWithMetadata`, `createItem`, `updateItemMetadata`, `updateItemTitle`, `deleteItem`, `applyManualOrder`, `setManualOrder`.
- `groupExercisesByMuscle`, `filterExercisesByQuery`, `pickGroupThumbnailImageKey`, `parseExerciseMeta`, `formatExerciseSubtitle`, `MUSCLE_GROUP_LABELS`, `EQUIPMENT_LABELS`.
- `parseBlockMeta`, `formatBlockSummary` (from `utils/workoutBlock.ts`).

Block order is stored under the same `listKey` format mobile uses (`workout-template:${templateId}`), so reordering on either platform reads/writes the same `itemOrder` rows — order stays consistent regardless of which platform last touched a template.

## Out of Scope

- Exercise image upload/management — web only renders the existing 183-image PNG registry by key; no new asset pipeline.
- Any new `Sidebar` entry — Exercises stays nested under the Workouts tab, not a top-level view.
- Nested/stacked `DetailPanel`s — switching which item's panel is open (e.g. exercise → its "Used In" template) replaces the panel's subject; it never stacks a second panel on top of an open one.
- Automated UI tests for the new `.web.tsx` screens — verified via `tsc --noEmit` plus manual browser check with `npm run web`, matching how this repo has verified web-app screens so far (no RN Testing Library setup exists yet).
