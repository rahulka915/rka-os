# Item Composer Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Replace the all-in-one Quick Add screen with a reliable instant-capture sheet and native full item editor backed by one shared controller.

**Architecture:** A provider owns a single `ItemDraft` and exposes capture/edit entry points through context. `CaptureSheet` remains compact and keyboard-first; `ItemEditorSheet` uses a bounded native iOS form sheet with fixed actions and a scrollable body. Only the controller writes to SQLite, so dismissal, validation, metadata merging, and duplicate-save protection remain consistent everywhere.

**Tech Stack:** React Native, Expo, TypeScript, React Context, React Native Modal, SQLite database helpers, Expo Haptics.

---

### Task 1: Add the shared item-composer model and persistence boundary

**Files:**
- Create: `apps/mobile/src/components/item-composer/types.ts`
- Create: `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`
- Modify: `apps/mobile/src/db/database.ts`

**Steps:**

1. Define `ItemDraft`, `ItemComposerContext`, and create/edit request types.
2. Add helpers that construct a draft once from contextual defaults or an existing item.
3. Add a database helper that updates item schedule, metadata, project relation, and the applicable instance coherently.
4. Add create, update, and delete commands that preserve unrelated metadata keys.
5. Guard persistence commands against missing titles or invalid schedules.

### Task 2: Build the instant capture sheet

**Files:**
- Create: `apps/mobile/src/components/item-composer/CaptureSheet.tsx`

**Steps:**

1. Reuse the proven compact `BottomSheet` structure from `QuickCreateSheet`.
2. Render a read-only context summary, title, optional one-line note, Details, Cancel, and Save.
3. Focus the title once after opening.
4. Make Return and Save emit the same save intent.
5. Make every dismissal path emit cancel; never persist from dismissal.
6. Disable Save while empty or busy.

### Task 3: Build the full native item editor

**Files:**
- Create: `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`

**Steps:**

1. Use a native `formSheet` Modal with one bounded `KeyboardAvoidingView`.
2. Keep Cancel and Save fixed while the form body scrolls.
3. Add Task, When, and Organise sections for title, notes, schedule, project, tags, and priority.
4. Use inline native date/time controls rather than modal-over-sheet pickers.
5. Keep project and tags within the same presentation using internal editor views.
6. Show a confirmation-gated Delete action only in edit mode.
7. Preserve the draft and show an error if persistence fails.

### Task 4: Add the composer provider and host

**Files:**
- Create: `apps/mobile/src/components/item-composer/ItemComposerProvider.tsx`
- Create: `apps/mobile/src/components/item-composer/index.ts`

**Steps:**

1. Expose `openCapture`, `openEditorForCreate`, and `openEditorForItem` through context.
2. Own the active draft, presentation state, busy state, and completion callbacks.
3. Transition Capture to Editor only after keyboard dismissal and capture closure.
4. Prevent duplicate save operations.
5. Trigger success haptics only after persistence succeeds.
6. Render only one presentation at a time.

### Task 5: Migrate existing create and Calendar edit entry points

**Files:**
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`

**Steps:**

1. Wrap navigation and global overlays in `ItemComposerProvider`.
2. Route the global FAB to `openCapture` with route-derived context.
3. Route Inbox capture to the provider.
4. Route Calendar creation to Capture with scheduled context.
5. Route Calendar editing directly to the full editor with a locked date and 15-minute interval.
6. Refresh each screen only after successful persistence.

### Task 6: Add shared edit entry points to task surfaces

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/TasksScreen.tsx`
- Modify: `apps/mobile/src/screens/ProjectDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`

**Steps:**

1. Add an Edit action to existing task context menus or row interactions.
2. Open the same `ItemEditorSheet` for every item.
3. Supply the appropriate refresh callback.
4. Preserve existing complete, move, archive, and delete actions.

### Task 7: Remove the superseded all-in-one composer

**Files:**
- Delete: `apps/mobile/src/screens/QuickAddScreen.tsx`
- Delete if unused: `apps/mobile/src/utils/quickAddDraft.ts`
- Modify imports throughout `apps/mobile/`

**Steps:**

1. Confirm no runtime imports reference `QuickAddScreen`.
2. Remove the old screen and background draft-autosave utility.
3. Remove obsolete state and callbacks from consumers.
4. Confirm generic task creation and editing have one controller.

### Task 8: Static verification and phone handoff

**Files:**
- Modify only files required to resolve static errors.

**Steps:**

1. Run `npm run typecheck` from `apps/mobile`; expect a clean TypeScript result.
2. Run `git diff --check`; expect no whitespace errors in touched files.
3. Confirm Metro remains available on port 8082.
4. Provide a physical-iPhone checklist covering Capture Save, Return, Details, Cancel, dismissal, Calendar edit, metadata, project context, and Delete.

No simulator or automated UI testing is included because physical-device verification is owned by the user for this change.
