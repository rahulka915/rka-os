# RKA OS UI System Refactor Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Unify RKA OS around a single shared UI system, remove legacy duplicates, and reduce page-level styling drift without changing product behavior.

**Architecture:** Start by consolidating the shared primitive layer so rows, pills, headers, sheets, and empty states behave consistently everywhere. Then normalize the creator and inspector surfaces, followed by the heaviest screens that still carry inline styling and bespoke layout logic. Finish by deleting orphaned legacy modules and verifying the core routes still render and interact correctly.

**Tech Stack:** React, TypeScript, Vite, CSS, Dexie, lucide-react, React Router

---

### Task 1: Lock in the primitive layer

**Files:**
- Modify: `src/components/ui/primitives.tsx`
- Modify: `src/components/ui/primitives.css`

**Step 1: Review existing primitive contracts**

Confirm `PageHeader`, `Button`, `IconButton`, `ListRow`, `MetadataPill`, `EmptyState`, `StatCard`, `SegmentedControl`, `Tabs`, `BottomSheet`, `Drawer`, and `InspectorSection` are the only primitives that should remain as the shared surface.

**Step 2: Normalize row and pill behavior**

Make `ListRow` the canonical row shell and `MetadataPill` the canonical badge for all new UI. Keep title, subtitle, metadata, leading, and trailing in separate visual lanes.

**Step 3: Normalize spacing tokens**

Tighten the shared CSS so list density, pill spacing, header spacing, and section spacing come from one system rather than ad hoc page styles.

**Step 4: Verify in the browser**

Check these routes at mobile width:
- `/home`
- `/today`
- `/projects`
- `/inbox`
- `/health-search`
- `/calendar`

Expected: no title/subtitle collisions, no pill collisions, and trailing actions stay aligned.

**Step 5: Commit**

Use a small commit focused only on the primitive layer.

---

### Task 2: Remove duplicate pill and collapsible-section patterns

**Files:**
- Modify: `src/components/ui/Pill.tsx`
- Modify: `src/components/ui/SectionChip.tsx`
- Modify: `src/components/ui/CollapsibleTimeBlock.tsx`
- Modify: `src/components/inspector/EntityInspector.tsx`
- Modify: `src/components/creator/fields/EntityLinkerField.tsx`
- Modify: `src/components/creator/fields/SubItemsField.tsx` if any styling still depends on old chip behavior

**Step 1: Replace legacy pill usage**

Move any remaining `Pill` usage onto `MetadataPill` or a single shared pill implementation.

**Step 2: Replace section-chip-only behavior**

Either fold `SectionChip` behavior into the collapsible block pattern or reduce it to a thin wrapper so there is only one actual chip style.

**Step 3: Make collapsible time blocks use shared spacing**

Update `CollapsibleTimeBlock` so the header, count, and expand affordance use the shared primitive rhythm.

**Step 4: Verify impacted screens**

Check:
- `/home`
- `/inbox`
- `/calendar`
- entity inspector overlays

**Step 5: Commit**

Commit only the duplicate-pattern cleanup.

---

### Task 3: Normalize the creator system

**Files:**
- Modify: `src/components/creator/EntityCreator.tsx`
- Modify: `src/components/creator/fields/TextField.tsx`
- Modify: `src/components/creator/fields/SingleSelectField.tsx`
- Modify: `src/components/creator/fields/NumberSelectorField.tsx`
- Modify: `src/components/creator/fields/MultiSelectField.tsx`
- Modify: `src/components/creator/fields/SubItemsField.tsx`
- Modify: `src/components/creator/fields/EntityLinkerField.tsx`
- Modify: `src/components/ui/primitives.tsx` if a shared selector/menu primitive is needed
- Modify: `src/components/ui/primitives.css` for dropdown/menu spacing
- Modify: `src/components/shell/QuickAddSheet.tsx` if it needs to reuse the new creator layout

**Step 1: Unify field wrappers**

Make every creator field use the same label spacing, control height, and option styling.

**Step 2: Standardize dropdown menus**

Replace the current per-field dropdown feel with one shared floating menu pattern so select, multi-select, and entity-linker all look related.

**Step 3: Standardize token and sub-item visuals**

Make chips, tokens, and sub-item rows match the same radius, padding, and vertical rhythm.

**Step 4: Verify creation flows**

Check:
- Quick add
- Entity creator
- Task creation
- Habit creation
- Medication creation
- Workout template creation

**Step 5: Commit**

Keep this commit scoped to creator UX only.

---

### Task 4: Normalize inspector surfaces

**Files:**
- Modify: `src/components/inspector/EntityInspector.tsx`
- Modify: `src/components/inspector/ProjectDashboard.tsx`
- Modify: `src/components/inspector/WorkoutDashboard.tsx`
- Modify: `src/components/workouts/ExerciseDetail.tsx`
- Modify: `src/components/inspector/EntityActivity.tsx`
- Modify: `src/components/inspector/EntityRelationships.tsx`
- Modify: `src/components/inspector/inspector.css`

**Step 1: Split inline layout rules into shared structure**

Move the inspector’s repeated section headings, property groups, and status rows toward the primitive layer.

**Step 2: Make dashboards read as sections, not pages**

Keep `ProjectDashboard`, `WorkoutDashboard`, and `ExerciseDetail` as section modules, but make them use the same list/card hierarchy.

**Step 3: Reduce bespoke card styling**

Remove any inspector-only card treatment that does not need to be unique to the entity type.

**Step 4: Verify entity overlays**

Open representative entities from:
- Projects
- Workout templates
- Exercises

Expected: all inspector panels feel like one family.

**Step 5: Commit**

Commit the inspector cleanup separately so behavior review stays manageable.

---

### Task 5: Clean up page-level drift in the heavy screens

**Files:**
- Modify: `src/pages/Auth.tsx`
- Modify: `src/pages/TemplateBuilder.tsx`
- Modify: `src/pages/ActiveWorkout.tsx`
- Modify: `src/pages/Calendar.tsx`
- Modify: `src/pages/Profile.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Health.tsx`
- Modify: `src/pages/Projects.tsx`
- Modify: `src/pages/Today.tsx`
- Modify: `src/pages/Inbox.tsx`

**Step 1: Remove page-local spacing hacks**

Delete the inline margins, custom row widths, and one-off card paddings that are now redundant with the shared primitive layer.

**Step 2: Keep only page-specific layout**

Retain only layout that is truly unique to the screen, such as workout timelines, calendar grids, and auth flow steps.

**Step 3: Recheck typography hierarchy**

Make sure titles, subtitles, metadata, and trailing actions remain visually separate, especially on Health and Projects.

**Step 4: Verify on-device and desktop**

Check:
- `/home`
- `/health-search`
- `/projects`
- `/today`
- `/calendar`
- `/profile`
- `/settings`

**Step 5: Commit**

Make this a page-by-page polish commit, not a behavior rewrite.

---

### Task 6: Delete dead legacy modules

**Files:**
- Delete: `src/pages/Workouts.tsx`
- Delete: `src/pages/Habits.tsx`
- Delete: `src/components/medication/MedicationItem.tsx`
- Delete: `src/components/medication/MedicationConfirmModal.tsx`
- Delete: `src/components/workouts/WorkoutItem.tsx`
- Delete: `src/components/habits/HabitItem.tsx`
- Delete: `src/store/store.ts`
- Delete: `src/App.css`

**Step 1: Confirm no live imports remain**

Make sure nothing in the app imports these modules before deletion.

**Step 2: Remove the files**

Delete only the modules that are currently orphaned or redundant.

**Step 3: Re-run the app and build**

Verify the app still loads the routed screens and does not fail on missing imports.

**Step 4: Commit**

Use one cleanup commit for the dead code removal.

---

### Task 7: Final verification pass

**Files:**
- No code changes expected

**Step 1: Run the build**

Run: `npm run build`

Expected: build completes without errors.

**Step 2: Check core routes**

Open and confirm:
- `/auth`
- `/welcome`
- `/home`
- `/today`
- `/projects`
- `/health-search`
- `/inbox`
- `/calendar`
- `/profile`
- `/settings`

**Step 3: Check the major interactions**

Verify:
- open/close entity inspector
- open/close quick add
- create an entity
- toggle an action
- navigate to profile/settings

**Step 4: Capture screenshots**

Update the screenshot folder after the refactor so the next review pass has fresh references.

