# Conversational Day Planning ("Plan My Day") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user brain-dump a list of things to get done and have Sensei (the native assistant) turn it into real, correctly-ordered, correctly-linked Tasks in today's Home view — asking about importance, duration, sub-steps, and same-list dependencies along the way.

**Architecture:** No new database tables. Task dependencies already exist (`dependsOn` relation + `getBlockingTask` + `BlockedBadge`, shipped with the drag-reorder work) — this plan reuses them as-is. Subtasks are new: a plain `subtaskOf` row in the existing generic `itemRelations` table, same mechanism as every other relation in the app. The assistant's tool surface (`assistantTools.ts` schemas, `assistantToolExecutor.ts` executors, `assistant.ts` system prompt) gets extended, not redesigned. One small, real bug gets fixed as part of this: `plan_for_today` never wrote a manual-order row, so a batch of tasks planned in sequence had no guaranteed display order — fixed by auto-appending on first plan, independent of this feature but required for it to work.

**Tech Stack:** React Native/Expo (native only, `apps/mobile/`), SQLite (`expo-sqlite`) via `src/db/database.ts`, Firebase AI Logic / Vertex (Gemini function calling) via `src/services/ai/`.

## Global Constraints

- Native only — `apps/mobile/src/`. Do not touch `assistant.web.ts`/`assistantContext.web.ts`/`assistantToolExecutor.web.ts` or any `.web.tsx` screen.
- `subtaskOf` and `dependsOn` are single-select relations (`itemRelations`' `UNIQUE(sourceId, relationType)` constraint) — a task has at most one parent and at most one direct blocker. Do not attempt multi-target modeling.
- User-facing copy: internal relation/type names (`dependsOn`, `subtaskOf`, `task`) are never renamed — but any new user-facing string must follow the existing "Domain"/"Mission" terminology rule (not relevant here since Tasks stay "Tasks").
- Run `npx tsc --noEmit` from `apps/mobile/` after every task that touches `.ts`/`.tsx` files.
- Run `npm test` from `apps/mobile/` (Node's built-in test runner over `src/**/*.test.ts`) after every task that touches a `.test.ts` file.
- Commit after each task, following the repo's `type: summary` convention (`fix:`, `feat:`, `docs:`), with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Deterministic Today ordering — fix `plan_for_today` to always record a position

**Why this is first:** the assistant will call `plan_for_today` several times in a row for one planning session, expecting the Today list to reflect that call sequence. Today, `planForToday` only stamps `metadata.plannedDate`/`preferredTimeBucket` — it never writes an `itemOrder` row, so `TodayCard`'s `applyManualOrder` falls back to whatever order the `items` prop happened to already be in (not call order). This task fixes that generally (any caller benefits), which is what makes the later system-prompt instruction ("call `plan_for_today` in the order you want tasks done") actually true.

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (`planForToday`, ~line 2051; add new exported `TODAY_LIST_KEY` const and `appendToManualOrderIfAbsent` helper near `setManualOrder`/`applyManualOrder`, ~line 749-790)
- Modify: `apps/mobile/src/components/home/TodayCard.tsx` (drop the local `TODAY_LIST_KEY` literal, import the shared one)

**Interfaces:**
- Produces: `export const TODAY_LIST_KEY = 'home:today'` (database.ts) — the single source of truth other files must import instead of re-declaring the string.
- Produces: `export function appendToManualOrderIfAbsent(listKey: string, itemId: string): void` — idempotent append-to-end-of-manual-order, no-op if the item already has a saved position for that list.
- Modifies (same signature, new behavior): `planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void` — now also calls `appendToManualOrderIfAbsent(TODAY_LIST_KEY, itemId)`.

- [ ] **Step 1: Add the shared `TODAY_LIST_KEY` constant and `appendToManualOrderIfAbsent` helper**

In `apps/mobile/src/db/database.ts`, find `setManualOrder` (around line 749-767) and `applyManualOrder` (around line 769-790+). Add the new constant and helper directly after `applyManualOrder`'s closing brace:

```typescript
// Shared listKey for Home's Today view manual order (TodayCard.tsx reads
// this via applyManualOrder) — a single exported constant so callers never
// re-type the literal and risk drifting out of sync.
export const TODAY_LIST_KEY = 'home:today';

// Appends itemId to the end of listKey's manual order if it has no saved
// position yet — a no-op if it's already positioned (e.g. the user already
// dragged it once). Lets callers that add several items in a deliberate
// sequence (e.g. the assistant planning a batch of tasks into Today) get
// that sequence reflected immediately, without requiring a manual drag.
export function appendToManualOrderIfAbsent(listKey: string, itemId: string): void {
  const db = getDb();
  const existing = db.getAllSync<{ position: number }>(
    `SELECT position FROM itemOrder WHERE listKey = ? AND itemId = ?`,
    [listKey, itemId]
  );
  if (existing.length > 0) return;
  const maxRow = db.getAllSync<{ maxPos: number | null }>(
    `SELECT MAX(position) as maxPos FROM itemOrder WHERE listKey = ?`,
    [listKey]
  )[0];
  const position = (maxRow?.maxPos ?? -1) + 1;
  db.runSync(`INSERT INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`, [listKey, itemId, position]);
  const userId = getCurrentSyncUserId();
  if (userId) {
    const rows = db.getAllSync<{ itemId: string }>(
      `SELECT itemId FROM itemOrder WHERE listKey = ? ORDER BY position ASC`,
      [listKey]
    );
    pushItemOrderBatchToFirestore(userId, listKey, rows.map((r) => r.itemId)).catch(() => {});
  }
}
```

This uses `getCurrentSyncUserId` and `pushItemOrderBatchToFirestore`, both already imported/defined in this file (used by `setManualOrder` just above) — no new imports needed.

- [ ] **Step 2: Call the helper from `planForToday`**

Find `planForToday` (around line 2051):

```typescript
export function planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  updateItemMetadata(itemId, meta);
}
```

Change it to:

```typescript
export function planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  updateItemMetadata(itemId, meta);
  appendToManualOrderIfAbsent(TODAY_LIST_KEY, itemId);
}
```

- [ ] **Step 3: Point `TodayCard.tsx` at the shared constant**

In `apps/mobile/src/components/home/TodayCard.tsx`, remove the local literal (line 12: `const TODAY_LIST_KEY = 'home:today';`) and instead import it:

```typescript
import { applyManualOrder, TODAY_LIST_KEY } from '../../db/database';
```

(This replaces the existing `import { applyManualOrder } from '../../db/database';` on line 7 — merge into one import line, and delete the now-redundant local `const TODAY_LIST_KEY = 'home:today';` on line 12.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (pre-existing `Cannot find module './DetailPanel'`-style false alarms under `src/webApp/` are expected and unrelated — see `CLAUDE.md`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/database.ts apps/mobile/src/components/home/TodayCard.tsx
git commit -m "$(cat <<'EOF'
fix: plan_for_today now records a manual-order position

planForToday only ever stamped metadata — it never wrote an itemOrder
row, so a batch of tasks planned in sequence had no guaranteed display
order in Home's Today list (fell back to arbitrary item order instead
of call order). Auto-append on first plan fixes it for every caller.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Assistant tool schemas — duration, subtasks, dependencies

**Files:**
- Modify: `apps/mobile/src/services/ai/assistantTools.ts`
- Modify: `apps/mobile/src/services/ai/assistantTools.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `create_item`'s schema gains optional `durationMinutes: number`; `link_items`'s `relationType` enum gains `'dependsOn'` and `'subtaskOf'`; `previewAssistantTool('create_item', ...)` includes duration when present; `previewAssistantTool('link_items', ...)` has dedicated phrasing for `dependsOn`/`subtaskOf`. These are consumed by Task 3 (executor) and Task 4 (system prompt).

- [ ] **Step 1: Write the failing preview tests**

Add to `apps/mobile/src/services/ai/assistantTools.test.ts`, after the existing `create_item` tests (after line 18):

```typescript
test('previews create_item with a duration', () => {
  const preview = previewAssistantTool('create_item', {
    type: 'task',
    title: 'Sort wardrobe',
    durationMinutes: 30,
  });
  assert.equal(preview, 'Create task "Sort wardrobe" (30 min)');
});
```

And after the existing `link_items` test (after line 138):

```typescript
test('previews link_items with dependsOn', () => {
  const preview = previewAssistantTool('link_items', {
    sourceId: 't2',
    sourceTitle: 'Post to Instagram',
    relationType: 'dependsOn',
    targetId: 't1',
    targetTitle: 'Take photos',
  });
  assert.equal(preview, '"Post to Instagram" depends on "Take photos" (must be done first)');
});

test('previews link_items with subtaskOf', () => {
  const preview = previewAssistantTool('link_items', {
    sourceId: 't3',
    sourceTitle: 'Sort shirts',
    relationType: 'subtaskOf',
    targetId: 't4',
    targetTitle: 'Organise wardrobe',
  });
  assert.equal(preview, '"Sort shirts" becomes a subtask of "Organise wardrobe"');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npm test`
Expected: FAIL — the three new tests fail (`durationMinutes` not in preview text; `dependsOn`/`subtaskOf` fall through to the generic `Link X → Y (relationType)` phrasing instead of the new copy). All prior tests still pass.

- [ ] **Step 3: Add `durationMinutes` to `create_item`'s schema**

In `apps/mobile/src/services/ai/assistantTools.ts`, find the `create_item` declaration (lines 54-68):

```typescript
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
```

Change to:

```typescript
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
        durationMinutes: { type: 'number', description: 'For tasks: a rough time estimate in minutes, if known/asked about.' },
      },
      required: ['type', 'title'],
    },
  },
```

- [ ] **Step 4: Extend `link_items`'s `relationType` enum**

Find the `link_items` declaration (lines 254-269):

```typescript
  {
    name: 'link_items',
    description:
      'Link one item to another via a relation. Use to attach a Habit to a Skill (relationType "habitSkill"), a Mission to a Skill ("missionSkill"), or a Mission to a Domain ("area"). sourceId/targetId are ids from the data you were given.',
    parameters: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'The item being linked (e.g. the habit or mission).' },
        sourceTitle: { type: 'string', description: "The source item's title, for the confirmation prompt." },
        relationType: { type: 'string', enum: ['habitSkill', 'missionSkill', 'area', 'skillArea'], description: 'The relation.' },
        targetId: { type: 'string', description: 'The item it links to (e.g. the skill or domain).' },
        targetTitle: { type: 'string', description: "The target item's title, for the confirmation prompt." },
      },
      required: ['sourceId', 'sourceTitle', 'relationType', 'targetId', 'targetTitle'],
    },
  },
```

Change to:

```typescript
  {
    name: 'link_items',
    description:
      'Link one item to another via a relation. Use to attach a Habit to a Skill (relationType "habitSkill"), a Mission to a Skill ("missionSkill"), a Mission to a Domain ("area"), one task to a task it must wait on ("dependsOn": sourceId is the WAITING task, targetId is the task that must be done first), or one task to its parent task ("subtaskOf": sourceId is the SUBTASK, targetId is the parent). sourceId/targetId are ids from the data you were given.',
    parameters: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'The item being linked (e.g. the habit, mission, or dependent/subtask task).' },
        sourceTitle: { type: 'string', description: "The source item's title, for the confirmation prompt." },
        relationType: { type: 'string', enum: ['habitSkill', 'missionSkill', 'area', 'skillArea', 'dependsOn', 'subtaskOf'], description: 'The relation.' },
        targetId: { type: 'string', description: 'The item it links to (e.g. the skill, domain, blocking task, or parent task).' },
        targetTitle: { type: 'string', description: "The target item's title, for the confirmation prompt." },
      },
      required: ['sourceId', 'sourceTitle', 'relationType', 'targetId', 'targetTitle'],
    },
  },
```

- [ ] **Step 5: Update `previewAssistantTool` for both cases**

Find the `create_item` case in `previewAssistantTool` (lines 305-308):

```typescript
    case 'create_item': {
      const base = `Create ${args.type} ${quote(args.title)}`;
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
```

Change to:

```typescript
    case 'create_item': {
      let base = `Create ${args.type} ${quote(args.title)}`;
      if (args.durationMinutes) base += ` (${args.durationMinutes} min)`;
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
```

Find the `link_items` case (lines 353-354):

```typescript
    case 'link_items':
      return `Link ${quote(args.sourceTitle)} → ${quote(args.targetTitle)} (${args.relationType})`;
```

Change to:

```typescript
    case 'link_items': {
      if (args.relationType === 'dependsOn') {
        return `${quote(args.sourceTitle)} depends on ${quote(args.targetTitle)} (must be done first)`;
      }
      if (args.relationType === 'subtaskOf') {
        return `${quote(args.sourceTitle)} becomes a subtask of ${quote(args.targetTitle)}`;
      }
      return `Link ${quote(args.sourceTitle)} → ${quote(args.targetTitle)} (${args.relationType})`;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/mobile && npm test`
Expected: PASS — all tests including the 3 new ones.

- [ ] **Step 7: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/services/ai/assistantTools.ts apps/mobile/src/services/ai/assistantTools.test.ts
git commit -m "$(cat <<'EOF'
feat: teach assistant tools durationMinutes, dependsOn, subtaskOf

create_item can now take a rough duration estimate; link_items can
link a task to a blocking task (dependsOn, already a real relation
via getBlockingTask/BlockedBadge) or a parent task (subtaskOf, new).
Pure schema/preview changes — executor wiring is the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Assistant tool executor — wire `durationMinutes` through

**Files:**
- Modify: `apps/mobile/src/services/ai/assistantToolExecutor.ts`

**Interfaces:**
- Consumes: `updateItemMetadata(id: string, metadata: Record<string, any>): void` (already imported in this file from `../../db/database`), `createItem` (already imported).
- Produces: nothing new exported — `create_item`'s executor branch now persists `durationMinutes` into `metadata.durationMinutes`, matching the field name/shape `createTimedItem` already uses elsewhere in `database.ts` (`apps/mobile/src/db/database.ts:3507`) and that `CalendarScreen.tsx` already reads. `link_items`'s existing branch needs no changes — `setRelation(sourceId, relationType, targetId)` is already fully generic and accepts `'dependsOn'`/`'subtaskOf'` as-is.

- [ ] **Step 1: Add duration persistence to the `create_item` executor branch**

In `apps/mobile/src/services/ai/assistantToolExecutor.ts`, find the `create_item` case (lines 33-36):

```typescript
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        return { ok: true, result: `Created with id ${id}` };
      }
```

Change to:

```typescript
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        if (args.type === 'task' && typeof args.durationMinutes === 'number' && args.durationMinutes > 0) {
          updateItemMetadata(id, { durationMinutes: args.durationMinutes });
        }
        return { ok: true, result: `Created with id ${id}` };
      }
```

`updateItemMetadata` is already imported at the top of this file (line 21) — no import changes needed. Confirm the `link_items` case (lines 118-123) is unchanged; it already calls `setRelation(args.sourceId, args.relationType, args.targetId)` with no relation-type-specific logic, so `dependsOn`/`subtaskOf` already work through it.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/ai/assistantToolExecutor.ts
git commit -m "$(cat <<'EOF'
feat: persist assistant-proposed task duration to metadata.durationMinutes

Reuses the same metadata.durationMinutes field createTimedItem/
CalendarScreen already read, so a duration set via the assistant is
visible wherever the rest of the app already shows task duration.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: System prompt — the day-planning conversational flow

**Files:**
- Modify: `apps/mobile/src/services/ai/assistant.ts`

**Interfaces:**
- Consumes: `create_item` (with `durationMinutes`), `link_items` (with `dependsOn`/`subtaskOf`), `plan_for_today` (unchanged signature, now reliably ordered per Task 1) — all from Task 2/3.
- Produces: nothing new exported — this is a prompt-text-only change to the `SYSTEM_PROMPT_PREFIX` constant. No control-flow changes; the existing `askAssistant`/`resolveAssistantActions` loop and pending-card confirmation UI handle an arbitrary batch of proposed calls already.

- [ ] **Step 1: Add the DAY PLANNING section to the system prompt**

In `apps/mobile/src/services/ai/assistant.ts`, find the end of the `SUGGESTING THINGS` section and the start of `WHEN THE USER IS UNSURE` (lines 59-70):

```typescript
SUGGESTING THINGS: When the user asks you to SUGGEST, RECOMMEND, or help them DECIDE on Missions,
Skills, Habits, or a Focus (as opposed to giving you a specific thing to add), do NOT invent a list
out of thin air. First ask 1–2 short clarifying questions to understand what they actually want
(e.g. which Domain or goal it's for, how much time/effort, what they're trying to improve), THEN
propose concrete, tailored options as tool calls they can confirm. Exception: if the user gives you
a specific, explicit instruction ("add a mission called X", "create a daily meditation habit"), just
do it — don't interrogate them.

WHEN THE USER IS UNSURE: If they answer a question with "not sure", "what do you think", "you decide",
or similar, don't stall or bounce it back — make a concrete recommendation using their existing data
(e.g. pick the most fitting Domain and say why in one line), then proceed. It's your job to help them
decide, not just to ask.
```

Insert a new section between them:

```typescript
SUGGESTING THINGS: When the user asks you to SUGGEST, RECOMMEND, or help them DECIDE on Missions,
Skills, Habits, or a Focus (as opposed to giving you a specific thing to add), do NOT invent a list
out of thin air. First ask 1–2 short clarifying questions to understand what they actually want
(e.g. which Domain or goal it's for, how much time/effort, what they're trying to improve), THEN
propose concrete, tailored options as tool calls they can confirm. Exception: if the user gives you
a specific, explicit instruction ("add a mission called X", "create a daily meditation habit"), just
do it — don't interrogate them.

PLANNING A DAY/EVENING: When the user starts listing several loose things they want to get done today
(or explicitly asks you to help plan their day/evening), don't jump straight to tool calls. First go
through the list conversationally, one thing at a time, briefly: confirm priority (use
set_task_priority's scale: low/medium/high), ask a rough duration if it's not obvious from what they
said, ask whether it naturally breaks into sub-steps, and ask whether it depends on anything else in
the list being done first. Keep this natural and skip questions whose answer is already obvious or
already given — don't interrogate over something simple like "clear phone apps". Once you have enough
for the whole list, propose the full batch as tool calls, in this shape:
- create_item (type "task", with durationMinutes) for each top-level task, and set_task_priority for
  it if they gave you one.
- For a task with sub-steps: create_item for each sub-step, then link_items (relationType "subtaskOf",
  sourceId = the sub-step, targetId = the parent task) to attach it.
- For a named dependency ("X after Y"): link_items (relationType "dependsOn", sourceId = the WAITING
  task, targetId = the task that must happen first). A task can only depend on one other task.
- plan_for_today (with a bucket if they mentioned a time of day) for every task that should land on
  Today — call these IN THE ORDER you want the tasks done, since Today's list reflects the order you
  call plan_for_today in.
Before the confirmation cards, summarize the resulting plan in plain text as a short numbered list, so
the user can see the shape of the whole plan, not just individual actions.

WHEN THE USER IS UNSURE: If they answer a question with "not sure", "what do you think", "you decide",
or similar, don't stall or bounce it back — make a concrete recommendation using their existing data
(e.g. pick the most fitting Domain and say why in one line), then proceed. It's your job to help them
decide, not just to ask.
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (this is a template-string-only change).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/ai/assistant.ts
git commit -m "$(cat <<'EOF'
feat: teach Sensei a conversational day-planning flow

New system-prompt section: when the user lists several loose things
to do today, ask priority/duration/subtasks/dependencies per item
conversationally, then propose one batch of create_item/link_items/
plan_for_today calls in dependency-respecting, priority-aware order,
with a plain-text plan summary before the confirmation cards.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Minimal UI — subtask indent in Home's Today list

**Files:**
- Modify: `apps/mobile/src/components/home/TodayCard.tsx`

**Note on scope:** the original design considered also surfacing the blocked-badge in this list. `TodayCard` renders through `NestedReorderableList` (`react-native-reorderable-list`), a drag-reorder component — the codebase has an existing, hard-learned rule that draggable rows must stay uniform height or reordering visually glitches (vanish/clip on drag). A conditionally-rendered `BlockedBadge` subtitle changes row height per-row, so it's deliberately left out of this draggable list in this pass (blocked state is already visible elsewhere — `TasksScreen.tsx`/`HomeTaskRow.tsx`'s Anytime/Upcoming/Someday tabs — via the existing, already-shipped `dependsOn`/`getBlockingTask`/`BlockedBadge` machinery). Subtask indentation is safe here because it only changes horizontal layout (`marginLeft`), never row height.

**Interfaces:**
- Consumes: `getRelation(sourceId: string, relationType: string): string | null` (already exported from `../../db/database`).
- Produces: nothing new exported — visual-only change to `TodayTaskRow`.

- [ ] **Step 1: Look up each row's parent task and indent subtask rows**

In `apps/mobile/src/components/home/TodayCard.tsx`, update the import (already changed in Task 1, Step 3) to also bring in `getRelation`:

```typescript
import { applyManualOrder, getRelation, TODAY_LIST_KEY } from '../../db/database';
```

Update `TodayTaskRow` (lines 22-63) to accept and apply an `isSubtask` flag:

```typescript
const TodayTaskRow = memo(function TodayTaskRow({
  item,
  isDark,
  isCompleting,
  isSubtask,
  onComplete,
  onOpen,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isDark: boolean;
  isCompleting: boolean;
  isSubtask: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const palette = getThemeColors(isDark);
  const isOverdue = item.status === 'overdue';
  return (
    <View style={[styles.row, { backgroundColor: palette.surface }, isSubtask && styles.subtaskRow]}>
      <LacquerDiscControl
        isCompleted={isCompleting}
        accessibilityLabel={`Complete ${item.title}`}
        onToggle={() => onComplete(item)}
      />
      <TouchableOpacity
        style={styles.rowContent}
        activeOpacity={0.7}
        onPress={() => onOpen(item)}
      >
        <Text
          style={[styles.rowTitle, { color: isOverdue ? palette.red : palette.text }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
      <DragHandleButton color={palette.textMuted} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    </View>
  );
});
```

Add a `subtaskRow` style to the `StyleSheet.create` block at the bottom of the file (alongside the existing `row`/`rowContent`/etc.):

```typescript
  subtaskRow: {
    marginLeft: 24,
  },
```

In the `TodayCard` component itself, compute which items are subtasks (once per `ordered` change, mirroring the existing memoization pattern used elsewhere in this codebase for per-row relation lookups — e.g. `TasksScreen.tsx`'s `blockerIdById`) and pass it through to each row:

```typescript
export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);

  const [ordered, setOrdered] = useState<Item[]>([]);
  useEffect(() => {
    setOrdered(applyManualOrder(TODAY_LIST_KEY, items));
  }, [items]);
  const { onDragStart, onIndexChange, onReorder, moveItem } = useHapticReorder(TODAY_LIST_KEY, ordered, setOrdered);

  const subtaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of ordered) {
      if (getRelation(item.id, 'subtaskOf')) ids.add(item.id);
    }
    return ids;
  }, [ordered]);

  return (
    <View style={styles.container}>
      {ordered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to do today</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Enjoy the calm</Text>
        </View>
      ) : (
        <NestedReorderableList
          data={ordered}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={({ item }: { item: Item }) => (
            <TodayTaskRow
              item={item}
              isDark={isDark}
              isCompleting={completingIds.has(item.id)}
              isSubtask={subtaskIds.has(item.id)}
              onComplete={onComplete}
              onOpen={onOpen}
              onMoveUp={() => moveItem(item.id, 'up')}
              onMoveDown={() => moveItem(item.id, 'down')}
            />
          )}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          scrollable={false}
          {...nonVirtualizedListProps(ordered.length)}
        />
      )}
    </View>
  );
}
```

Add `useMemo` to the existing React import at the top of the file (line 1):

```typescript
import { memo, useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Since this list only renders real SQLite data and this codebase has no component-level test harness for RN screens, verify by hand: start the app (`npm run start -- --clear` from `apps/mobile/`, per `CLAUDE.md`'s "Run the Dev Client"), use Sensei to plan two tasks where one is a subtask of the other (or create the relation manually via a scratch script calling `setRelation`), confirm the subtask row renders indented under its sibling in Home's Today card, and confirm dragging to reorder still works without any row clipping/vanishing glitch.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/home/TodayCard.tsx
git commit -m "$(cat <<'EOF'
feat: indent subtask rows in Home's Today list

A task linked via the new subtaskOf relation now renders indented
under its parent in Today — horizontal-only change (marginLeft), so
it's safe inside the draggable list without the row-height instability
a conditional badge would introduce (see uniform-height drag-reorder
constraint already established elsewhere in this codebase).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Correct the design spec with what implementation found

**Why:** the original spec (`docs/superpowers/specs/2026-08-16-conversational-day-planning-design.md`) proposed a new `blockedBy` relation and a new blocked-badge UI, not knowing the app already ships an equivalent `dependsOn` relation + `getBlockingTask` + `BlockedBadge` (from the earlier drag-reorder work) — discovered while reading `database.ts` for this plan. It also proposed a `plan_for_today` `order` parameter that turned out to be unnecessary once `planForToday` was fixed to auto-append (Task 1) — call order alone now produces correct Today ordering. The spec should reflect what was actually built, not the original guess, since it's the durable record for future readers.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-16-conversational-day-planning-design.md`

- [ ] **Step 1: Add a corrections note to the spec**

Insert a new section immediately after the `**Builds on:**` line at the top of the spec file:

```markdown
> **Implementation note (2026-08-16):** while implementing this spec, two of its assumptions
> turned out to be wrong and were corrected — see `docs/superpowers/plans/2026-08-16-conversational-day-planning.md`
> for the actual design used:
> 1. Task dependencies already existed (`dependsOn` relation, `getBlockingTask`, `BlockedBadge`,
>    already wired into `TasksScreen.tsx`/`HomeTaskRow.tsx`/`HomeScreen.tsx`, including a
>    completion-time Alert gate) — the spec's proposed new `blockedBy` relation and new blocked-badge
>    UI were unnecessary; `link_items` just gained `dependsOn` as an allowed `relationType`, reusing
>    everything else as-is.
> 2. `plan_for_today`'s proposed `order` parameter was dropped — `planForToday` was instead fixed to
>    always auto-append a manual-order position on first call (a real, general bug fix, not scoped to
>    this feature), which makes plain call order sufficient for correct Today sequencing.
> Subtask indentation shipped as designed (`subtaskOf`, new relation, indent-only in Home's Today
> list); the blocked-badge-in-Today-list UI idea was dropped, not just deferred — the connector/badge
> pattern already exists in a more appropriate place (`TasksScreen.tsx`'s dedicated Tasks list).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-16-conversational-day-planning-design.md
git commit -m "$(cat <<'EOF'
docs: correct day-planning spec with implementation findings

dependsOn/BlockedBadge/getBlockingTask already existed pre-spec; the
plan_for_today order param was dropped in favor of an auto-append fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

- **Automated:** `assistantTools.test.ts` covers every new preview string (Task 2). No automated coverage for `database.ts` or RN component changes (Tasks 1, 3, 5) — this codebase's existing pattern is that SQLite/native-DB code and RN screens aren't unit-testable under plain Node (see `assistantToolExecutor.ts`'s own file-header comment); `npx tsc --noEmit` plus manual verification is the existing bar for those layers throughout this codebase.
- **Manual, end-to-end (do this once all 6 tasks are committed):** open Sensei, say something like "tonight I want to take photos for insta, clear phone apps, sort tabs, and organise my wardrobe" — work through its follow-up questions (give at least one task a dependency on another, and let "organise wardrobe" get a sub-step), confirm the batch, then check Home's Today card shows the right tasks, right bucket, right order, and the subtask indented under its parent. Separately confirm the existing blocked-task Alert (tap the disc control on the waiting task) still fires correctly for the new dependency, exactly as it already does for manually-created dependencies.
