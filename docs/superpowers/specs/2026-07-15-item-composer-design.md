# RKA OS Item Composer Design

**Date:** 2026-07-15
**Status:** Approved for implementation planning

## Summary

Replace the current all-in-one `QuickAddScreen` with a two-stage item composer:

1. `CaptureSheet` for immediate task capture.
2. `ItemEditorSheet` for complete task creation and editing.

Both presentations share one in-memory `ItemDraft` managed by an `ItemComposerController`. The compact capture experience remains fast, while detailed metadata, scheduling, editing, and deletion move into a bounded native iOS form sheet patterned after the reliable medication form.

The system must have one state lifecycle, one presentation owner at a time, one keyboard owner at a time, and explicit persistence semantics.

## Goals

- Preserve instant task capture from the global FAB.
- Make Return or Save create one task and close immediately.
- Provide a reliable full editor for title, notes, scheduling, project, tags, and priority.
- Use the same editor for creating detailed tasks and editing existing tasks.
- Ensure Calendar, Inbox, Home, Tasks, and Project Detail use the same item-composer controller.
- Eliminate silent saves and ambiguous dismissal behavior.
- Avoid nested modal-over-sheet presentation and keyboard conflicts.
- Preserve contextual defaults such as Inbox status, active status, project assignment, and Calendar date/time.
- Keep user input intact when validation or persistence fails.

## Non-goals

- Redesigning the medication form.
- Folding medication-specific fields into the generic task editor.
- Replacing `QuickCreateSheet` for Areas, Projects, or Workout templates in this change.
- Adding new task metadata beyond the fields already supported.
- Changing database schema or task scheduling semantics.
- Redesigning the app-wide visual language.

## Chosen Architecture

### `ItemComposerController`

The controller owns the draft, presentation state, contextual defaults, validation, and database commands. Presentation components never write directly to the database.

The controller supports these entry points:

- `openCapture(context)` for new tasks from the FAB or Inbox.
- `openEditorForCreate(context)` when a screen needs detailed creation immediately.
- `openEditorForItem(item, context)` for editing an existing item.

The controller supports these presentation states:

```ts
type ItemComposerPresentation =
  | { kind: 'closed' }
  | { kind: 'capture'; draft: ItemDraft }
  | { kind: 'editor'; draft: ItemDraft };
```

Only one presentation may be active at a time.

### `ItemDraft`

```ts
type ItemDraft = {
  mode: 'create' | 'edit';
  itemId?: string;
  title: string;
  notes: string;
  status: 'inbox' | 'active' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
  projectId?: string;
  projectTitle?: string;
  tags: string[];
  priority?: 'low' | 'medium' | 'high';
};
```

Contextual defaults are applied once when the draft is created. They are not repeatedly re-applied by effects while the form is open.

### `CaptureSheet`

`CaptureSheet` is a compact, top-anchored sheet based on the reliable `QuickCreateSheet` pattern.

It contains:

- A concise, read-only context summary when context exists.
- An autofocus title field.
- An optional single-line note.
- Cancel and Save actions.
- A Details action.

It does not contain:

- Tags or priority controls.
- Date or time pickers.
- Project selectors.
- Delete actions.
- Nested modals.
- Background draft restoration.
- Direct database operations.

#### Capture behavior

- Return and Save both request one create operation and close after success.
- Details transfers the same unsaved draft into `ItemEditorSheet` without creating a database item.
- Cancel, backdrop dismissal, and swipe dismissal discard the draft.
- Dismissal never silently saves.
- Save is disabled while empty or while a save is already in progress.

### `ItemEditorSheet`

`ItemEditorSheet` uses a native iOS `formSheet` presentation and the stable layout pattern used by the medication form:

- One native presentation owner.
- One bounded `KeyboardAvoidingView`.
- A scrollable form body.
- Fixed Cancel and Save actions outside the scrolling body.
- No modal stacked over the editor.

The form contains these sections:

#### Task

- Title.
- Multiline notes.

#### When

- Anytime or scheduled state.
- Date.
- Time.
- Calendar-provided blocks remain locked to their selected date unless the calling context explicitly permits changing it.
- Calendar time changes snap to 15-minute intervals.

#### Organise

- Project assignment.
- Tags.
- Priority.

Project and tag selection navigate within the same form-sheet presentation rather than opening another modal over it. Date and time use inline native controls inside the editor.

#### Actions

- Delete is shown only in edit mode.
- Delete requires destructive confirmation.
- Create mode never shows Delete.

## Presentation Transitions

### Capture to editor

1. User selects Details.
2. The capture title field resigns focus.
3. The keyboard dismissal completes.
4. `CaptureSheet` closes.
5. `ItemEditorSheet` opens using the same draft object.

The app must never display both presentations simultaneously.

### Save

1. The presentation emits a save intent.
2. The controller marks the draft as saving and ignores additional save intents.
3. The controller validates and persists the draft.
4. On success, the controller triggers success haptics, refreshes affected queries, and closes.
5. On failure, the form remains open with all entered values intact and displays an actionable error.

### Cancel and dismissal

Cancel, backdrop dismissal, swipe dismissal, and the native close gesture all have the same meaning: discard unsaved changes and close.

Editing does not autosave. Creation does not autosave. Backgrounding the application does not create an item.

## Context Handling

The controller applies defaults at draft construction time:

- Global FAB: Inbox task by default.
- Tasks screen: active task.
- Project Detail: active task assigned to the current project.
- Inbox: Inbox task.
- Calendar: scheduled task using the selected date and snapped time.

The capture sheet displays context as a summary rather than exposing editing controls. Details opens the editor where applicable context can be changed.

## Persistence Rules

- `CaptureSheet` and `ItemEditorSheet` are controlled views of `ItemDraft`.
- Only `ItemComposerController` invokes `createItem`, `createTimedItem`, `updateItem`, metadata updates, relations, or deletion.
- A save guard prevents duplicate writes from rapid taps or repeated Return events.
- Metadata updates merge with existing metadata and preserve unrelated keys.
- Editing an item updates the existing record rather than creating a replacement.
- Calendar time changes update both item metadata and the applicable item instance.
- Query refresh callbacks run only after successful persistence.

## Validation and Error Handling

- Title is required.
- Scheduled items require a valid date and time.
- Calendar times are normalised and snapped before persistence.
- Invalid fields remain visible and receive an inline explanation.
- Database failures keep the form open and preserve the draft.
- Save controls show a non-blocking saving state and reject duplicate activation.
- Delete failures leave the editor open and preserve the item.
- Success haptics occur only after persistence succeeds.

## Haptics and Motion

- Light impact on Details and Cancel.
- Success notification after a successful create or update.
- Warning notification after confirmed deletion succeeds.
- Capture uses the existing restrained sheet motion.
- Editor uses the native iOS form-sheet transition.
- Reduce Motion removes custom positional motion while retaining state-supporting fades.
- Keyboard-triggered submission adds no decorative delay.

## Accessibility

- All actions maintain a minimum 44×44 point touch target.
- Inputs have explicit accessibility labels and appropriate keyboard types.
- Save exposes disabled and busy states.
- Context summaries are announced as a single understandable sentence.
- Error messages are associated with their fields and announced when presented.
- Destructive confirmation clearly names the item being deleted.
- Dynamic Type must not hide Save or Cancel; the fixed action area must expand when necessary.

## Integration

- The root FAB opens `CaptureSheet` through the controller.
- Inbox uses the same capture entry point.
- Calendar creation opens Capture with scheduled context; Calendar editing opens `ItemEditorSheet` directly.
- Task rows in Home, Inbox, Tasks, and Project Detail should expose the same edit entry point rather than introducing local editors.
- Existing context-specific refresh callbacks are routed through controller completion events.
- The current `QuickAddScreen` is removed after all integrations use the controller.

## Testing

### Unit tests

- Context produces the expected initial draft.
- Capture Save and Return create exactly one item.
- Save guard blocks duplicate writes.
- Details preserves title, note, and context without creating an item.
- Cancel and all dismissal paths perform no write.
- Metadata merges preserve unrelated keys.
- Calendar times snap to 15 minutes.
- Editing updates the original item.
- Delete requires confirmation and removes only the selected item.
- Persistence failure retains the draft and presentation state.

### Component tests

- Capture focuses the title after mounting.
- Capture remains usable with the keyboard visible.
- Fixed editor actions remain reachable with long content and Dynamic Type.
- Details waits for keyboard dismissal before presenting the editor.
- Project and tag selection remain inside the editor presentation.
- Create mode omits Delete; edit mode exposes it.

### Device verification

- Test on the physical iPhone used for development.
- Verify FAB capture from Home, Tasks, Project Detail, Inbox, and Calendar.
- Verify Calendar create and edit flows.
- Verify Save, Return, Details, Cancel, swipe dismissal, and native dismissal.
- Verify rapid repeated Save taps.
- Verify light and dark modes, Reduce Motion, and larger text sizes.
- Verify no keyboard overlap, clipped content, stacked modal, or stale input after reopening.

## Migration Sequence

1. Introduce `ItemDraft` and `ItemComposerController` with persistence tests.
2. Build `CaptureSheet` using the proven `QuickCreateSheet` interaction pattern.
3. Build `ItemEditorSheet` using the proven medication form-sheet layout pattern.
4. Migrate the global FAB and Inbox capture entry points.
5. Migrate Calendar create and edit entry points.
6. Add shared edit entry points to Home, Tasks, and Project Detail.
7. Remove `QuickAddScreen` and its draft-autosave behavior.
8. Complete physical-device regression testing.

## Success Criteria

- Instant capture remains as fast as the existing compact experience.
- Detailed editing behaves as reliably as the medication form.
- No dismissal path silently creates or updates an item.
- No form stacks a picker modal over another animated sheet.
- All task create and edit entry points share the same controller and draft model.
- Keyboard appearance, scrolling, dismissal, and reopening are deterministic on the physical iPhone.
