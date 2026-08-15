# Agentic CRUD for the Web Assistant

**Date:** 2026-08-15
**Scope:** Desktop web app only (`apps/mobile/src/webApp/`, `database.web.ts`). Native iOS assistant is unchanged — it stays read-only.

## Problem

The assistant embedded in the app (`apps/mobile/src/services/ai/assistant.ts`, Gemini via Firebase AI Logic) is read-only today — its system prompt explicitly tells the model it "cannot add, edit, or delete anything." `database.web.ts` already has full CRUD (`createItem`, `updateItem`, `updateItemStatus`, `deleteItem`, `logHabitSample`, `logMedicationTaken`, `logAction`, `planForToday`, etc.) — the gap is entirely in the assistant layer, which passes no `tools` to the model and has no execution loop.

No agentic/tool-calling infrastructure exists anywhere in the repo today. This is greenfield.

## Goals

- The assistant can create, update, complete/reopen, and delete items, and log habit samples / medication doses / actions, driven by natural-language requests ("I need to buy milk tomorrow", "mark the tax return done", "log that I took my vitamin D") — no special command syntax required.
- Every write requires explicit user confirmation before it touches the database — no silent auto-apply, even for simple creates.
- Native's assistant (`assistant.ts`) is untouched and stays read-only; this is a web-only capability, split via Metro's existing `.web.ts` platform-extension convention (same pattern as `database.ts`/`database.web.ts`).
- Multi-step natural-language requests ("create a task for slides and one for the agenda, both due Friday") should resolve to multiple chained function calls, each surfaced as its own confirmation.

## Non-goals (this pass)

- No `find_item`/semantic search tool. With the current small dataset size, the model resolves references directly against the existing read-only context snapshot (all non-deleted items, JSON, notes truncated to 200 chars) well enough. Revisit if/when dataset growth makes title collisions a real problem — the tool-declaration pattern below makes adding one later a small, additive change.
- No native (iOS) agentic capability in this pass — SQLite context-building differs from the Firestore-backed web path and is separate follow-up work.
- No undo/rollback mechanism — confirm-before-execute means a bad or hallucinated call is caught before it touches data, so there's nothing to roll back.

## Design

### 1. Tool definitions — `apps/mobile/src/services/ai/assistantTools.ts`

A curated set of Gemini `FunctionDeclaration`s, each wrapping one `database.web.ts` call — not all ~90 exports, just the actionable subset:

| Function | Wraps | Notes |
|---|---|---|
| `create_item` | `createItem(type, title, status, scheduledDate?, notes?)` | plus `dueDate?`/`priority?` via follow-up `setTaskPriority`/`updateItem` calls as needed |
| `update_item` | `updateItem` | title/notes/scheduledDate/dueDate/priority patch |
| `set_item_status` | `updateItemStatus` | covers complete/reopen/cancel |
| `delete_item` | `deleteItem` | soft delete (`deletedAt`) — preview copy says so explicitly |
| `log_habit_sample` | `logHabitSample` | count/duration habits |
| `toggle_habit_occurrence` | `toggleHabitOccurrence` | binary habits |
| `log_medication_taken` | `logMedicationTaken` | |
| `log_action` | `logAction` | title/kind/durationMinutes/etc. |
| `plan_for_today` | `planForToday` | itemId + optional bucket |

Each entry in the module pairs: the Gemini JSON-schema declaration, an executor `(args) => void` calling the real `database.web.ts` function, and a `preview(args) => string` human-readable description used for the confirmation card (e.g. `Create task "Buy milk", due tomorrow`).

### 2. Agentic loop — `apps/mobile/src/services/ai/assistant.web.ts`

Metro resolves this over `assistant.ts` automatically for web builds, exactly like `database.web.ts` today — no import-site changes needed, no risk to native.

Because every write needs confirmation, this can't be a single request/response — it's a small state machine:

- `askAssistant(question, history)` sends the message with `tools` attached (Firebase AI Logic's `getGenerativeModel` accepts `tools: [{ functionDeclarations }]`). History is kept as raw Gemini `Content[]` (not flattened text), since function-calling requires `functionCall`/`functionResponse` parts to round-trip.
- If the model's response is plain text, return `{ kind: 'text', text }` as today.
- If the model returns one or more function calls, return `{ kind: 'pending', calls: PendingCall[], history }` — nothing executes yet.
- `resolveAssistantActions(history, decisions: Array<{call, confirmed: boolean}>)`:
  - For each confirmed call: run the executor, capture success/error, build a `functionResponse` part with the result.
  - For each declined call: build a `functionResponse` part `{ cancelled: true }` so the model can acknowledge rather than retry.
  - Sends the updated history back to the model. If it chains another function call, the UI shows another round of pending cards (loop continues); once it returns plain text, that's the final answer for this turn.

### 3. UI — `AssistantOverlay.tsx` (shared file, extended not forked)

Native keeps returning plain strings from `assistant.ts`, so its behavior in this same component is unchanged. New behavior only activates when `askAssistant` returns a `pending` result (which only happens on web):

- A new turn type renders each pending call as a card: preview text + Confirm/Cancel buttons.
- Confirming/declining calls `resolveAssistantActions` and appends the follow-up model turn (text or more pending cards).
- Executed actions leave a small "✓ Created task 'Buy milk'" confirmation bubble in the transcript.
- Empty-state copy drops the "can't change anything yet" line (web only, via the same platform-resolution — either a small inline `Platform.OS` check or by having `hasAssistant`/a new `assistantCanWrite` flag come from the platform-specific module).

### 4. Safety

- Nothing writes to the database without an explicit user Confirm tap — this is the core guarantee, enforced structurally (executor only runs from the confirm handler, never from the model-response handler).
- `delete_item`'s preview always names the actual item being deleted and states it's reversible (soft delete), so a confirm is an informed one.
- If Firebase/Gemini isn't configured (`hasAssistant === false`), the whole feature is disabled exactly as today — no behavior change to that gate.

## Testing

- Unit-testable pieces: `assistantTools.ts`'s `preview()` functions (pure), and the pending/resolve state machine's branching logic (mock the Gemini SDK response shape).
- Manual/browser verification: run the web app, exercise a create, an update, a completion, and a decline, confirming DB state matches and declined actions don't write anything.
