# Agentic CRUD for the Web Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the web app's AI assistant (Gemini via Firebase AI Logic) perform create/update/complete/delete actions on the user's data, driven by natural language, with every write gated behind an explicit user confirmation.

**Architecture:** A new tool-declaration module (`assistantTools.ts`) wraps a curated subset of `database.web.ts`'s existing CRUD functions as Gemini `FunctionDeclaration`s, each paired with an executor and a human-readable preview string. A new web-only assistant module (`assistant.web.ts`, resolved by Metro's platform-extension convention over `assistant.ts` — same pattern as `database.web.ts` over `database.ts`) passes these tools to the model and implements a confirm-then-execute loop using raw Gemini `Content[]` history (so `functionCall`/`functionResponse` parts round-trip correctly). `AssistantOverlay.tsx` (shared by both platforms) is extended to render pending-action confirmation cards — a no-op on native, since native's `assistant.ts` never produces them.

**Tech Stack:** React Native + Expo (web target), Firebase AI Logic (`firebase/ai`, Gemini `gemini-flash-latest`), TypeScript, Node's built-in test runner (`node --test`).

## Global Constraints

- Native iOS assistant (`apps/mobile/src/services/ai/assistant.ts`) must not change behavior — stays read-only. (Design §goals)
- Every write action requires explicit user confirmation before touching the database — no silent auto-apply. (Design §goals, §3)
- Web-only: implemented via `assistant.web.ts` Metro platform-resolution, not a `Platform.OS` branch inside a shared file. (Design §1 decision)
- No `find_item`/semantic search tool in this pass — reference resolution relies on the existing full-context snapshot already in the system prompt. (Design §Non-goals)
- No undo/rollback mechanism needed — confirm-before-execute is the safety net. (Design §Non-goals)
- `delete_item` previews must name the actual item and state it's a soft delete (reversible via `deletedAt`). (Design §4)
- `apps/mobile/CLAUDE.md` must be updated in the same pass per the repo's multi-agent documentation rule (any change to backend services / components must be documented immediately).

---

## File Structure

- **Create** `apps/mobile/src/services/ai/assistantTools.ts` — tool schemas, executors, preview generators. Pure-ish (executors call `database.web.ts`, but the schema/preview logic is unit-testable in isolation).
- **Create** `apps/mobile/src/services/ai/assistantTools.test.ts` — unit tests for the preview generators.
- **Create** `apps/mobile/src/services/ai/assistant.web.ts` — web-only agentic `askAssistant`/`resolveAssistantActions`, resolved over `assistant.ts` by Metro on web builds.
- **Modify** `apps/mobile/src/components/assistant/AssistantOverlay.tsx` — render pending-action cards, wire confirm/decline to `resolveAssistantActions`.
- **Modify** `apps/mobile/CLAUDE.md` — document the shipped feature (multi-agent rule).

No changes to `apps/mobile/src/services/ai/assistant.ts` (native) or `apps/mobile/src/db/database.web.ts` (already has every CRUD function needed).

---

### Task 1: Tool declarations + executors + previews

**Files:**
- Create: `apps/mobile/src/services/ai/assistantTools.ts`
- Test: `apps/mobile/src/services/ai/assistantTools.test.ts`

**Interfaces:**
- Consumes: `database.web.ts` exports — `createItem(type, title, status?, scheduledDate?, notes?)`, `updateItem(id, updates)`, `updateItemStatus(id, status)`, `deleteItem(id)`, `setTaskPriority(id, priority)`, `logHabitSample(habitId, value, note?)`, `toggleHabitOccurrence(itemId, date)`, `logMedicationTaken(itemId)`, `logAction(input: LogActionInput)`, `planForToday(itemId, bucket?)`, `getItemWithMetadata(id)` (all from `../../db/database.web.ts`); `Item['type']`/`Item['status']` from `../../db/types.ts`; `LogActionInput` from `../../utils/actions.ts`.
- Produces: `ASSISTANT_TOOL_DECLARATIONS: FunctionDeclarationsTool[]` (Firebase AI Logic's `tools` param shape — an array with one `{ functionDeclarations: FunctionDeclaration[] }` entry), `AssistantToolName` union type, `executeAssistantTool(name: AssistantToolName, args: Record<string, any>): { ok: true; result: string } | { ok: false; error: string }`, `previewAssistantTool(name: AssistantToolName, args: Record<string, any>): string`. These three are what Task 3 (`assistant.web.ts`) and Task 4 (`AssistantOverlay.tsx`) consume.

- [ ] **Step 1: Write the failing tests for preview generators**

```typescript
// apps/mobile/src/services/ai/assistantTools.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewAssistantTool } from './assistantTools.ts';

test('previews create_item with a scheduled date', () => {
  const preview = previewAssistantTool('create_item', {
    type: 'task',
    title: 'Buy milk',
    scheduledDate: '2026-08-16',
  });
  assert.equal(preview, 'Create task "Buy milk", scheduled 2026-08-16');
});

test('previews create_item with no scheduled date', () => {
  const preview = previewAssistantTool('create_item', { type: 'task', title: 'Buy milk' });
  assert.equal(preview, 'Create task "Buy milk"');
});

test('previews update_item with multiple fields', () => {
  const preview = previewAssistantTool('update_item', {
    id: 'abc123',
    title: 'Buy oat milk',
    dueDate: '2026-08-20',
  });
  assert.equal(preview, 'Update item: title → "Buy oat milk", due date → 2026-08-20');
});

test('previews set_item_status as completion', () => {
  const preview = previewAssistantTool('set_item_status', { id: 'abc123', status: 'completed' });
  assert.equal(preview, 'Mark item as completed');
});

test('previews delete_item as a reversible soft delete', () => {
  const preview = previewAssistantTool('delete_item', { id: 'abc123', title: 'Old draft' });
  assert.equal(preview, 'Delete "Old draft" (reversible — moves to trash, not permanently erased)');
});

test('previews log_habit_sample', () => {
  const preview = previewAssistantTool('log_habit_sample', {
    habitId: 'h1',
    habitTitle: 'Drink water',
    value: 2,
  });
  assert.equal(preview, 'Log 2 for "Drink water"');
});

test('previews toggle_habit_occurrence', () => {
  const preview = previewAssistantTool('toggle_habit_occurrence', {
    itemId: 'h1',
    habitTitle: 'Meditate',
    date: '2026-08-15',
  });
  assert.equal(preview, 'Mark "Meditate" done for 2026-08-15');
});

test('previews log_medication_taken', () => {
  const preview = previewAssistantTool('log_medication_taken', {
    itemId: 'm1',
    medicationTitle: 'Vitamin D',
  });
  assert.equal(preview, 'Log a dose of "Vitamin D" taken now');
});

test('previews log_action with duration', () => {
  const preview = previewAssistantTool('log_action', {
    title: 'Run',
    kind: 'practice',
    durationMinutes: 20,
  });
  assert.equal(preview, 'Log action "Run" (practice, 20 min)');
});

test('previews log_action without duration', () => {
  const preview = previewAssistantTool('log_action', { title: 'Read', kind: 'general' });
  assert.equal(preview, 'Log action "Read" (general)');
});

test('previews plan_for_today', () => {
  const preview = previewAssistantTool('plan_for_today', {
    itemId: 't1',
    itemTitle: 'Call the bank',
    bucket: 'morning',
  });
  assert.equal(preview, 'Add "Call the bank" to Today (morning)');
});

test('previews plan_for_today with no bucket', () => {
  const preview = previewAssistantTool('plan_for_today', { itemId: 't1', itemTitle: 'Call the bank' });
  assert.equal(preview, 'Add "Call the bank" to Today');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `assistantTools.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the tool declarations, executors, and preview generators**

```typescript
// apps/mobile/src/services/ai/assistantTools.ts
//
// Curated agentic surface for the web assistant: each entry pairs a Gemini
// function-calling schema with a real database.web.ts executor and a
// human-readable preview shown in the confirmation card BEFORE the executor
// ever runs. The model only ever proposes a call — AssistantOverlay decides
// whether it actually happens.
import {
  createItem,
  updateItem,
  updateItemStatus,
  deleteItem,
  setTaskPriority,
  logHabitSample,
  toggleHabitOccurrence,
  logMedicationTaken,
  logAction,
  planForToday,
  getItemWithMetadata,
} from '../../db/database.web';
import type { Item } from '../../db/types';
import type { ActionKind, ActionIntensity } from '../../utils/actions';

export type AssistantToolName =
  | 'create_item'
  | 'update_item'
  | 'set_item_status'
  | 'set_task_priority'
  | 'delete_item'
  | 'log_habit_sample'
  | 'toggle_habit_occurrence'
  | 'log_medication_taken'
  | 'log_action'
  | 'plan_for_today';

// Firebase AI Logic's function-declaration schema shape (JSON Schema subset).
interface AssistantFunctionParamSchema {
  type: string;
  description?: string;
  enum?: string[];
}

interface AssistantFunctionDeclaration {
  name: AssistantToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AssistantFunctionParamSchema>;
    required?: string[];
  };
}

const ITEM_TYPES: Item['type'][] = [
  'area', 'project', 'task', 'habit', 'medication', 'supplement', 'object',
];

const ITEM_STATUSES: Item['status'][] = [
  'inbox', 'active', 'someday', 'scheduled', 'completed', 'skipped', 'archived', 'cancelled',
];

const ASSISTANT_FUNCTION_DECLARATIONS: AssistantFunctionDeclaration[] = [
  {
    name: 'create_item',
    description:
      'Create a new item (task, project/mission, domain/area, habit, medication, supplement, or object/to-get). Use for any "add X" / "I need to..." / "remind me to..." request that names something new.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ITEM_TYPES, description: 'The kind of item to create.' },
        title: { type: 'string', description: 'The item title.' },
        notes: { type: 'string', description: 'Optional notes/description.' },
        scheduledDate: { type: 'string', description: 'Optional ISO date (YYYY-MM-DD) it should appear on.' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'update_item',
    description:
      "Edit an existing item's title, notes, scheduled date, or due date. Use when the user refers to a specific existing item by name (resolve it against the data you were given) and asks to change one of these fields.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        title: { type: 'string', description: 'New title, if changing it.' },
        notes: { type: 'string', description: 'New notes, if changing them.' },
        scheduledDate: { type: 'string', description: 'New scheduled date (YYYY-MM-DD), if changing it.' },
        dueDate: { type: 'string', description: 'New due date (YYYY-MM-DD), if changing it.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'set_item_status',
    description:
      'Change an item\'s status — e.g. mark a task complete, reopen it, cancel it, or move it to someday. Use for "mark X done", "I finished X", "reopen X" requests.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        status: { type: 'string', enum: ITEM_STATUSES, description: 'The new status.' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'set_task_priority',
    description: "Set or clear a task's priority.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The task's id." },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'none'], description: '"none" clears priority.' },
      },
      required: ['id', 'priority'],
    },
  },
  {
    name: 'delete_item',
    description:
      'Delete (soft-delete) an existing item. Use only when the user explicitly asks to remove/delete something — never as a side effect of another request.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        title: { type: 'string', description: "The item's current title, for the confirmation prompt." },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'log_habit_sample',
    description:
      'Log a numeric sample (count or duration) toward a measurable/quantified habit. Use for "log 2 glasses of water", "I ran for 30 minutes" when it matches an existing count/duration habit.',
    parameters: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: "The habit's id." },
        habitTitle: { type: 'string', description: "The habit's current title, for the confirmation prompt." },
        value: { type: 'number', description: 'The amount to log.' },
        note: { type: 'string', description: 'Optional note for this sample.' },
      },
      required: ['habitId', 'habitTitle', 'value'],
    },
  },
  {
    name: 'toggle_habit_occurrence',
    description:
      'Mark a binary (tap-to-complete) habit done or not-done for a given date. Use for "mark my meditation habit done today".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The habit's id." },
        habitTitle: { type: 'string', description: "The habit's current title, for the confirmation prompt." },
        date: { type: 'string', description: 'ISO date (YYYY-MM-DD) to toggle.' },
      },
      required: ['itemId', 'habitTitle', 'date'],
    },
  },
  {
    name: 'log_medication_taken',
    description: 'Log that a dose of a medication or supplement was taken, right now. Use for "I took my vitamin D".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The medication/supplement's id." },
        medicationTitle: { type: 'string', description: 'Its current title, for the confirmation prompt.' },
      },
      required: ['itemId', 'medicationTitle'],
    },
  },
  {
    name: 'log_action',
    description:
      'Log a one-off Action — free-form activity not tied to a task/habit, e.g. practice sessions or general activity. Use for "I did a 20 minute run", "log that I practiced guitar".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title for the action.' },
        kind: { type: 'string', enum: ['practice', 'general'], description: '"practice" for skill/deliberate practice, otherwise "general".' },
        durationMinutes: { type: 'number', description: 'Optional duration in minutes.' },
        intensity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional intensity.' },
      },
      required: ['title', 'kind'],
    },
  },
  {
    name: 'plan_for_today',
    description:
      'Add an existing task to today\'s Home view without giving it a fixed calendar date. Use for "add X to today", "I want to do X today".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The task's id." },
        itemTitle: { type: 'string', description: 'Its current title, for the confirmation prompt.' },
        bucket: { type: 'string', enum: ['anytime', 'morning', 'afternoon', 'evening'], description: 'Optional time-of-day bucket.' },
      },
      required: ['itemId', 'itemTitle'],
    },
  },
];

export const ASSISTANT_TOOL_DECLARATIONS = [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS as any }];

function quote(s: string): string {
  return `"${s}"`;
}

export function previewAssistantTool(name: AssistantToolName, args: Record<string, any>): string {
  switch (name) {
    case 'create_item': {
      const base = `Create ${args.type} ${quote(args.title)}`;
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
    case 'update_item': {
      const parts: string[] = [];
      if (args.title !== undefined) parts.push(`title → ${quote(args.title)}`);
      if (args.notes !== undefined) parts.push('notes updated');
      if (args.scheduledDate !== undefined) parts.push(`scheduled date → ${args.scheduledDate}`);
      if (args.dueDate !== undefined) parts.push(`due date → ${args.dueDate}`);
      return `Update item: ${parts.join(', ')}`;
    }
    case 'set_item_status':
      return `Mark item as ${args.status}`;
    case 'set_task_priority':
      return args.priority === 'none' ? 'Clear task priority' : `Set task priority to ${args.priority}`;
    case 'delete_item':
      return `Delete ${quote(args.title)} (reversible — moves to trash, not permanently erased)`;
    case 'log_habit_sample':
      return `Log ${args.value} for ${quote(args.habitTitle)}`;
    case 'toggle_habit_occurrence':
      return `Mark ${quote(args.habitTitle)} done for ${args.date}`;
    case 'log_medication_taken':
      return `Log a dose of ${quote(args.medicationTitle)} taken now`;
    case 'log_action': {
      const base = `Log action ${quote(args.title)} (${args.kind}`;
      return args.durationMinutes ? `${base}, ${args.durationMinutes} min)` : `${base})`;
    }
    case 'plan_for_today': {
      const base = `Add ${quote(args.itemTitle)} to Today`;
      return args.bucket ? `${base} (${args.bucket})` : base;
    }
    default:
      return `Run ${name}`;
  }
}

export function executeAssistantTool(
  name: AssistantToolName,
  args: Record<string, any>
): { ok: true; result: string } | { ok: false; error: string } {
  try {
    switch (name) {
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        return { ok: true, result: `Created with id ${id}` };
      }
      case 'update_item': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        updateItem(args.id, {
          title: args.title,
          notes: args.notes,
          scheduledDate: args.scheduledDate,
          dueDate: args.dueDate,
        });
        return { ok: true, result: 'Updated' };
      }
      case 'set_item_status': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        updateItemStatus(args.id, args.status);
        return { ok: true, result: 'Status updated' };
      }
      case 'set_task_priority': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        setTaskPriority(args.id, args.priority === 'none' ? null : args.priority);
        return { ok: true, result: 'Priority updated' };
      }
      case 'delete_item': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        deleteItem(args.id);
        return { ok: true, result: 'Deleted' };
      }
      case 'log_habit_sample': {
        logHabitSample(args.habitId, args.value, args.note);
        return { ok: true, result: 'Sample logged' };
      }
      case 'toggle_habit_occurrence': {
        toggleHabitOccurrence(args.itemId, args.date);
        return { ok: true, result: 'Occurrence toggled' };
      }
      case 'log_medication_taken': {
        logMedicationTaken(args.itemId);
        return { ok: true, result: 'Dose logged' };
      }
      case 'log_action': {
        logAction({
          title: args.title,
          kind: args.kind as ActionKind,
          durationMinutes: args.durationMinutes,
          intensity: args.intensity as ActionIntensity | undefined,
        });
        return { ok: true, result: 'Action logged' };
      }
      case 'plan_for_today': {
        planForToday(args.itemId, args.bucket);
        return { ok: true, result: 'Added to Today' };
      }
      default:
        return { ok: false, error: `Unknown tool ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npm test`
Expected: PASS — all `assistantTools.test.ts` cases green. (Other pre-existing `.test.ts` files run too; ignore unrelated failures only if they were already failing before this change — there should be none.)

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors attributable to `assistantTools.ts` (pre-existing `Cannot find module './DetailPanel'`-style false alarms under `src/webApp/` are expected and unrelated, per `apps/mobile/CLAUDE.md`).

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/services/ai/assistantTools.ts apps/mobile/src/services/ai/assistantTools.test.ts
git commit -m "feat: add agentic tool declarations for web assistant

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Web agentic assistant loop

**Files:**
- Create: `apps/mobile/src/services/ai/assistant.web.ts`

**Interfaces:**
- Consumes: `ASSISTANT_TOOL_DECLARATIONS`, `AssistantToolName`, `previewAssistantTool` from `./assistantTools` (Task 1); `buildAssistantContext` from `./assistantContext` (existing, unchanged); `hasFirebaseConfig`, `app` from `../../lib/firebase` (existing).
- Produces (consumed by Task 3 — `AssistantOverlay.tsx`):
  - `export const hasAssistant: boolean`
  - `export interface AssistantTurn { role: 'user' | 'model'; text: string }` — kept for the plain-text case, matching native's shape so `AssistantOverlay` doesn't need a type union just to hold prior turns' display text.
  - `export interface PendingAssistantCall { name: AssistantToolName; args: Record<string, any>; preview: string }`
  - `export type AskAssistantResult = { kind: 'text'; text: string; rawHistory: any[] } | { kind: 'pending'; calls: PendingAssistantCall[]; rawHistory: any[] }`
  - `export async function askAssistant(question: string, priorRawHistory: any[]): Promise<AskAssistantResult>`
  - `export async function resolveAssistantActions(rawHistory: any[], decisions: Array<{ call: PendingAssistantCall; confirmed: boolean }>): Promise<AskAssistantResult>`

Note: `rawHistory` is the full Gemini `Content[]` array (opaque to `AssistantOverlay` — it just threads it through), distinct from the `AssistantTurn[]` used purely for rendering. `AssistantOverlay` will keep both: a `turns` array for display and a `rawHistory` array for the next `askAssistant`/`resolveAssistantActions` call.

- [ ] **Step 1: Write the module**

There's no meaningful unit test here — the module's only logic beyond straight SDK plumbing is the confirm/decline branching in `resolveAssistantActions`, and the SDK itself (`model.startChat`, `chat.sendMessage`) can't be exercised without a live Firebase project or a mock of the whole `firebase/ai` module. This task is verified by Task 4's manual browser check instead (per the design doc's Testing section). Write the implementation directly:

```typescript
// apps/mobile/src/services/ai/assistant.web.ts
//
// Web-only agentic assistant. Resolved over assistant.ts by Metro's
// platform-extension convention on web builds — native's assistant.ts is
// untouched and stays read-only. See docs/superpowers/specs/
// 2026-08-15-agentic-web-assistant-design.md.
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app, hasFirebaseConfig } from '../../lib/firebase';
import { buildAssistantContext } from './assistantContext';
import {
  ASSISTANT_TOOL_DECLARATIONS,
  executeAssistantTool,
  previewAssistantTool,
  type AssistantToolName,
} from './assistantTools';

export const hasAssistant = hasFirebaseConfig && !!app;

export interface AssistantTurn {
  role: 'user' | 'model';
  text: string;
}

export interface PendingAssistantCall {
  name: AssistantToolName;
  args: Record<string, any>;
  preview: string;
}

export type AskAssistantResult =
  | { kind: 'text'; text: string; rawHistory: any[] }
  | { kind: 'pending'; calls: PendingAssistantCall[]; rawHistory: any[] };

const SYSTEM_PROMPT_PREFIX = `You are the personal assistant embedded in RKA OS, a personal task/life
management app, running in the desktop web app. You have read access to the user's current data,
given below as JSON, AND you can create, update, complete, and delete items using the tools
provided — every tool call you make is shown to the user for explicit confirmation before it
takes effect, so propose actions confidently when the user's intent is clear.

When the user's request refers to a SPECIFIC existing item by name (not a general category), find
it by title in the data below and use its own "id" field as the tool argument — never invent an id.
If nothing in the data plausibly matches, ask the user to clarify instead of guessing.

When you refer to a SPECIFIC item from the data below by name in your text responses, wrap it
exactly as [[id:Title]] using that item's own "id" field, e.g. [[a1b2c3:MUSIC]]. Only wrap specific
named items this way, never general category words.

Be concise and conversational.

Today's date: ${new Date().toISOString().slice(0, 10)}

Current data (JSON array of items):
`;

function buildModel() {
  if (!hasAssistant || !app) {
    throw new Error('The assistant needs Firebase to be configured.');
  }
  const context = buildAssistantContext();
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: 'gemini-flash-latest',
    systemInstruction: SYSTEM_PROMPT_PREFIX + context,
    tools: ASSISTANT_TOOL_DECLARATIONS as any,
  });
}

function extractFunctionCalls(response: any): Array<{ name: AssistantToolName; args: Record<string, any> }> {
  const calls = typeof response.functionCalls === 'function' ? response.functionCalls() : null;
  if (!calls || calls.length === 0) return [];
  return calls.map((c: any) => ({ name: c.name as AssistantToolName, args: c.args ?? {} }));
}

export async function askAssistant(question: string, priorRawHistory: any[]): Promise<AskAssistantResult> {
  const model = buildModel();
  const chat = model.startChat({ history: priorRawHistory });
  const result = await chat.sendMessage(question);
  const response = result.response;

  const calls = extractFunctionCalls(response);
  const rawHistory = await chat.getHistory();

  if (calls.length === 0) {
    return { kind: 'text', text: response.text(), rawHistory };
  }

  return {
    kind: 'pending',
    calls: calls.map((c) => ({ ...c, preview: previewAssistantTool(c.name, c.args) })),
    rawHistory,
  };
}

export async function resolveAssistantActions(
  rawHistory: any[],
  decisions: Array<{ call: PendingAssistantCall; confirmed: boolean }>
): Promise<AskAssistantResult> {
  const model = buildModel();
  const chat = model.startChat({ history: rawHistory });

  const functionResponseParts = decisions.map(({ call, confirmed }) => {
    if (!confirmed) {
      return { functionResponse: { name: call.name, response: { cancelled: true } } };
    }
    const outcome = executeAssistantTool(call.name, call.args);
    return {
      functionResponse: {
        name: call.name,
        response: outcome.ok ? { result: outcome.result } : { error: outcome.error },
      },
    };
  });

  const result = await chat.sendMessage(functionResponseParts as any);
  const response = result.response;
  const calls = extractFunctionCalls(response);
  const newRawHistory = await chat.getHistory();

  if (calls.length === 0) {
    return { kind: 'text', text: response.text(), rawHistory: newRawHistory };
  }

  return {
    kind: 'pending',
    calls: calls.map((c) => ({ ...c, preview: previewAssistantTool(c.name, c.args) })),
    rawHistory: newRawHistory,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors attributable to `assistant.web.ts` itself. (Note: `tsc` resolves `./assistantTools` and `./assistant` without the `.web.ts` suffix awareness Metro has — this file is only ever loaded by Metro on web builds, so a `Cannot find module` on `.web.ts`-suffixed imports elsewhere is the pre-documented false alarm in `apps/mobile/CLAUDE.md`, not a real break. This file itself imports `./assistantTools` — a real, non-platform-suffixed file — so it should resolve cleanly.)

- [ ] **Step 3: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/services/ai/assistant.web.ts
git commit -m "feat: add web-only agentic assistant loop with confirm-before-write

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Pending-action confirmation UI in AssistantOverlay

**Files:**
- Modify: `apps/mobile/src/components/assistant/AssistantOverlay.tsx`

**Interfaces:**
- Consumes: `askAssistant`, `hasAssistant`, `AssistantTurn`, `PendingAssistantCall`, `AskAssistantResult`, `resolveAssistantActions` from `../../services/ai/assistant` (Metro resolves to `assistant.web.ts` on web, `assistant.ts` on native — native's module doesn't export `PendingAssistantCall`/`resolveAssistantActions`, so those imports must be used defensively; see Step 3's approach below).
- Produces: nothing consumed elsewhere — this is the leaf UI.

Because native's `assistant.ts` and web's `assistant.web.ts` now have **different exports** (`resolveAssistantActions`/`PendingAssistantCall` only exist on web), `AssistantOverlay.tsx` needs a shape that compiles under both. The `askAssistant` return type differs too (native still effectively always returns plain text — but to keep one shared component simple, native's `assistant.ts` return type can stay `Promise<string>` as today; only web's is the richer `AskAssistantResult`). Rather than editing native's file, `AssistantOverlay.tsx` treats the result as `any`-ish at the point of the platform boundary and narrows by checking for a `kind` field, which is present only on the web result and absent (undefined) on a plain string. This is the one place platform divergence leaks into a shared file, and it's a narrow, defensive check — not a behavior change for native.

- [ ] **Step 1: Update state and the send/resolve handlers**

Replace the existing `turns`/`handleSend` logic in `AssistantOverlay.tsx`:

```typescript
// Replace the import line:
// import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
// resolveAssistantActions/PendingAssistantCall only exist on the web build's assistant.web.ts;
// native's assistant.ts doesn't export them. Import defensively so this file typechecks on both.
import type { PendingAssistantCall } from '../../services/ai/assistant';
```

Add a new turn variant and pending-action state alongside the existing `turns`/`input`/`busy`/`error` state:

```typescript
type DisplayTurn =
  | { kind: 'text'; role: 'user' | 'model'; text: string }
  | { kind: 'action-result'; text: string };

const [turns, setTurns] = useState<DisplayTurn[]>([]);
const [pending, setPending] = useState<PendingAssistantCall[] | null>(null);
const [rawHistory, setRawHistory] = useState<any[]>([]);
```

(This replaces the old `AssistantTurn[]` state — `handleLinkPress`/rendering below is updated in Step 2 to match `DisplayTurn`.)

Replace `handleSend`:

```typescript
const handleSend = async () => {
  const question = input.trim();
  if (!question || busy || pending) return;
  setInput('');
  setError(null);
  setTurns((prev) => [...prev, { kind: 'text', role: 'user', text: question }]);
  setBusy(true);
  try {
    const result: any = await askAssistant(question, rawHistory);
    if (result && result.kind === 'pending') {
      setPending(result.calls);
      setRawHistory(result.rawHistory);
    } else {
      const text = typeof result === 'string' ? result : result.text;
      setTurns((prev) => [...prev, { kind: 'text', role: 'model', text }]);
      if (result && result.rawHistory) setRawHistory(result.rawHistory);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong.');
  } finally {
    setBusy(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }
};

const handleResolvePending = async (confirmedNames: Set<number>) => {
  if (!pending) return;
  const calls = pending;
  setPending(null);
  setBusy(true);
  setError(null);
  try {
    const { resolveAssistantActions } = await import('../../services/ai/assistant');
    const decisions = calls.map((call, i) => ({ call, confirmed: confirmedNames.has(i) }));
    const resultLines = calls
      .filter((_, i) => confirmedNames.has(i))
      .map((call) => `✓ ${call.preview}`);
    if (resultLines.length > 0) {
      setTurns((prev) => [...prev, ...resultLines.map((text) => ({ kind: 'action-result' as const, text }))]);
    }
    const result: any = await (resolveAssistantActions as any)(rawHistory, decisions);
    if (result.kind === 'pending') {
      setPending(result.calls);
      setRawHistory(result.rawHistory);
    } else {
      setTurns((prev) => [...prev, { kind: 'text', role: 'model', text: result.text }]);
      setRawHistory(result.rawHistory);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong.');
  } finally {
    setBusy(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }
};
```

- [ ] **Step 2: Update rendering — turn list and pending-action cards**

Replace the `turns.map(...)` block (the one keyed on `turn.role === 'user'`) with one keyed on `turn.kind`:

```tsx
{turns.map((turn, i) => {
  if (turn.kind === 'action-result') {
    return (
      <View key={i} style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.accentSoft }]}>
        <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
      </View>
    );
  }
  return (
    <View
      key={i}
      style={[
        styles.bubble,
        turn.role === 'user'
          ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
          : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
      ]}
    >
      {turn.role === 'model' ? (
        <Text style={[styles.bubbleText, { color: mat.platinum }]}>
          {parseAssistantMessage(turn.text).map((segment, segIndex) => {
            if (segment.kind === 'bold') {
              return (
                <Text key={segIndex} style={styles.bold}>
                  {segment.text}
                </Text>
              );
            }
            if (segment.kind === 'link') {
              return (
                <Text
                  key={segIndex}
                  style={[styles.link, { color: mat.accent }]}
                  onPress={() => handleLinkPress(segment.id)}
                >
                  {segment.text}
                </Text>
              );
            }
            return <Text key={segIndex}>{segment.text}</Text>;
          })}
        </Text>
      ) : (
        <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
      )}
    </View>
  );
})}
{pending ? (
  <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1, maxWidth: '100%' }]}>
    {pending.map((call, i) => (
      <Text key={i} style={[styles.bubbleText, { color: mat.platinum, marginBottom: spacing[2] }]}>
        {call.preview}
      </Text>
    ))}
    <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
      <TouchableOpacity
        onPress={() => handleResolvePending(new Set(pending.map((_, i) => i)))}
        style={[styles.sendBtn, { width: 'auto', paddingHorizontal: spacing[4], backgroundColor: mat.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Confirm"
      >
        <Text style={{ color: mat.onAccent, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>Confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleResolvePending(new Set())}
        style={[styles.sendBtn, { width: 'auto', paddingHorizontal: spacing[4], backgroundColor: mat.fill }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={{ color: mat.platinum, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
) : null}
```

Update `handleLinkPress` — it's unaffected by the `DisplayTurn` change (it doesn't reference `turns`), so leave it as-is.

Update the empty-state copy (the `turns.length === 0 ? ... : null` block) to:

```tsx
{turns.length === 0 ? (
  <Text style={[styles.empty, { color: mat.platinumMuted }]}>
    Ask about your tasks, missions, medications, or domains — or ask me to add, update, complete,
    or delete something. I'll always check with you before making a change.
  </Text>
) : null}
```

Update the `TextInput`'s `editable`/`disabled` conditions to also respect `pending` (block typing while a confirmation is open):

```tsx
editable={hasAssistant && !busy && !pending}
```

and the send button:

```tsx
disabled={!hasAssistant || busy || !!pending || !input.trim()}
style={[styles.sendBtn, { backgroundColor: mat.accent, opacity: !hasAssistant || busy || !!pending || !input.trim() ? 0.4 : 1 }]}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors attributable to `AssistantOverlay.tsx`. The dynamic `import('../../services/ai/assistant')` inside `handleResolvePending` is deliberate: it's only ever called after `pending` is set, which can only happen on web (native's `askAssistant` return is a plain string, never `{ kind: 'pending' }`), so the branch is dead on native at runtime — but written this way so native's typecheck of this file doesn't need `resolveAssistantActions` to exist as a static export it can resolve.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/assistant/AssistantOverlay.tsx
git commit -m "feat: add pending-action confirmation cards to assistant overlay

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the web dev server**

Use the Browser pane's `preview_start` with `{ name: "..." }` per `.claude/launch.json` if a web config exists, otherwise start it directly:

Run: `cd apps/mobile && npm run web`

- [ ] **Step 2: Open the Assistant overlay and issue a create request**

In the running web app, open the Assistant (Sparkles icon). Send: `Add a task called "Buy milk" for tomorrow`.
Expected: A pending-action card appears with preview text like `Create task "Buy milk", scheduled <tomorrow's date>` and Confirm/Cancel buttons — no DB write yet.

- [ ] **Step 3: Confirm and verify the write**

Tap Confirm. Expected: an "✓ Create task..." bubble appears, followed by the model's follow-up text response. Check the Tasks/Inbox screen — the task now exists with the right title and date.

- [ ] **Step 4: Verify decline does not write**

Send another create-style request, then tap Cancel on the pending card. Expected: no new item appears in Tasks/Inbox; the model's follow-up text acknowledges the cancellation rather than retrying.

- [ ] **Step 5: Verify a status-change / completion request against an existing item**

Send: `Mark "Buy milk" as done` (referring to the item created in Step 3). Expected: pending card resolves the correct item by title from context, previews `Mark item as completed`; confirming marks it completed in the UI.

- [ ] **Step 6: Verify native is unaffected**

Run: `cd apps/mobile && npx tsc --noEmit` (already run in Task 3, re-confirm no native-path regressions) — and, if a simulator/device is available, open the native app's Assistant and confirm it still only answers questions (no pending-action cards ever appear, no crash). If no simulator is readily available, this step is a code-review check instead: confirm `assistant.ts` was not modified (`git diff` shows no changes to that file across this whole plan).

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os" && git diff --stat main -- apps/mobile/src/services/ai/assistant.ts`
Expected: no output (file unchanged).

---

### Task 5: Documentation

**Files:**
- Modify: `apps/mobile/CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a shipped-feature entry**

Add a new paragraph to `apps/mobile/CLAUDE.md`, placed near the other "shipped" feature write-ups (e.g. after the "Alertness" paragraph, before "Domains are now six"), following the file's existing terse prose style:

```markdown
**Agentic web assistant (shipped, web-only 2026-08-15):** The web app's assistant (`services/ai/assistant.web.ts`, resolved by Metro over the native `assistant.ts`, which stays read-only) can create/update/complete/delete items and log habit samples, medication doses, and Actions via Gemini function calling (`assistantTools.ts`'s curated `FunctionDeclaration` set, wrapping existing `database.web.ts` CRUD). Every tool call the model proposes is shown as a pending-action confirmation card in `AssistantOverlay.tsx` (preview text + Confirm/Cancel) — nothing writes to the database until the user explicitly confirms; declining sends a `{cancelled: true}` functionResponse back so the model acknowledges rather than retries. No `find_item`/search tool — reference resolution relies on the same full-item JSON snapshot already in the read-only system prompt context (`assistantContext.ts`), which is fine at the current small data scale; revisit if title collisions become a real problem. Native is untouched. See `docs/superpowers/specs/2026-08-15-agentic-web-assistant-design.md`.
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/CLAUDE.md
git commit -m "docs: document agentic web assistant in CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Tool definitions (Task 1) ✓, agentic loop with confirm-before-write (Task 2) ✓, UI confirmation cards (Task 3) ✓, safety/soft-delete preview copy (Task 1's `delete_item` preview) ✓, native untouched (verified in Task 4 Step 6) ✓, docs updated (Task 5, satisfies the repo's multi-agent rule) ✓. `find_item` explicitly out of scope per spec — not built, noted in docs.
- **Type consistency:** `AssistantToolName` defined once in `assistantTools.ts` (Task 1), imported by `assistant.web.ts` (Task 2) and referenced only as `PendingAssistantCall['name']` in `AssistantOverlay.tsx` (Task 3) — consistent across all three. `PendingAssistantCall`/`AskAssistantResult` defined once in `assistant.web.ts`, consumed by Task 3.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
