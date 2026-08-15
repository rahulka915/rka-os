# Conversational Day Planning ("Plan My Day")

**Date:** 2026-08-16
**Scope:** Native mobile assistant (`assistant.ts`, `assistantTools.ts`, `AssistantOverlay.tsx`) and the shared `itemRelations` data model. Home/Tasks list rendering gets minimal additions. Web assistant unchanged (separate tool set, out of scope this pass).
**Builds on:** the existing agentic assistant + confirm-before-write loop (`935232cb` and later), `plan_for_today` (Home Today Buckets), and `set_task_priority`.

## Problem

The user wants to talk through an unstructured brain-dump of things to get done ("take photos for insta, clear phone apps, sort out tabs, organise wardrobe") and have the assistant turn it into an actual plan for today: asking follow-up questions per task (how important, roughly how long, does it break into steps, does it depend on another task first), then creating real, correctly-ordered Tasks the user sees in their normal Home/Today view afterward.

Today the assistant can create bare tasks and set priority/schedule/bucket, but has no concept of a task depending on another task, or a task breaking into subtasks — so it can't represent "sort wardrobe" as a checklist, or know "post to insta" has to wait until "take photos" is done.

## Goals

- Two new relations in `itemRelations`: `subtaskOf` (task → parent task) and `blockedBy` (task → the task it's waiting on).
- Assistant can, through natural conversation (no dedicated button — detected from the user talking through a list of things to do), gather per-task: priority, rough duration, sub-steps, and same-list dependencies.
- Assistant proposes one batch of tool calls that creates all tasks/subtasks, links dependencies, and schedules everything into today in a dependency-respecting, priority-aware order — each still individually confirmable via the existing pending-action flow.
- Assistant reads back the proposed order in chat before/alongside the confirmation cards, so the user can sanity-check the plan itself, not just the raw task list.
- Blocked tasks and subtasks are minimally visible afterward in Home/Tasks (not silently invisible relations).

## Non-goals

- No multi-blocker dependency graphs — `blockedBy` is single-select (one direct blocker), matching `itemRelations`' existing single-target-per-type constraint. Good enough for "do Y before X"; not a project-management DAG.
- No dedicated "Plan my day" screen, button, or quick-start chip — purely conversational, driven by system-prompt behavior.
- No automatic re-ordering when a blocker slips or a task is completed out of order — `blockedBy` is informational (badge + planning-time ordering), not an enforced gate stopping task completion.
- No time-budget fitting (e.g. "I only have 2 hours tonight, what fits") — duration is used for relative sequencing/batching only, not scheduling against a budget.
- Web assistant untouched this pass; the pattern is easy to port later.

## Design

### 1. Data model — two new `itemRelations` types

No schema change. `itemRelations` already stores arbitrary `(sourceId, relationType, targetId)` rows, single-select per type.

| relationType | source → target | meaning |
|---|---|---|
| `subtaskOf` | subtask task → parent task | subtask belongs to exactly one parent |
| `blockedBy` | task → the task it's waiting on | task has at most one direct blocker |

Both read via the existing `getRelation`/`getRelatedItems` primitives — no new DB functions needed.

### 2. Assistant tool changes (`assistantTools.ts`)

- `create_item`: add optional `durationMinutes` (number) — task's rough time estimate, written straight to the existing `durationMinutes` column.
- `link_items`: extend the `relationType` enum with `subtaskOf` and `blockedBy`. Preview strings: `"<title> is a subtask of <parent>"`, `"<title> is blocked by <blocker>"`.
- `plan_for_today`: add optional `order` (number) — a sequencing hint written to the same manual-order mechanism the bucket views already read (Home's within-bucket order). Omitted `order` behaves exactly as today (appended).

No new tool names — this reuses `create_item`, `link_items`, and `plan_for_today`, keeping the tool surface small and the confirmation-card preview logic centralized in `previewAssistantTool`.

### 3. System prompt — the planning flow (`assistant.ts`)

Add a new section to `SYSTEM_PROMPT_PREFIX` describing the flow (paraphrased, actual wording refined at implementation time):

> When the user starts listing multiple loose things they want to get done today (or explicitly asks to plan their day/evening), don't jump straight to tool calls. First go through the list conversationally, one thing at a time: confirm priority (high/medium/low/none — reuse the existing priority scale), ask a rough duration if it's not obvious, ask whether it has natural sub-steps, and ask whether it depends on anything else in the list being done first. Keep this brief and natural — skip questions where the answer is obvious from what the user already said (e.g. "clear phone apps" doesn't need a sub-step question). Once you have enough for the whole list, propose the full batch as tool calls: `create_item` for each top-level task (with `durationMinutes`), `create_item` + `link_items` (`subtaskOf`) for each sub-step, `link_items` (`blockedBy`) for named dependencies, and `plan_for_today` for every task with `bucket` and an `order` that respects dependencies first (a blocker's `order` must be lower than what it blocks) and then priority. Before the confirmation cards, summarize the resulting order in plain text (e.g. a numbered list) so the user can see the shape of the plan, not just individual actions.

This is prompt-only — no new control flow in `assistant.ts`'s request/response loop. The existing `resolveAssistantActions`/pending-card confirmation mechanism already handles an arbitrary batch of proposed calls.

### 4. Minimal UI additions (Home/Tasks lists)

- **Blocked badge:** a task with an unmet `blockedBy` target (target not `status: 'completed'`) shows a small badge, visually consistent with the existing blocker badge from the drag-reorder work (`useHapticReorder`/connector pattern) — same badge language, new trigger condition (relation-based instead of manual-reorder-based).
- **Subtask nesting:** tasks with a `subtaskOf` parent render indented directly under their parent in Tasks/Home list views, reusing the existing list-row component — no new row component, just conditional indent + parent-lookup for grouping/sort order.

No other screens change. No changes to `AssistantOverlay.tsx` beyond what's already in flight (the RiverStoneSurface/Sensei rework) — this feature is prompt + tool-schema + minimal list-rendering work.

## Testing

- Unit: `link_items` preview strings for `subtaskOf`/`blockedBy`; `plan_for_today` writes `order` correctly when provided vs. omitted (defaults to append, matching current behavior).
- Manual: run the flow end-to-end in the Sensei overlay with a multi-task brain-dump including at least one dependency and one multi-step task; confirm the resulting Home/Today view shows correct bucket placement, order, blocked badge (while blocker incomplete, gone once blocker completes), and subtask nesting.
