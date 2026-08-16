# Downtime Tasks (Interstitial Task Type)

**Date:** 2026-08-16
**Scope:** Native mobile only (`apps/mobile/`) — `src/db/database.ts`, `src/utils/actions.ts`, `assistantTools.ts`/`assistantToolExecutor.ts`/`assistant.ts`, a new Home section, and a task-detail toggle + log control. Web is out of scope for this pass (see "Web parity" below).
**Builds on:** the shipped Actions model (`logAction`/`getActions`/`getActionFeed`, `src/utils/actions.ts`'s `ActionDetails`) and the conversational day-planning flow (`docs/superpowers/plans/2026-08-16-conversational-day-planning.md`) — this spec exists because that flow surfaced a real gap: a task the user described as "something we can do in between other tasks, maybe 10 min slots at a time" has no representation in the app today.

## Problem

Today every Task is single-shot: it has one status lifecycle and gets marked done in one tap, whenever that happens. Some tasks don't work that way — they're chipped away at in short bursts whenever the user has a spare few minutes ("sort wardrobe", "clear phone apps"), with no fixed schedule and no single sitting where they get finished. The app has no way to represent this: `preferredTimeBucket: 'anytime'` only controls *what time of day* a task could happen, not *whether it's worked on in small increments over time*. There's also no persistent surface reminding the user these tasks exist, so a spare 10 minutes has nothing to prompt "you could chip away at X right now."

## Goals

- A Task can be marked as a **Downtime task** — no target, no remaining-time tracking, just a lightweight signal that it's the "do it in slots whenever you have a spare moment" kind of task.
- Logging a session against a Downtime task ("did 10 min just now") is a first-class, lightweight action, reusing the already-shipped Actions model rather than building a parallel logging mechanism.
- A small always-visible "Downtime" section on Home surfaces these tasks so they're one glance away whenever the user is idle.
- Completion stays exactly as it is today — the task's own tap-to-complete control, independent of how many sessions were logged. No auto-complete, no progress bar, no target.
- Sensei can tag a task as Downtime conversationally when the user describes it that way (as in the wardrobe example); a manual toggle on the task detail screen covers tagging/untagging any task by hand, for symmetry.

## Non-Goals

- Target/remaining-time tracking (e.g. "60 min total, 20 logged") — explicitly out of scope; this is the lightweight version.
- Auto-completing a task once "enough" sessions are logged.
- Calendar/Timeline placement or scheduling of Downtime tasks — they stay undated by nature.
- Web parity in this pass — see "Web parity" below.

## Data Model

No new tables. Two small additions:

1. **`metadata.interstitial: true`** on a Task item marks it as a Downtime task, set/read via the existing `updateItemMetadata`/`getItemWithMetadata` pattern already used for `plannedDate`, `preferredTimeBucket`, `durationMinutes`, etc. Removing the flag (set `false` or delete the key) un-marks it. This is the *only* new piece of state on the item itself.

2. **`ActionDetails` (`src/utils/actions.ts`) gains `taskId?: string`:**
   ```typescript
   export interface ActionDetails {
     title: string;
     kind: ActionKind;
     durationMinutes?: number;
     intensity?: ActionIntensity;
     why?: string;
     domainId?: string;
     pillarId?: string;
     skillId?: string;
     missionId?: string;
     taskId?: string; // NEW — the Downtime task this session's progress belongs to
     attributeContributions?: AttributeContributionConfig[];
   }
   ```
   A logged session is `logAction({ title, kind: 'general', taskId, durationMinutes })` — an ordinary Action, stored in `activityLogs` exactly like any other, just with `taskId` set. This is deliberately NOT a new log type or table: a Downtime session is a kind of Action, and showing up in the existing unified Actions feed (`getActionFeed`) alongside everything else the user does is a feature, not a leak.

3. **New query: `getActionsForTask(taskId: string): ActivityLog[]`** in `database.ts`, alongside the existing `getActions`. Filters `activityLogs` on `actionType = 'action'` and the row's `details.taskId === taskId` (same `LIKE`-on-JSON pattern already used by `getPlannedTodayItems` for `metadata.plannedDate`, or a parse-and-filter over `getActions()`'s result set if the row count stays small — implementation detail for the plan, not a design decision). Powers the session history shown on the task detail screen and is the only new read path this feature needs.

No schema migration, no new indexes — `activityLogs` already exists and is already queried this way for every other Action.

## Logging a Session

Task detail screen (`apps/mobile/src/screens` — the existing task detail view) gains a small "Log a bit of progress" control, shown only when `metadata.interstitial === true`:
- A duration input (defaults to empty/optional, matching `LogActionSheet`'s existing duration field) and an optional short note.
- Submitting calls `logAction({ title: item.title, kind: 'general', taskId: item.id, durationMinutes, why: note })` — reusing `LogActionSheet`'s existing form shape and validation, not a new sheet component from scratch.
- Below the control, the task's own session history (via `getActionsForTask`) renders as a simple reverse-chronological list — "10 min · 2 hours ago", etc. No progress bar, no total.

This is the only new logging surface; the assistant can also log a session by calling the existing `log_action` tool with the new `taskId` field once it's added to that tool's schema (see "Assistant integration" below) — no new tool needed for logging itself, only for tagging.

## Completion

Unchanged. The task's existing tap-to-complete control (disc/checkbox, wherever it's shown — Today, Tasks, Anytime) works exactly as it does for every other task, regardless of `metadata.interstitial` or how many sessions have been logged. A Downtime task is never auto-completed by this feature.

## Home Surfacing — "Downtime" Section

A new, small, always-visible section on Home (native `HomeScreen.tsx`), separate from the Today card:
- Query: active tasks (`status` not `completed`/`inbox`) with `metadata.interstitial === true`.
- Sort: most-recently-logged-session first (via `getActionsForTask`), falling back to most-recently-created for tasks with no sessions yet, so a task the user is actively chipping away at stays near the top.
- Cap: a handful of rows (e.g. 3-5, exact number left to implementation) — this is a glanceable nudge, not a full list; a "See all" affordance can open the full Tasks list filtered to Downtime tasks if the capped view isn't enough, but that filtered view itself is not required for v1.
- Empty state: the section renders nothing at all when there are no Downtime tasks — consistent with how other optional Home sections already behave (e.g. the Plan Backwards countdown widget renders nothing with no upcoming plan).
- Each row: title + a one-line "last logged" hint if it has session history; tapping opens the task detail screen (where the log control lives).

This section does not replace or reorder Today — it's an additional, independent block on Home.

## Assistant Integration

- **`create_item`** (`assistantTools.ts`) gains an optional `interstitial: boolean` arg (task-only, same pattern as `durationMinutes`). The executor (`assistantToolExecutor.ts`) sets `metadata.interstitial = true` on creation when `args.type === 'task' && args.interstitial === true`, mirroring the existing `durationMinutes` branch added in the day-planning feature.
- **`log_action`**'s existing schema gains an optional `taskId: string` arg (the executor already resolves ids from the assistant's read-only data snapshot the same way every other tool does — no new resolution mechanism needed).
- The day-planning system prompt section (`assistant.ts`, "PLANNING A DAY/EVENING") gains one line: when the user describes a task as something done in short slots/whenever they have downtime (matching language like "in between other tasks", "whenever I have a sec", "little bits at a time"), set `interstitial: true` on that `create_item` call instead of (or alongside) a `durationMinutes` estimate — the wardrobe example from the live conversation is the reference case.
- A task can also be manually tagged after creation via `update_item`-style tooling if useful later, but this is not required for v1 since the manual toggle (below) already covers that case.

## Manual Tagging

Task detail screen (edit mode) gets a simple toggle — "Downtime task" — next to or near the existing metadata fields (priority, schedule, etc.), calling `updateItemMetadata(id, { ...meta, interstitial: true | undefined })`. Works on any task, tagged by the assistant or not, and can be un-toggled at any time (e.g. once the user decides a task actually needs a real schedule instead).

## Web Parity

Not built this pass — native-only, same as the day-planning feature this spec follows on from. `WEB_PARITY.md` should log this as a tracked native-only gap in the same pass this ships, per the repo's parity rule, rather than silently diverging.

## Testing

- `getActionsForTask` and any new pure filtering/sorting helper (e.g. "most-recently-logged-first" ordering for the Home section) should get unit tests, following the existing pattern for `src/utils/actions.ts`'s pure functions (`buildActionFeed` already has tests to mirror).
- `assistantTools.ts`'s preview text for `create_item` with `interstitial: true` and for `log_action` with a `taskId` should get preview-string tests, same pattern as the day-planning feature's `durationMinutes`/`dependsOn`/`subtaskOf` tests.
- Home's Downtime section and the task-detail log control are RN UI with no test harness in this codebase (consistent with every other screen) — manual on-device verification is the bar, same as the day-planning feature.
