# Daily Check-In Design

## Summary

Daily Check-In is a Home-first structured logging ritual with two entries per day: Morning Check-In and Evening Debrief. Its purpose is to capture state, intention, and reflection without changing the user's task system.

The feature may suggest priorities with clear reasons, but it never hides, reorders, edits, completes, archives, reschedules, suppresses, scores, or downgrades tasks or other app entities automatically. Future assistant features can use these logs as read-only context and offer explicit, reasoned suggestions, but every state-changing action must require user confirmation.

## Goals

- Make daily self-logging quick, structured, and low-pressure.
- Surface the ritual from Home through time-windowed prompts.
- Capture useful structured data for later review, trend analysis, and assistant context.
- Let the user declare morning priorities from suggestions, freeform entries, or both.
- Include a tucked-away history view in v1.
- Preserve user control over tasks, Today, Potential, Focus, habits, routines, and scoring.

## Non-Goals

- No conversational AI-guided check-in or debrief in v1.
- No notifications in v1.
- No automatic task mutation, task hiding, task reordering, scheduling changes, Potential changes, Domain scoring changes, Focus weighting changes, habit streak changes, routine session changes, or achievement creation.
- No trend charts or adaptive coaching in v1.
- No fully configurable questionnaire editor in v1.

## Product Behavior

Daily Check-In lives primarily on Home. It is not a recurring task and is not counted toward Today completion. Home shows a soft prompt based on local time and completion state:

- `5:00 AM - 12:00 PM`: show Morning Check-In if today's morning entry is missing.
- `12:00 PM - 5:00 PM`: if morning is missing, show a quieter catch-up action.
- `7:00 PM - 2:00 AM`: show Evening Debrief if today's evening entry is missing.
- If both entries are complete, the card shows a quiet "Today logged" state with access to history.

Today's morning and evening entries remain manually accessible and editable. Yesterday's entries are also editable to allow normal correction. Older entries are read-only by default.

## Entry Flow

Both entries open as calm, step-by-step full-screen flows, similar to onboarding. Each step has one plain-language prompt, large label/chip controls, optional freeform fields where needed, Back/Next navigation, and a final Review/Save step.

The tone is observational and non-judgmental. Avoid shame-coded wording such as "failed," "bad," "lazy," or "unproductive."

## Morning Check-In

### Step 1: Sleep

Prompt: "How was your night?"

Inputs:

- Sleep amount chips: `<4`, `4-6`, `6-8`, `8+`, `not sure`.
- Sleep quality chips: `rough`, `broken`, `okay`, `deep`, `overslept`.

### Step 2: Starting State

Prompt: "Where are you starting from?"

Inputs use human labels/chips, backed by stable value keys for future analysis:

- Energy: `drained`, `low`, `steady`, `charged`, `restless`.
- Mood: `heavy`, `flat`, `calm`, `good`, `bright`.
- Stress: `clear`, `mild`, `pressured`, `spiky`, `overloaded`.
- Focus readiness: `foggy`, `scattered`, `available`, `locked-in`, `avoidant`.

### Step 3: Intention

Prompt: "What kind of day are you trying to have?"

Inputs:

- Optional short freeform intention note.
- Intention chips can be added later, but are not required for v1.

### Step 4: Priorities

Prompt: "What matters today?"

Inputs:

- Suggested linked tasks with short reasons.
- Freeform priority rows stored only in the daily log.
- User can select roughly 1-3 priorities, but saving should not require any selection.

Selecting a linked task records intent for the daily log only. It does not change the task, move it, prioritize it globally, complete it, or hide anything else.

### Step 5: Review

Shows a concise summary of the selected answers and priorities before Save.

## Evening Debrief

### Step 1: Day Shape

Prompt: "How did today land?"

Inputs:

- Day shape chips: `survived`, `messy`, `steady`, `good`, `excellent`.
- Energy now: same labels as morning energy.
- Mood now: same labels as morning mood.
- Stress now: same labels as morning stress.

### Step 2: Priorities Review

If a morning entry exists, show the declared morning priorities.

For each priority, the user can choose a log-only outcome:

- `done`
- `partly`
- `carried`
- `dropped`

These outcomes are debrief metadata only. They do not mutate linked tasks. For linked tasks, the detail view can later offer explicit actions such as Open Task, Move to Tomorrow, or Mark Complete, but those actions are outside the core v1 save path.

### Step 3: Friction And Helped

Prompt: "What shaped the day?"

Inputs:

- Friction chips: `time`, `energy`, `stress`, `distraction`, `unclear priorities`, `other`.
- Helped chips: examples can include `routine`, `movement`, `rest`, `clear plan`, `support`, `environment`.

Both groups are multi-select.

### Step 4: Reflection

Prompt: "What should be remembered?"

Inputs:

- Optional win note.
- Optional carry-forward note.

### Step 5: Review

Shows a concise summary before Save.

## Priority Suggestions

Morning priority suggestions must be simple, explainable, and ignorable. Each suggested task row shows the task title and one short reason.

Initial reason set:

- Due today.
- Overdue.
- Scheduled in Today, Morning, or Evening.
- Linked to Current Focus or an active Mission, if available from existing app data.
- Recently carried forward from a previous debrief.

Suggestion ranking uses this order: overdue, due today, scheduled in Today/Morning/Evening, recently carried forward, then Focus/Mission relevance. Every suggestion must carry its displayed reason.

## History

V1 includes a tucked-away Daily Log history view, reachable from the Home card completed state and from Profile.

The history list is reverse-chronological and grouped by local date. Each day row shows compact summaries when available:

- Morning: sleep, energy, mood, stress/focus readiness, selected priorities count.
- Evening: day shape, energy/mood/stress now, priority outcomes, win/carry-forward indicators.

Tapping a day opens a detail view with morning and evening sections. Today and yesterday can be edited. Older days are read-only unless a later design explicitly adds retrospective editing.

## Data Model

Each local date can have at most one Morning Check-In and one Evening Debrief. The implementation can model this as either a new typed `items` row or a dedicated table, but the stored payload must be structured, not prose-only.

Required persistence properties:

- Stable phase: `morning` or `evening`.
- Local date key.
- Created and updated timestamps.
- Structured answers using stable value keys.
- User-facing labels preserved where useful for historical display.
- Optional freeform notes.
- Priority snapshots.

Priority snapshots preserve history even if tasks later change:

- Linked priorities store `taskId`, title snapshot, selected suggestion reason, and later debrief outcome.
- Freeform priorities store text and later debrief outcome.
- If a linked task is renamed, archived, completed, or deleted later, the historical daily log remains readable.

Saving a daily log must not call task status, schedule, scoring, Focus, habit, routine, or achievement mutation paths.

## Assistant Boundary

For v1, the assistant does not drive the check-in flow. Daily logs are created by the structured UI.

The design should keep future assistant context in mind. Later, the assistant can read recent daily logs and say things like:

- "You logged low sleep and high stress. Want help choosing a lighter plan?"
- "This priority has carried forward three times. Want to break it down?"
- "Your best days this week seem to correlate with movement and fewer declared priorities."

Every assistant suggestion must explain its reason. Every state-changing action must be explicit and user-confirmed.

## Edge Cases

- If the user skips a check-in, nothing breaks and no score is affected.
- If the evening debrief runs without a morning check-in, skip the priorities-review dependency and still allow the debrief.
- If a user starts before midnight and saves after midnight during the evening window, the entry attaches to the date assigned when the flow opened. During `12:00 AM - 2:00 AM`, opening Evening Debrief assigns the previous local date.
- If a task suggestion points to a task deleted before save, save the title snapshot as freeform-like history and omit the live link.
- If the device date changes while a flow is open, save against the date assigned when the flow started.

## Testing And Verification

Pure tests should cover:

- Time-window prompt selection, including the post-midnight evening window.
- Daily log metadata parsing and defaults.
- Priority suggestion reason selection/ranking.
- One morning and one evening entry per local date, if this logic is implemented in a testable utility.
- Priority snapshot behavior for linked and freeform priorities.

Manual verification should cover:

- Morning window prompt.
- Evening window prompt.
- Catch-up state.
- Saving and editing today.
- Editing yesterday.
- Older read-only history.
- Evening debrief without a morning entry.
- Linked task priority remains readable after task rename/delete.
- Dark mode.
- Small-screen step flow layout.
- Confirming that saving a check-in never changes task status, order, schedule, Potential, Focus, habits, routines, or achievements.
