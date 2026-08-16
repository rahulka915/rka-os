# Downtime Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Task be marked as a "Downtime task" — worked on in short, untracked sessions whenever there's spare time, rather than completed in one sitting — with a lightweight session log, a Home nudge, manual tagging, and conversational tagging via Sensei.

**Architecture:** No new tables. `metadata.interstitial: true` marks a Task item (same pattern as `plannedDate`/`durationMinutes`). Session logging reuses the existing Actions model (`logAction`/`activityLogs`) via a new `taskId` field on `ActionDetails`, rather than a parallel logging mechanism. A new Home section and a task-detail toggle + log control are the only new UI surfaces.

**Tech Stack:** React Native/Expo (native only, `apps/mobile/src/`), SQLite (`expo-sqlite`) via `src/db/database.ts`, existing `useDb.ts`/`item-composer` patterns.

## Global Constraints

- Native only — `apps/mobile/src/`. Do not touch `.web.tsx` files or `database.web.ts`; web parity is explicitly out of scope for this pass (spec's "Web parity" section) — only `WEB_PARITY.md` gets updated, to log it as a tracked gap.
- No new database tables or schema migrations — `metadata.interstitial` and `ActionDetails.taskId` are the only new state, both riding existing mechanisms (`updateItemMetadata`, `activityLogs`).
- No target/remaining-time tracking, no auto-complete — completion stays the existing tap-to-complete control, unconditionally. Do not add a progress bar or "X of Y minutes" anywhere.
- Run `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit` after every task that touches `.ts`/`.tsx` files (plain `npx tsc --noEmit` crashes with a stack overflow on this codebase's size — pre-existing, unrelated). Expect pre-existing `Cannot find module './XScreen'` errors under `src/webApp/*.web.tsx` and one pre-existing `src/db/database.ts(1624,11)` error; confirm no NEW errors near touched files.
- Run `cd apps/mobile && npm test` after every task that touches a `.test.ts` file. Expect one pre-existing unrelated failure (`roninJourneyAnimation.test.ts`, missing manifest asset) — not something to fix here.
- Commit after each task, `type: summary` convention, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- File access can intermittently throw `EPERM: operation not permitted` in this environment — retry, it clears up; not a code problem.

---

### Task 1: Data layer — `taskId` on Actions, `getActionsForTask`, `getInterstitialTasks`

**Files:**
- Modify: `apps/mobile/src/utils/actions.ts` (`ActionDetails` interface ~line 20, `parseActionRow` ~line 54)
- Modify: `apps/mobile/src/utils/actions.test.ts` (add test)
- Modify: `apps/mobile/src/db/database.ts` (add two new exported functions near `getActions`/`getPlannedTodayItems`)

**Interfaces:**
- Produces: `ActionDetails.taskId?: string` — consumed by Task 2 (executor) and Task 4 (log-session UI).
- Produces: `export function getActionsForTask(taskId: string): ActionRow[]` (database.ts) — consumed by Task 4.
- Produces: `export function getInterstitialTasks(): Item[]` (database.ts) — consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/utils/actions.test.ts`, after the existing `parseActionRow: reads valid details` test:

```typescript
test('parseActionRow: reads taskId when present', () => {
  const row = parseActionRow({
    id: 'a1',
    entityId: 'manual',
    timestamp: 1000,
    details: JSON.stringify({ title: 'Sorted a drawer', kind: 'general', taskId: 't1' }),
  });
  assert.equal(row.taskId, 't1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test 2>&1 | grep -A5 "reads taskId"`
Expected: FAIL — `row.taskId` is `undefined` (property doesn't exist on the parsed row yet).

- [ ] **Step 3: Add `taskId` to `ActionDetails` and `parseActionRow`**

In `apps/mobile/src/utils/actions.ts`, change the `ActionDetails` interface:

```typescript
export interface ActionDetails {
  title: string;
  kind: ActionKind;
  durationMinutes?: number;
  intensity?: ActionIntensity;
  why?: string;
  domainId?: string; // 'area' item
  pillarId?: string; // 'potential-stat' item
  skillId?: string;
  missionId?: string; // 'project' item
  taskId?: string; // 'task' item this session's progress counts toward (Downtime tasks)
  attributeContributions?: AttributeContributionConfig[]; // which Attribute(s) this is evidence for, and how strongly
}
```

In `parseActionRow`, add one line after the `missionId` line:

```typescript
    missionId: d.missionId || undefined,
    taskId: d.taskId || undefined,
    attributeContributions: parseAttributeContributions(d.attributeContributions),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS — all tests including the new one.

- [ ] **Step 5: Add `getActionsForTask` to `database.ts`**

In `apps/mobile/src/db/database.ts`, add directly after the existing `getActions` function (around line 2268):

```typescript
// All logged sessions against one Downtime task, newest first — powers the
// task detail screen's session history. Same actionType='action' filter as
// getActions, narrowed by a LIKE on the stored details JSON (same pattern
// getPlannedTodayItems uses for metadata.plannedDate).
export function getActionsForTask(taskId: string): ActionRow[] {
  const rows = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'action' AND details LIKE ? ORDER BY timestamp DESC`,
    [`%"taskId":"${taskId}"%`]
  );
  return rows.map(parseActionRow);
}
```

Confirm `ActionRow` and `parseActionRow` are already imported into `database.ts` (they're used by the existing `getActions`/`getActionFeed` just above) — no new imports needed for this function.

- [ ] **Step 6: Add `getInterstitialTasks` to `database.ts`**

Add directly after `getPlannedTodayItems` (around line 2129), following its exact pattern:

```typescript
// Active tasks tagged as Downtime tasks (metadata.interstitial) — worked on
// in short sessions whenever there's spare time, surfaced on Home. Same
// metadata-LIKE pattern as getPlannedTodayItems.
export function getInterstitialTasks(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status NOT IN ('completed', 'inbox')
       AND deletedAt IS NULL AND metadata LIKE '%"interstitial":true%'`
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit`
Expected: no new errors near `actions.ts`/`actions.test.ts`/`database.ts`.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/utils/actions.ts apps/mobile/src/utils/actions.test.ts apps/mobile/src/db/database.ts
git commit -m "$(cat <<'EOF'
feat: add taskId to Actions and Downtime-task queries

ActionDetails.taskId links a logged Action to the Downtime task it's a
session of, reusing the existing Actions model instead of a parallel
logging mechanism. getActionsForTask/getInterstitialTasks are the two
read paths Downtime Tasks needs, following the existing
getActions/getPlannedTodayItems patterns exactly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Assistant integration — tag and log Downtime tasks via Sensei

**Files:**
- Modify: `apps/mobile/src/services/ai/assistantTools.ts` (`create_item` and `log_action` declarations + previews)
- Modify: `apps/mobile/src/services/ai/assistantTools.test.ts` (add tests)
- Modify: `apps/mobile/src/services/ai/assistantToolExecutor.ts` (`create_item` and `log_action` cases)
- Modify: `apps/mobile/src/services/ai/assistant.ts` (PLANNING A DAY/EVENING system-prompt section)

**Interfaces:**
- Consumes: `getInterstitialTasks`, `getActionsForTask` not needed here (executor only writes, doesn't need to read them). Consumes `ActionDetails.taskId` from Task 1.
- Produces: `create_item`'s schema gains optional `interstitial: boolean`; `log_action`'s schema gains optional `taskId: string` + `taskTitle: string` (paired id+title args, same convention `link_items` already uses for `sourceId`/`sourceTitle`).

- [ ] **Step 1: Write the failing preview tests**

Add to `apps/mobile/src/services/ai/assistantTools.test.ts`, after the existing `previews create_item with a duration` test:

```typescript
test('previews create_item as a downtime task', () => {
  const preview = previewAssistantTool('create_item', {
    type: 'task',
    title: 'Sort wardrobe',
    interstitial: true,
  });
  assert.equal(preview, 'Create task "Sort wardrobe" · downtime task');
});
```

And after the existing `log_action` preview test (search for `case 'log_action'`'s existing test, likely named something like `previews log_action`):

```typescript
test('previews log_action against a downtime task', () => {
  const preview = previewAssistantTool('log_action', {
    title: 'Sorted a drawer',
    kind: 'general',
    durationMinutes: 10,
    taskId: 't1',
    taskTitle: 'Sort wardrobe',
  });
  assert.equal(preview, 'Log action "Sorted a drawer" (general, 10 min) → "Sort wardrobe"');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npm test`
Expected: FAIL — both new tests fail (no `interstitial`/`taskTitle` handling in the preview functions yet).

- [ ] **Step 3: Add `interstitial` to `create_item`'s schema**

In `apps/mobile/src/services/ai/assistantTools.ts`, find the current `create_item` declaration:

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
        interstitial: { type: 'boolean', description: 'For tasks: true if this is a "downtime" task worked on in short sessions whenever there is spare time, rather than finished in one sitting.' },
      },
      required: ['type', 'title'],
    },
  },
```

- [ ] **Step 4: Add `taskId`/`taskTitle` to `log_action`'s schema**

Find the current `log_action` declaration:

```typescript
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
```

Change to:

```typescript
  {
    name: 'log_action',
    description:
      'Log a one-off Action — free-form activity not tied to a task/habit, e.g. practice sessions or general activity. Also use this to log a session against a Downtime task (taskId/taskTitle) — e.g. "I did 10 minutes on sorting the wardrobe".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title for the action.' },
        kind: { type: 'string', enum: ['practice', 'general'], description: '"practice" for skill/deliberate practice, otherwise "general".' },
        durationMinutes: { type: 'number', description: 'Optional duration in minutes.' },
        intensity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional intensity.' },
        taskId: { type: 'string', description: 'Optional: the id of a Downtime task this session counts toward.' },
        taskTitle: { type: 'string', description: "The task's title, for the confirmation prompt — required if taskId is set." },
      },
      required: ['title', 'kind'],
    },
  },
```

- [ ] **Step 5: Update both `previewAssistantTool` cases**

Find the `create_item` case:

```typescript
    case 'create_item': {
      let base = `Create ${args.type} ${quote(args.title)}`;
      if (args.durationMinutes) base += ` (${args.durationMinutes} min)`;
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
```

Change to:

```typescript
    case 'create_item': {
      let base = `Create ${args.type} ${quote(args.title)}`;
      if (args.durationMinutes) base += ` (${args.durationMinutes} min)`;
      if (args.interstitial) base += ' · downtime task';
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
```

Find the `log_action` case:

```typescript
    case 'log_action': {
      const base = `Log action ${quote(args.title)} (${args.kind}`;
      return args.durationMinutes ? `${base}, ${args.durationMinutes} min)` : `${base})`;
    }
```

Change to:

```typescript
    case 'log_action': {
      const base = `Log action ${quote(args.title)} (${args.kind}`;
      const withDuration = args.durationMinutes ? `${base}, ${args.durationMinutes} min)` : `${base})`;
      return args.taskTitle ? `${withDuration} → ${quote(args.taskTitle)}` : withDuration;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/mobile && npm test`
Expected: PASS — all tests including the 2 new ones.

- [ ] **Step 7: Wire `interstitial` through the `create_item` executor**

In `apps/mobile/src/services/ai/assistantToolExecutor.ts`, find the current `create_item` case:

```typescript
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        if (args.type === 'task' && typeof args.durationMinutes === 'number' && args.durationMinutes > 0) {
          updateItemMetadata(id, { durationMinutes: args.durationMinutes });
        }
        return { ok: true, result: `Created with id ${id}` };
      }
```

Change to (combining both metadata writes into one `updateItemMetadata` call — calling it twice would have the second call overwrite the first's write, since `updateItemMetadata` replaces the whole metadata object rather than merging):

```typescript
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        if (args.type === 'task') {
          const metaUpdates: Record<string, unknown> = {};
          if (typeof args.durationMinutes === 'number' && args.durationMinutes > 0) metaUpdates.durationMinutes = args.durationMinutes;
          if (args.interstitial === true) metaUpdates.interstitial = true;
          if (Object.keys(metaUpdates).length > 0) updateItemMetadata(id, metaUpdates);
        }
        return { ok: true, result: `Created with id ${id}` };
      }
```

- [ ] **Step 8: Wire `taskId` through the `log_action` executor**

Find the current `log_action` case:

```typescript
      case 'log_action': {
        logAction({
          title: args.title,
          kind: args.kind as ActionKind,
          durationMinutes: args.durationMinutes,
          intensity: args.intensity as ActionIntensity | undefined,
        });
        return { ok: true, result: 'Action logged' };
      }
```

Change to:

```typescript
      case 'log_action': {
        logAction({
          title: args.title,
          kind: args.kind as ActionKind,
          durationMinutes: args.durationMinutes,
          intensity: args.intensity as ActionIntensity | undefined,
          taskId: args.taskId,
        });
        return { ok: true, result: 'Action logged' };
      }
```

- [ ] **Step 9: Teach the day-planning system prompt about Downtime tasks**

In `apps/mobile/src/services/ai/assistant.ts`, find this exact text in the `PLANNING A DAY/EVENING` section:

```
said, ask whether it naturally breaks into sub-steps, and ask whether it depends on anything else in
the list being done first. Keep this natural and skip questions whose answer is already obvious or
```

Change to:

```
said, ask whether it naturally breaks into sub-steps, and ask whether it depends on anything else in
the list being done first. If a task sounds like it's done in short sessions whenever there's a spare
moment rather than in one sitting (e.g. "sort the wardrobe, maybe 10 minutes at a time"), ask that
instead of a fixed duration, and set interstitial: true on its create_item call rather than guessing a
total durationMinutes for the whole thing. Keep this natural and skip questions whose answer is already obvious or
```

Then find this exact text in the same section:

```
- create_item (type "task", with durationMinutes) for each top-level task, and set_task_priority for
  it if they gave you one.
```

Change to:

```
- create_item (type "task", with durationMinutes, or interstitial: true instead if it's a downtime/
  slots task) for each top-level task, and set_task_priority for it if they gave you one.
```

- [ ] **Step 10: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit`
Expected: no new errors near the touched files.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/services/ai/assistantTools.ts apps/mobile/src/services/ai/assistantTools.test.ts apps/mobile/src/services/ai/assistantToolExecutor.ts apps/mobile/src/services/ai/assistant.ts
git commit -m "$(cat <<'EOF'
feat: teach Sensei to tag and log Downtime tasks

create_item gains interstitial:true; log_action gains taskId/taskTitle
so a session can be logged against a Downtime task. The day-planning
prompt now asks about "done in slots" tasks the same way it already
asks about priority/duration/dependencies, using the wardrobe example
from the live conversation that prompted this feature.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Manual tagging — "Downtime task" toggle in the item editor

**Files:**
- Modify: `apps/mobile/src/components/item-composer/types.ts` (`ItemDraft`)
- Modify: `apps/mobile/src/components/item-composer/itemComposerPersistence.ts` (`createDraft`/`createEditDraft`/`mergedMetadata`)
- Modify: `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx` (toggle UI)

**Interfaces:**
- Consumes: nothing from prior tasks (this task doesn't touch Actions/assistant code).
- Produces: `ItemDraft.interstitial?: boolean` — consumed by Task 4 (log-session UI checks `draft.interstitial`).

- [ ] **Step 1: Add `interstitial` to `ItemDraft`**

In `apps/mobile/src/components/item-composer/types.ts`, find:

```typescript
  checklist: ChecklistItem[];
  priority?: ItemPriority;
  durationMinutes: number;
```

Change to:

```typescript
  checklist: ChecklistItem[];
  priority?: ItemPriority;
  interstitial?: boolean;
  durationMinutes: number;
```

- [ ] **Step 2: Read `interstitial` from metadata on edit, write it on save**

In `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, add a parse helper directly after `metadataPriority`:

```typescript
function metadataInterstitial(metadata: Record<string, unknown>): boolean | undefined {
  return metadata.interstitial === true ? true : undefined;
}
```

In `createEditDraft`, find:

```typescript
    tags: metadataTags(metadata),
    checklist: readChecklist(metadata),
    priority: metadataPriority(metadata),
```

Change to:

```typescript
    tags: metadataTags(metadata),
    checklist: readChecklist(metadata),
    priority: metadataPriority(metadata),
    interstitial: metadataInterstitial(metadata),
```

In `mergedMetadata`, find:

```typescript
  if (draft.priority) metadata.priority = draft.priority;
  else delete metadata.priority;
```

Change to:

```typescript
  if (draft.priority) metadata.priority = draft.priority;
  else delete metadata.priority;
  if (draft.interstitial) metadata.interstitial = true;
  else delete metadata.interstitial;
```

`createDraft` (the create-mode path) needs no change — `interstitial` is simply `undefined` by default on a fresh draft, same as `priority`.

- [ ] **Step 3: Add the toggle chip to `ItemEditorSheet.tsx`**

In `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`, find this exact block (the closing of the priority-chip row and its enclosing card section):

```typescript
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((priority) => {
                    const selected = draft.priority === priority.value;
                    const accent = priority.tone === 'quiet'
                      ? material.platinum
                      : priority.tone === 'warm'
                        ? material.accent
                        : palette.red;
                    return (
                      <TouchableOpacity
                        key={priority.value}
                        style={[styles.priorityChip, { backgroundColor: selected ? `${accent}20` : material.fill, borderColor: selected ? accent : 'transparent' }]}
                        onPress={() => onChange({ priority: selected ? undefined : priority.value })}
                      >
                        <Flag size={14} color={selected ? accent : palette.iconMuted} strokeWidth={1.8} />
                        <Text style={[styles.priorityText, { color: selected ? accent : palette.textSecondary }]}>{priority.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}
```

Change to (adding the toggle as a new row directly after `priorityRow`, still inside the same section, and only for tasks — `interstitial` is a task-only concept):

```typescript
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((priority) => {
                    const selected = draft.priority === priority.value;
                    const accent = priority.tone === 'quiet'
                      ? material.platinum
                      : priority.tone === 'warm'
                        ? material.accent
                        : palette.red;
                    return (
                      <TouchableOpacity
                        key={priority.value}
                        style={[styles.priorityChip, { backgroundColor: selected ? `${accent}20` : material.fill, borderColor: selected ? accent : 'transparent' }]}
                        onPress={() => onChange({ priority: selected ? undefined : priority.value })}
                      >
                        <Flag size={14} color={selected ? accent : palette.iconMuted} strokeWidth={1.8} />
                        <Text style={[styles.priorityText, { color: selected ? accent : palette.textSecondary }]}>{priority.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {draft.itemType === 'task' ? (
                  <TouchableOpacity
                    style={[styles.priorityChip, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: draft.interstitial ? `${material.accent}20` : material.fill, borderColor: draft.interstitial ? material.accent : 'transparent' }]}
                    onPress={() => onChange({ interstitial: !draft.interstitial })}
                  >
                    <Clock size={14} color={draft.interstitial ? material.accent : palette.iconMuted} strokeWidth={1.8} />
                    <Text style={[styles.priorityText, { color: draft.interstitial ? material.accent : palette.textSecondary }]}>Downtime task</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}
```

`Clock` is already imported at the top of this file (used elsewhere for time fields) — no new import needed.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit`
Expected: no new errors near the touched files.

- [ ] **Step 5: Manual verification**

No test harness for RN screens in this codebase. Verify by hand once on-device (can be done together with Task 4/5's verification): open any task's edit sheet, confirm a "Downtime task" chip appears below the priority row, toggling it doesn't error, and re-opening the same task after toggling shows the chip in its new state (confirms the metadata round-trips through `mergedMetadata`/`createEditDraft`).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/item-composer/types.ts apps/mobile/src/components/item-composer/itemComposerPersistence.ts apps/mobile/src/components/item-composer/ItemEditorSheet.tsx
git commit -m "$(cat <<'EOF'
feat: manual Downtime task toggle in the item editor

A "Downtime task" chip next to priority in the task edit sheet, so any
task can be tagged/untagged by hand — same metadata.interstitial flag
the assistant's create_item tool now sets.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Log-session UI and history in the item editor

**Files:**
- Modify: `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`

**Interfaces:**
- Consumes: `getActionsForTask`, `ActionRow` type (Task 1), `logAction` (already exists), `ItemDraft.interstitial`/`draft.itemId` (Task 3).
- Produces: nothing new exported — visual/interactive addition only.

- [ ] **Step 1: Add imports and session-history state**

In `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`, find the existing database import:

```typescript
import { getItemsByType, formatDate } from '../../db/database';
```

Change to:

```typescript
import { getItemsByType, formatDate, getActionsForTask, logAction } from '../../db/database';
```

Find the existing `import { getItemComposerMaterial, getThemeColors, radius, spacing } from '../../theme';` line and add a new import directly after it:

```typescript
import type { ActionRow } from '../../utils/actions';
```

Find the hook declarations near the top of the component body:

```typescript
  const [view, setView] = useState<EditorView>('form');
  const [tagDraft, setTagDraft] = useState('');
  const [checklistDraft, setChecklistDraft] = useState('');
```

Change to:

```typescript
  const [view, setView] = useState<EditorView>('form');
  const [tagDraft, setTagDraft] = useState('');
  const [checklistDraft, setChecklistDraft] = useState('');
  const [downtimeSessions, setDowntimeSessions] = useState<ActionRow[]>([]);
```

React hooks must run unconditionally on every render in the same order, and every other hook in this component (the `useState` calls above, including the `downtimeSessions` one you just added) is declared before the `if (!draft) return null;` line — so this new `useEffect` must also go there, before the guard, not after it. Find the `if (!draft) return null;` line and add the `useEffect` directly **before** it (guarding the body with its own `if (!draft)` check instead of relying on the outer guard, since the outer guard is below this point):

```typescript
  useEffect(() => {
    if (!draft || !(visible && draft.mode === 'edit' && draft.itemId && draft.interstitial)) {
      setDowntimeSessions([]);
      return;
    }
    setDowntimeSessions(getActionsForTask(draft.itemId));
  }, [visible, draft?.mode, draft?.itemId, draft?.interstitial]);

  if (!draft) return null;
```

Confirm `useEffect` is already imported from `react` at the top of the file — if not present, add it to the existing React import.

- [ ] **Step 2: Add the log-session card to the render**

Find this exact block (the toggle chip added in Task 3, and the error text right after it):

```typescript
                {draft.itemType === 'task' ? (
                  <TouchableOpacity
                    style={[styles.priorityChip, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: draft.interstitial ? `${material.accent}20` : material.fill, borderColor: draft.interstitial ? material.accent : 'transparent' }]}
                    onPress={() => onChange({ interstitial: !draft.interstitial })}
                  >
                    <Clock size={14} color={draft.interstitial ? material.accent : palette.iconMuted} strokeWidth={1.8} />
                    <Text style={[styles.priorityText, { color: draft.interstitial ? material.accent : palette.textSecondary }]}>Downtime task</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}
```

Change to:

```typescript
                {draft.itemType === 'task' ? (
                  <TouchableOpacity
                    style={[styles.priorityChip, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: draft.interstitial ? `${material.accent}20` : material.fill, borderColor: draft.interstitial ? material.accent : 'transparent' }]}
                    onPress={() => onChange({ interstitial: !draft.interstitial })}
                  >
                    <Clock size={14} color={draft.interstitial ? material.accent : palette.iconMuted} strokeWidth={1.8} />
                    <Text style={[styles.priorityText, { color: draft.interstitial ? material.accent : palette.textSecondary }]}>Downtime task</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {draft.mode === 'edit' && draft.interstitial && draft.itemId ? (
                <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim, marginTop: 12 }]}>
                  <TouchableOpacity
                    style={styles.navigationRow}
                    onPress={() => {
                      const itemId = draft.itemId!;
                      const itemTitle = draft.title;
                      Alert.prompt(
                        'Log a session',
                        'Minutes spent (optional)',
                        (text) => {
                          const minutes = text ? parseInt(text, 10) : undefined;
                          logAction({
                            title: itemTitle || 'Downtime session',
                            kind: 'general',
                            durationMinutes: minutes && minutes > 0 ? minutes : undefined,
                            taskId: itemId,
                          });
                          setDowntimeSessions(getActionsForTask(itemId));
                        },
                        'plain-text'
                      );
                    }}
                  >
                    <View style={styles.rowLabelWithIcon}>
                      <Clock size={20} color={palette.iconMuted} strokeWidth={1.8} />
                      <Text style={[styles.fieldLabel, { color: palette.text }]}>Log a session</Text>
                    </View>
                    <Text style={[styles.trailingValue, { color: palette.textMuted }]}>+</Text>
                  </TouchableOpacity>
                  {downtimeSessions.length > 0 ? (
                    <>
                      <View style={[styles.separator, { backgroundColor: material.rim }]} />
                      {downtimeSessions.slice(0, 3).map((session) => (
                        <Text
                          key={session.id}
                          style={[styles.trailingValue, { color: palette.textMuted, paddingVertical: 4, textAlign: 'left' }]}
                        >
                          {session.durationMinutes ? `${session.durationMinutes} min` : 'Session'} · {new Date(session.timestamp).toLocaleString()}
                        </Text>
                      ))}
                    </>
                  ) : null}
                </View>
              ) : null}

              {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}
```

Confirm `Alert` is already imported from `react-native` at the top of this file (it is, used elsewhere in the component) — no new import needed.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit`
Expected: no new errors near `ItemEditorSheet.tsx`. Pay particular attention to hook-order errors (React's exhaustive-deps/rules-of-hooks) — if `tsc` doesn't catch it, re-read the file to confirm every `useState`/`useEffect`/`useMemo` in this component runs before the `if (!draft) return null;` line, with no hook call after it.

- [ ] **Step 4: Manual verification**

No test harness for RN screens. Verify by hand on-device: mark a task as a Downtime task (Task 3's toggle), confirm the "Log a session" row appears, tap it, enter a number in the prompt, confirm a new line appears in the session history below (newest first, capped at 3), and confirm the task's own completion control still works normally regardless of how many sessions are logged.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/item-composer/ItemEditorSheet.tsx
git commit -m "$(cat <<'EOF'
feat: log-session control and history for Downtime tasks

A "Log a session" row (Alert.prompt for optional minutes, matching the
existing lightweight-capture convention used elsewhere in this
codebase) plus a capped recent-sessions list, shown only when a task
is tagged interstitial. No target, no remaining-time math — just a
growing history, per the spec's "just tap it" model.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Home "Downtime" section

**Files:**
- Create: `apps/mobile/src/components/home/DowntimeShelf.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `getInterstitialTasks` (Task 1), `getActionsForTask` (Task 1, for sort order).
- Produces: `export function DowntimeShelf({ isDark, onOpen }: { isDark: boolean; onOpen: (item: Item) => void }): JSX.Element | null` — consumed by `HomeScreen.tsx`.

- [ ] **Step 1: Create `DowntimeShelf.tsx`**

Write `apps/mobile/src/components/home/DowntimeShelf.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock } from '../../icons';
import { getThemeColors } from '../../theme';
import { getInterstitialTasks, getActionsForTask } from '../../db/database';
import type { Item } from '../../db/types';

interface DowntimeShelfProps {
  isDark: boolean;
  onOpen: (item: Item) => void;
}

const MAX_ROWS = 4;

// Small always-visible Home nudge for tasks worked on in short sessions
// whenever there's spare time (metadata.interstitial) — sorted by whichever
// was most recently chipped away at, so an in-progress one stays on top.
// Renders nothing when there are none, same as the other optional Home
// widgets (e.g. PlanBackwardsCountdownWidget with no upcoming plan).
export function DowntimeShelf({ isDark, onOpen }: DowntimeShelfProps) {
  const palette = getThemeColors(isDark);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const tasks = getInterstitialTasks();
    const withLastLogged = tasks.map((item) => {
      const sessions = getActionsForTask(item.id);
      return { item, lastLogged: sessions.length > 0 ? sessions[0].timestamp : item.createdAt };
    });
    withLastLogged.sort((a, b) => b.lastLogged - a.lastLogged);
    setItems(withLastLogged.slice(0, MAX_ROWS).map((x) => x.item));
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: palette.textSecondary }]}>DOWNTIME</Text>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: palette.separator }]}
            activeOpacity={0.7}
            onPress={() => onOpen(item)}
          >
            <Clock size={16} color={palette.iconMuted} strokeWidth={1.8} />
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    flex: 1,
  },
});
```

Confirm `Clock` is exported from `../../icons` (already used the same way in `ItemEditorSheet.tsx` and elsewhere) and `palette.iconMuted`/`palette.separator` exist on the theme palette (already used by `TodayCard.tsx`/other Home widgets) — no new theme tokens needed.

- [ ] **Step 2: Wire it into `HomeScreen.tsx`**

In `apps/mobile/src/screens/HomeScreen.tsx`, add the import alongside the other Home widget imports:

```typescript
import { TodayCard } from '../components/home/TodayCard';
```

Change to:

```typescript
import { TodayCard } from '../components/home/TodayCard';
import { DowntimeShelf } from '../components/home/DowntimeShelf';
```

Find this exact block:

```typescript
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        <TodayCard
          items={visibleTodayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          isDark={isDark}
        />
        </>
        )}
```

Change to:

```typescript
        <HabitsWidget habits={todayHabits} refresh={refreshHabits} isDark={isDark} />

        <TodayCard
          items={visibleTodayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          isDark={isDark}
        />

        <DowntimeShelf isDark={isDark} onOpen={handleItemTap} />
        </>
        )}
```

`handleItemTap` is already defined in this component (used by `TodayCard`'s `onOpen` just above) and opens the item editor — reusing it means tapping a Downtime task on Home opens the same edit sheet Task 3/4 built the toggle and log control into.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit`
Expected: no new errors near `DowntimeShelf.tsx`/`HomeScreen.tsx`.

- [ ] **Step 4: Manual verification**

No test harness for RN screens. Verify by hand on-device: with no Downtime tasks, confirm the section doesn't render at all on Home. Tag a task as Downtime (Task 3), confirm a "DOWNTIME" section appears on Home showing it, log a session against it (Task 4) and a second Downtime task, confirm the more-recently-logged one sorts first, and confirm tapping a row opens that task's edit sheet.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/DowntimeShelf.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "$(cat <<'EOF'
feat: Downtime section on Home

A small always-visible nudge listing tasks tagged interstitial, sorted
by most-recently-logged, so a spare few minutes has something to
prompt. Renders nothing when there are none, matching the empty-state
convention of Home's other optional widgets.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Log the native-only gap in `WEB_PARITY.md`

**Files:**
- Modify: `apps/mobile/WEB_PARITY.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a parity entry**

In `apps/mobile/WEB_PARITY.md`, find the existing `**Conversational day planning — native-only gap (2026-08-16):**` paragraph (added by the prior day-planning feature) and add a new paragraph directly after it:

```markdown
**Downtime Tasks — native-only gap (2026-08-16):** 🟡 A new lightweight interstitial task type
(`metadata.interstitial` on a Task, sessions logged via the existing Actions model's new `taskId`
field) shipped native-only: the "Downtime task" toggle + session log in the item editor, the Home
"DOWNTIME" section (`DowntimeShelf.tsx`), and Sensei's `create_item`/`log_action` support for it.
Not ported to web — same deliberate native-only scope as the conversational day-planning feature
above, not yet closed. See `docs/superpowers/specs/2026-08-16-downtime-tasks-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/WEB_PARITY.md
git commit -m "$(cat <<'EOF'
docs: log Downtime Tasks as a native-only gap in WEB_PARITY.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

- **Automated:** `actions.test.ts` covers `parseActionRow`'s new `taskId` field; `assistantTools.test.ts` covers the new `interstitial`/`taskId` preview strings. No automated coverage for `database.ts`, `item-composer/*`, or `HomeScreen.tsx`/`DowntimeShelf.tsx` — consistent with this codebase's existing bar (RN screens and SQLite-backed `database.ts` aren't unit-testable under plain Node here); `tsc --noEmit` plus manual on-device verification is the existing standard for those layers.
- **Manual, end-to-end (once all 6 tasks are committed):** on-device, mark a task Downtime via the toggle, log two sessions with different minute values, confirm the history shows both newest-first; confirm the task still completes normally via its regular control; confirm it appears in Home's Downtime section sorted correctly and disappears from there once completed (since `getInterstitialTasks` filters `status NOT IN ('completed', 'inbox')`); then try it conversationally — tell Sensei about a task "done in slots" (the wardrobe example) and confirm it proposes `create_item` with `interstitial: true` rather than a fixed `durationMinutes`.
