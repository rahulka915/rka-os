# Inbox Triage Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "tap an Inbox item → open the generic task editor" behavior with a guided, single-question-at-a-time Triage Mode overlay that processes the whole unprocessed queue in a fast, card-stack session.

**Architecture:** A pure reducer (`triageReducer`) drives step transitions and answer state with zero side effects — fully unit-testable, mirroring the existing `voiceCaptureReducer` pattern in this codebase. A thin hook (`useTriageSession`) wraps the reducer with the two DB writes the flow needs (reusing existing primitives: `processInboxItem`, plus one new composed write, `applyTaskTriage`). A full-screen overlay (`TriageOverlay`), rendered via the existing `useOverlayHost` mechanism (same pattern as `VoiceCaptureOverlay`), presents one step component at a time.

**Tech Stack:** React Native + Expo (existing app), `useReducer`, Reanimated (already a dependency, no new packages), Node's built-in test runner (`node --test`) for the pure reducer.

## Global Constraints

- No new npm dependencies (no confetti/particle library — Reanimated + haptics only, per the approved spec).
- Priority uses the existing 3-value scale (`'low' | 'medium' | 'high'`), not a 4th "Critical" level.
- "This week" sets `status: 'active'` with no `scheduledDate` and `metadata.gtdContext: 'week'` — it does not auto-pick a specific date.
- No Tags step, no Object sub-questions beyond marking it a wishlist item, no swipe gestures, no cross-item undo, no streaks — all explicitly out of scope per the approved spec (`docs/superpowers/specs/2026-07-25-inbox-triage-mode-design.md`).
- Visual style follows the existing `itemComposerMaterial.dark` tokens (`src/theme/itemComposer.ts`) and `spacing`/`fontSize`/`radius` scale (`src/theme/spacing.ts`) — the same tokens `VoiceCaptureOverlay` and `CaptureMethodMenu` already use, unconditionally dark regardless of the app's light/dark setting (matches the sibling capture overlay).
- This app has no automated UI-component or hook test setup (only pure `.ts` logic gets `node --test` coverage, per existing precedent — `voiceCaptureReducer.test.ts` is tested, `useVoiceCapture.ts` is not). Follow the same split here: the reducer gets tests, the hook and components get `npx tsc --noEmit` + manual on-device verification.
- Run `cd apps/mobile && npx tsc --noEmit` after every code task — it must stay clean throughout.

---

### Task 1: Pure triage state machine

**Files:**
- Create: `apps/mobile/src/state/triageReducer.ts`
- Test: `apps/mobile/src/state/triageReducer.test.ts`

**Interfaces:**
- Produces (used by Task 3):
  - `type TriageStep = 'type' | 'importance' | 'when' | 'project' | 'review'`
  - `type TriageWhen = 'today' | 'tomorrow' | 'week' | 'someday'`
  - `type TriagePriority = 'low' | 'medium' | 'high'`
  - `type TriageAnswers = { priority: TriagePriority | null; when: TriageWhen | null; projectId: string | null }`
  - `type TriageSessionState = { queue: Item[]; step: TriageStep; answers: TriageAnswers; processedCount: number }`
  - `type TriageAction = { type: 'CHOOSE_TASK' } | { type: 'ANSWER_IMPORTANCE'; value: TriagePriority } | { type: 'ANSWER_WHEN'; value: TriageWhen } | { type: 'ANSWER_PROJECT'; value: string | null } | { type: 'BACK' } | { type: 'ADVANCE' }`
  - `buildTriageQueue(tappedItem: Item, allItems: Item[]): Item[]`
  - `createInitialTriageState(queue: Item[]): TriageSessionState`
  - `triageReducer(state: TriageSessionState, action: TriageAction): TriageSessionState`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/state/triageReducer.test.ts`:

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  triageReducer,
  createInitialTriageState,
  buildTriageQueue,
} from './triageReducer.ts';

function makeItem(id) {
  return {
    id,
    type: 'task',
    title: `Item ${id}`,
    status: 'inbox',
    createdAt: 0,
    updatedAt: 0,
  };
}

// ── buildTriageQueue ─────────────────────────────────────────────────────

test('buildTriageQueue puts the tapped item first, then the rest in order', () => {
  const a = makeItem('a');
  const b = makeItem('b');
  const c = makeItem('c');
  const queue = buildTriageQueue(b, [a, b, c]);
  assert.deepEqual(queue.map((i) => i.id), ['b', 'a', 'c']);
});

test('buildTriageQueue with a single item returns just that item', () => {
  const a = makeItem('a');
  const queue = buildTriageQueue(a, [a]);
  assert.deepEqual(queue.map((i) => i.id), ['a']);
});

// ── createInitialTriageState ─────────────────────────────────────────────

test('createInitialTriageState starts on the type step with empty answers', () => {
  const queue = [makeItem('a'), makeItem('b')];
  const state = createInitialTriageState(queue);
  assert.equal(state.step, 'type');
  assert.equal(state.queue.length, 2);
  assert.equal(state.answers.priority, null);
  assert.equal(state.answers.when, null);
  assert.equal(state.answers.projectId, null);
  assert.equal(state.processedCount, 0);
});

// ── CHOOSE_TASK ───────────────────────────────────────────────────────────

test('CHOOSE_TASK from type step moves to importance', () => {
  const state = createInitialTriageState([makeItem('a')]);
  const next = triageReducer(state, { type: 'CHOOSE_TASK' });
  assert.equal(next.step, 'importance');
});

test('CHOOSE_TASK is a no-op outside the type step', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'when' };
  const next = triageReducer(state, { type: 'CHOOSE_TASK' });
  assert.equal(next.step, 'when');
});

// ── ANSWER_IMPORTANCE ─────────────────────────────────────────────────────

test('ANSWER_IMPORTANCE from importance step records the value and moves to when', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'importance' };
  const next = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'high' });
  assert.equal(next.step, 'when');
  assert.equal(next.answers.priority, 'high');
});

test('ANSWER_IMPORTANCE is a no-op outside the importance step', () => {
  const state = createInitialTriageState([makeItem('a')]); // step: 'type'
  const next = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'high' });
  assert.equal(next.step, 'type');
  assert.equal(next.answers.priority, null);
});

// ── ANSWER_WHEN ───────────────────────────────────────────────────────────

test('ANSWER_WHEN from when step records the value and moves to project', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'when' };
  const next = triageReducer(state, { type: 'ANSWER_WHEN', value: 'tomorrow' });
  assert.equal(next.step, 'project');
  assert.equal(next.answers.when, 'tomorrow');
});

// ── ANSWER_PROJECT ────────────────────────────────────────────────────────

test('ANSWER_PROJECT from project step records the value and moves to review', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'project' };
  const next = triageReducer(state, { type: 'ANSWER_PROJECT', value: 'proj-1' });
  assert.equal(next.step, 'review');
  assert.equal(next.answers.projectId, 'proj-1');
});

test('ANSWER_PROJECT accepts null (no project chosen)', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'project' };
  const next = triageReducer(state, { type: 'ANSWER_PROJECT', value: null });
  assert.equal(next.step, 'review');
  assert.equal(next.answers.projectId, null);
});

// ── BACK ──────────────────────────────────────────────────────────────────

test('BACK steps back through the sequence: review -> project -> when -> importance -> type', () => {
  let state = { ...createInitialTriageState([makeItem('a')]), step: 'review' };
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'project');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'when');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'importance');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'type');
});

test('BACK on the type step is a no-op (nothing before it)', () => {
  const state = createInitialTriageState([makeItem('a')]); // step: 'type'
  const next = triageReducer(state, { type: 'BACK' });
  assert.equal(next.step, 'type');
});

// ── ADVANCE ───────────────────────────────────────────────────────────────

test('ADVANCE pops the current item, resets step and answers, bumps processedCount', () => {
  const a = makeItem('a');
  const b = makeItem('b');
  let state = createInitialTriageState([a, b]);
  state = triageReducer(state, { type: 'CHOOSE_TASK' });
  state = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'low' });
  const next = triageReducer(state, { type: 'ADVANCE' });
  assert.deepEqual(next.queue.map((i) => i.id), ['b']);
  assert.equal(next.step, 'type');
  assert.equal(next.answers.priority, null);
  assert.equal(next.processedCount, 1);
});

test('ADVANCE on the last item leaves an empty queue', () => {
  const a = makeItem('a');
  let state = createInitialTriageState([a]);
  const next = triageReducer(state, { type: 'ADVANCE' });
  assert.equal(next.queue.length, 0);
  assert.equal(next.processedCount, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

The project's `npm test` script runs every `src/**/*.test.ts` file at once — run this new file directly with Node instead so the failure is unambiguous:

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/state/triageReducer.test.ts`

Expected: FAIL — `Cannot find module './triageReducer.ts'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/state/triageReducer.ts`:

```typescript
import type { Item } from '../db/types';

export type TriageStep = 'type' | 'importance' | 'when' | 'project' | 'review';

export type TriageWhen = 'today' | 'tomorrow' | 'week' | 'someday';

export type TriagePriority = 'low' | 'medium' | 'high';

export type TriageAnswers = {
  priority: TriagePriority | null;
  when: TriageWhen | null;
  projectId: string | null;
};

export type TriageSessionState = {
  queue: Item[];
  step: TriageStep;
  answers: TriageAnswers;
  processedCount: number;
};

export type TriageAction =
  | { type: 'CHOOSE_TASK' }
  | { type: 'ANSWER_IMPORTANCE'; value: TriagePriority }
  | { type: 'ANSWER_WHEN'; value: TriageWhen }
  | { type: 'ANSWER_PROJECT'; value: string | null }
  | { type: 'BACK' }
  | { type: 'ADVANCE' };

const STEP_ORDER: TriageStep[] = ['type', 'importance', 'when', 'project', 'review'];

const initialTriageAnswers: TriageAnswers = {
  priority: null,
  when: null,
  projectId: null,
};

// Session queue = the current Inbox list order, with the tapped item moved to
// the front — so the card the user actually tapped is the first one shown,
// and the rest of the queue still follows the list's existing order.
export function buildTriageQueue(tappedItem: Item, allItems: Item[]): Item[] {
  const rest = allItems.filter((item) => item.id !== tappedItem.id);
  return [tappedItem, ...rest];
}

export function createInitialTriageState(queue: Item[]): TriageSessionState {
  return {
    queue,
    step: 'type',
    answers: { ...initialTriageAnswers },
    processedCount: 0,
  };
}

export function triageReducer(s: TriageSessionState, a: TriageAction): TriageSessionState {
  switch (a.type) {
    case 'CHOOSE_TASK':
      if (s.step !== 'type') return s;
      return { ...s, step: 'importance' };

    case 'ANSWER_IMPORTANCE':
      if (s.step !== 'importance') return s;
      return { ...s, step: 'when', answers: { ...s.answers, priority: a.value } };

    case 'ANSWER_WHEN':
      if (s.step !== 'when') return s;
      return { ...s, step: 'project', answers: { ...s.answers, when: a.value } };

    case 'ANSWER_PROJECT':
      if (s.step !== 'project') return s;
      return { ...s, step: 'review', answers: { ...s.answers, projectId: a.value } };

    case 'BACK': {
      const index = STEP_ORDER.indexOf(s.step);
      if (index <= 0) return s;
      return { ...s, step: STEP_ORDER[index - 1] };
    }

    // The Object branch never touches this reducer (see useTriageSession) —
    // it writes straight to the DB, then dispatches ADVANCE like any
    // confirmed Task card.
    case 'ADVANCE':
      return {
        ...s,
        queue: s.queue.slice(1),
        step: 'type',
        answers: { ...initialTriageAnswers },
        processedCount: s.processedCount + 1,
      };

    default:
      return s;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/state/triageReducer.test.ts`

Expected: all tests PASS (16 tests, 0 failures).

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/state/triageReducer.ts apps/mobile/src/state/triageReducer.test.ts
git commit -m "feat(mobile): add pure Inbox Triage Mode state machine"
```

---

### Task 2: DB persistence for a confirmed Task triage decision

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (add a new function directly after `processInboxItem`, which ends around line 1329)

**Interfaces:**
- Consumes: `getItemWithMetadata(id: string): Item | null`, `updateItem(id, updates)`, `updateItemMetadata(id, metadata)`, `setRelation(sourceId, relationType, targetId)`, `formatDate(date: Date): string`, `logActivity(entityId, actionType, details?)` — all already defined earlier in this same file.
- Produces (used by Task 3): `applyTaskTriage(id: string, decision: { priority: 'low' | 'medium' | 'high'; when: 'today' | 'tomorrow' | 'week' | 'someday'; projectId: string | null }): void`

This function has no automated test — it does real SQLite writes via `expo-sqlite`, which isn't available under Node's test runner. Every other DB-writing function in this file (`processInboxItem`, `planForToday`, `saveItemDraft`'s callees) follows the same convention: untested here, verified manually on-device. Manual verification happens in Task 6, once the full flow is wired up.

- [ ] **Step 1: Read the surrounding code**

Open `apps/mobile/src/db/database.ts` and find `processInboxItem` (search for `export function processInboxItem`). Note its closing `}` and the `logActivity(id, 'status-changed', JSON.stringify({ destination }));` line right before it — the new function goes directly after that closing brace, before the `// ── Instances ──` section comment.

- [ ] **Step 2: Add the function**

Insert this immediately after `processInboxItem`'s closing brace:

```typescript
// Confirmed Task-branch decision from Inbox Triage Mode (see useTriageSession).
// Three separate writes, same composable pattern saveItemDraft already uses
// (updateItem for status/scheduledDate, updateItemMetadata for the metadata
// blob, setRelation for the project link) rather than processInboxItem's
// single-statement style — triage has richer combined state than a single
// GTD destination.
export function applyTaskTriage(
  id: string,
  decision: {
    priority: 'low' | 'medium' | 'high';
    when: 'today' | 'tomorrow' | 'week' | 'someday';
    projectId: string | null;
  },
): void {
  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  meta.priority = decision.priority;

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  switch (decision.when) {
    case 'today':
      updateItem(id, { status: 'active', scheduledDate: today });
      break;
    case 'tomorrow':
      updateItem(id, { status: 'active', scheduledDate: tomorrow });
      break;
    case 'week':
      meta.gtdContext = 'week';
      updateItem(id, { status: 'active', scheduledDate: null });
      break;
    case 'someday':
      updateItem(id, { status: 'someday', scheduledDate: null });
      break;
  }

  updateItemMetadata(id, meta);
  setRelation(id, 'project', decision.projectId);
  logActivity(id, 'status-changed', JSON.stringify({ destination: 'triage-task', ...decision }));
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors. (This confirms `updateItem`'s `scheduledDate: string | null` and `status: Item['status']` accept `'active'`/`'someday'`/dates/`null` as used above, and that `formatDate`, `getItemWithMetadata`, `updateItemMetadata`, `setRelation`, `logActivity` are all in scope in this file already.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/database.ts
git commit -m "feat(mobile): add applyTaskTriage DB write for Inbox Triage Mode"
```

---

### Task 3: useTriageSession hook

**Files:**
- Create: `apps/mobile/src/hooks/useTriageSession.ts`

**Interfaces:**
- Consumes:
  - From Task 1 (`../state/triageReducer`): `triageReducer`, `createInitialTriageState`, `buildTriageQueue`, and types `TriageStep`, `TriageAnswers`, `TriagePriority`, `TriageWhen`.
  - From Task 2 (`../db/database`): `applyTaskTriage`, `processInboxItem`, `getItemsByType`.
  - From `../db/types`: `Item`.
- Produces (used by Tasks 5 & 6):

```typescript
export type UseTriageSessionReturn = {
  currentItem: Item | null;
  remaining: number;
  processedCount: number;
  step: TriageStep;
  answers: TriageAnswers;
  projects: Item[];
  chooseObject: () => void;
  chooseTask: () => void;
  answerImportance: (value: TriagePriority) => void;
  answerWhen: (value: TriageWhen) => void;
  answerProject: (projectId: string | null) => void;
  back: () => void;
  confirm: () => void;
};

export function useTriageSession(tappedItem: Item, allItems: Item[]): UseTriageSessionReturn
```

- `currentItem` is `state.queue[0] ?? null` — `null` means the session is complete (render `TriageComplete`, Task 5).
- `chooseObject()` writes immediately via `processInboxItem(currentItem.id, 'object')` then dispatches `ADVANCE` — it does not go through `CHOOSE_TASK`/step transitions at all.
- `confirm()` only acts if `currentItem`, `answers.priority`, and `answers.when` are all set (i.e. called from the Review step, where that's guaranteed) — calls `applyTaskTriage` then dispatches `ADVANCE`.

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/src/hooks/useTriageSession.ts`:

```typescript
import { useCallback, useMemo, useReducer } from 'react';
import {
  triageReducer,
  createInitialTriageState,
  buildTriageQueue,
  type TriageStep,
  type TriageAnswers,
  type TriagePriority,
  type TriageWhen,
} from '../state/triageReducer';
import { applyTaskTriage, processInboxItem, getItemsByType } from '../db/database';
import type { Item } from '../db/types';

export type UseTriageSessionReturn = {
  currentItem: Item | null;
  remaining: number;
  processedCount: number;
  step: TriageStep;
  answers: TriageAnswers;
  projects: Item[];
  chooseObject: () => void;
  chooseTask: () => void;
  answerImportance: (value: TriagePriority) => void;
  answerWhen: (value: TriageWhen) => void;
  answerProject: (projectId: string | null) => void;
  back: () => void;
  confirm: () => void;
};

export function useTriageSession(tappedItem: Item, allItems: Item[]): UseTriageSessionReturn {
  // Seeded once per session — allItems is the Inbox list snapshot at the
  // moment the session opened; items processed during the session are
  // removed from the reducer's own queue, not refetched from this list.
  const initialQueue = useMemo(
    () => buildTriageQueue(tappedItem, allItems),
    [tappedItem, allItems],
  );
  const [state, dispatch] = useReducer(triageReducer, initialQueue, createInitialTriageState);

  // Same picker source ItemEditorSheet's Mission picker already uses.
  const projects = useMemo(
    () => getItemsByType('project').filter((item) => !item.deletedAt),
    [],
  );

  const currentItem = state.queue[0] ?? null;

  const chooseObject = useCallback(() => {
    if (!currentItem) return;
    processInboxItem(currentItem.id, 'object');
    dispatch({ type: 'ADVANCE' });
  }, [currentItem]);

  const chooseTask = useCallback(() => {
    dispatch({ type: 'CHOOSE_TASK' });
  }, []);

  const answerImportance = useCallback((value: TriagePriority) => {
    dispatch({ type: 'ANSWER_IMPORTANCE', value });
  }, []);

  const answerWhen = useCallback((value: TriageWhen) => {
    dispatch({ type: 'ANSWER_WHEN', value });
  }, []);

  const answerProject = useCallback((projectId: string | null) => {
    dispatch({ type: 'ANSWER_PROJECT', value: projectId });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  const confirm = useCallback(() => {
    if (!currentItem || !state.answers.priority || !state.answers.when) return;
    applyTaskTriage(currentItem.id, {
      priority: state.answers.priority,
      when: state.answers.when,
      projectId: state.answers.projectId,
    });
    dispatch({ type: 'ADVANCE' });
  }, [currentItem, state.answers]);

  return {
    currentItem,
    remaining: state.queue.length,
    processedCount: state.processedCount,
    step: state.step,
    answers: state.answers,
    projects,
    chooseObject,
    chooseTask,
    answerImportance,
    answerWhen,
    answerProject,
    back,
    confirm,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useTriageSession.ts
git commit -m "feat(mobile): add useTriageSession hook wiring the triage state machine to the DB"
```

---

### Task 4: Step UI kit (shared row, labels, and the 5 step components)

**Files:**
- Create: `apps/mobile/src/components/triage/triageLabels.ts`
- Create: `apps/mobile/src/components/triage/TriageOptionRow.tsx`
- Create: `apps/mobile/src/components/triage/steps/TypeStep.tsx`
- Create: `apps/mobile/src/components/triage/steps/ImportanceStep.tsx`
- Create: `apps/mobile/src/components/triage/steps/WhenStep.tsx`
- Create: `apps/mobile/src/components/triage/steps/ProjectStep.tsx`
- Create: `apps/mobile/src/components/triage/steps/ReviewStep.tsx`

**Interfaces:**
- Consumes: `itemComposerMaterial` (`../../theme/itemComposer`), `spacing`/`fontSize`/`radius` (`../../theme/spacing`), icons from `../../icons`, and from Task 1's types (`TriagePriority`, `TriageWhen`).
- Produces (used by Task 5):
  - `PRIORITY_LABELS: Record<TriagePriority, string>`, `WHEN_LABELS: Record<TriageWhen, string>` from `triageLabels.ts`
  - `<TriageOptionRow label hint? selected? onPress />`
  - `<TypeStep itemTitle onChooseTask onChooseObject />`
  - `<ImportanceStep onAnswer={(value: TriagePriority) => void} />`
  - `<WhenStep onAnswer={(value: TriageWhen) => void} />`
  - `<ProjectStep projects={Item[]} selectedProjectId={string | null} onAnswer={(projectId: string | null) => void} />`
  - `<ReviewStep priority={TriagePriority} when={TriageWhen} projectTitle={string | null} onConfirm={() => void} />`

- [ ] **Step 1: Shared labels**

Create `apps/mobile/src/components/triage/triageLabels.ts`:

```typescript
import type { TriagePriority, TriageWhen } from '../../state/triageReducer';

export const PRIORITY_LABELS: Record<TriagePriority, string> = {
  low: 'Low',
  medium: 'Normal',
  high: 'High',
};

export const WHEN_LABELS: Record<TriageWhen, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  someday: 'Someday',
};
```

- [ ] **Step 2: Shared option row**

Create `apps/mobile/src/components/triage/TriageOptionRow.tsx`:

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { Check } from '../../icons';

interface TriageOptionRowProps {
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
}

export function TriageOptionRow({ label, hint, selected, onPress }: TriageOptionRowProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <TouchableOpacity
      style={[
        styles.option,
        {
          backgroundColor: selected ? mat.accentSoft : mat.surfaceRaised,
          borderColor: selected ? mat.rimStrong : mat.rim,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: mat.platinum }]}>{label}</Text>
        {hint ? <Text style={[styles.optionHint, { color: mat.platinumMuted }]}>{hint}</Text> : null}
      </View>
      {selected ? <Check size={18} color={mat.accent} strokeWidth={2.4} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    marginBottom: spacing[3],
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: fontSize.lg, fontWeight: '600' },
  optionHint: { fontSize: fontSize.sm, marginTop: 2 },
});
```

- [ ] **Step 3: Type step**

Create `apps/mobile/src/components/triage/steps/TypeStep.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';

interface TypeStepProps {
  itemTitle: string;
  onChooseTask: () => void;
  onChooseObject: () => void;
}

export function TypeStep({ itemTitle, onChooseTask, onChooseObject }: TypeStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>What is this?</Text>
      <Text style={[styles.itemTitle, { color: mat.platinumMuted }]} numberOfLines={2}>
        {itemTitle}
      </Text>
      <TriageOptionRow
        label="Task"
        hint="Something that needs an action"
        onPress={onChooseTask}
      />
      <TriageOptionRow
        label="Object"
        hint="Something to own, save, or collect"
        onPress={onChooseObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[2] },
  itemTitle: { fontSize: fontSize.base, marginBottom: spacing[5] },
});
```

- [ ] **Step 4: Importance step**

Create `apps/mobile/src/components/triage/steps/ImportanceStep.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import { PRIORITY_LABELS } from '../triageLabels';
import type { TriagePriority } from '../../../state/triageReducer';

interface ImportanceStepProps {
  onAnswer: (value: TriagePriority) => void;
}

const OPTIONS: TriagePriority[] = ['low', 'medium', 'high'];

export function ImportanceStep({ onAnswer }: ImportanceStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>How important is this?</Text>
      {OPTIONS.map((value) => (
        <TriageOptionRow key={value} label={PRIORITY_LABELS[value]} onPress={() => onAnswer(value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
```

- [ ] **Step 5: When step**

Create `apps/mobile/src/components/triage/steps/WhenStep.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import { WHEN_LABELS } from '../triageLabels';
import type { TriageWhen } from '../../../state/triageReducer';

interface WhenStepProps {
  onAnswer: (value: TriageWhen) => void;
}

const OPTIONS: TriageWhen[] = ['today', 'tomorrow', 'week', 'someday'];

export function WhenStep({ onAnswer }: WhenStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>When should this surface?</Text>
      {OPTIONS.map((value) => (
        <TriageOptionRow key={value} label={WHEN_LABELS[value]} onPress={() => onAnswer(value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
```

- [ ] **Step 6: Project step**

Create `apps/mobile/src/components/triage/steps/ProjectStep.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import type { Item } from '../../../db/types';

interface ProjectStepProps {
  projects: Item[];
  selectedProjectId: string | null;
  onAnswer: (projectId: string | null) => void;
}

export function ProjectStep({ projects, selectedProjectId, onAnswer }: ProjectStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>Where does this belong?</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TriageOptionRow
          label="No project"
          selected={selectedProjectId === null}
          onPress={() => onAnswer(null)}
        />
        {projects.map((project) => (
          <TriageOptionRow
            key={project.id}
            label={project.title}
            selected={selectedProjectId === project.id}
            onPress={() => onAnswer(project.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
```

- [ ] **Step 7: Review step**

Create `apps/mobile/src/components/triage/steps/ReviewStep.tsx`:

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../../theme/spacing';
import { PRIORITY_LABELS, WHEN_LABELS } from '../triageLabels';
import type { TriagePriority, TriageWhen } from '../../../state/triageReducer';

interface ReviewStepProps {
  priority: TriagePriority;
  when: TriageWhen;
  projectTitle: string | null;
  onConfirm: () => void;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={[styles.row, { borderBottomColor: mat.rim }]}>
      <Text style={[styles.rowLabel, { color: mat.platinumMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: mat.platinum }]}>{value}</Text>
    </View>
  );
}

export function ReviewStep({ priority, when, projectTitle, onConfirm }: ReviewStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>Ready to process?</Text>
      <View style={[styles.card, { backgroundColor: mat.surfaceRaised, borderColor: mat.rim }]}>
        <ReviewRow label="Type" value="Task" />
        <ReviewRow label="Importance" value={PRIORITY_LABELS[priority]} />
        <ReviewRow label="When" value={WHEN_LABELS[when]} />
        <ReviewRow label="Project" value={projectTitle ?? 'None'} />
      </View>
      <TouchableOpacity
        style={[styles.confirmButton, { backgroundColor: mat.accent }]}
        onPress={onConfirm}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Process item"
      >
        <Text style={[styles.confirmText, { color: mat.onAccent }]}>Process item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
  card: { borderWidth: 1, borderRadius: radius.card, paddingHorizontal: spacing[4] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: fontSize.base },
  rowValue: { fontSize: fontSize.base, fontWeight: '600' },
  confirmButton: {
    marginTop: spacing[6],
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: fontSize.base, fontWeight: '700' },
});
```

Note: `ReviewRow`'s last row's `borderBottomWidth` is intentionally left on (matches the existing `ItemEditorSheet` selection-row convention of a trailing hairline) — purely cosmetic, not worth a special case.

- [ ] **Step 8: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/components/triage/triageLabels.ts apps/mobile/src/components/triage/TriageOptionRow.tsx apps/mobile/src/components/triage/steps/
git commit -m "feat(mobile): add Inbox Triage Mode step components"
```

---

### Task 5: TriageComplete + TriageOverlay (composition, progress bar, animation)

**Files:**
- Create: `apps/mobile/src/components/triage/TriageComplete.tsx`
- Create: `apps/mobile/src/components/triage/TriageOverlay.tsx`

**Interfaces:**
- Consumes: `useTriageSession` (Task 3), all 5 step components + `TriageOptionRow`/labels (Task 4), `itemComposerMaterial`, `spacing`/`fontSize`/`radius`, `Check`/`X` icons, `Item` type.
- Produces (used by Task 6): `<TriageOverlay tappedItem={Item} allItems={Item[]} onClose={() => void} />` — a full-screen component with no other required props. Calls `onClose()` both when the user taps the header X and when the completion screen's "Done" button is tapped.

- [ ] **Step 1: Completion screen**

Create `apps/mobile/src/components/triage/TriageComplete.tsx`:

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { Check } from '../../icons';

interface TriageCompleteProps {
  processedCount: number;
  onDone: () => void;
}

export function TriageComplete({ processedCount, onDone }: TriageCompleteProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: mat.background, paddingBottom: insets.bottom + spacing[6] },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: mat.accentSoft, borderColor: mat.rimStrong }]}>
        <Check size={32} color={mat.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.title, { color: mat.platinum }]}>Inbox zero</Text>
      <Text style={[styles.subtitle, { color: mat.platinumMuted }]}>
        {processedCount === 1 ? 'Processed 1 item.' : `Processed ${processedCount} items.`}
      </Text>
      <TouchableOpacity
        style={[styles.doneButton, { backgroundColor: mat.accent }]}
        onPress={onDone}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={[styles.doneText, { color: mat.onAccent }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[2] },
  subtitle: { fontSize: fontSize.base },
  doneButton: {
    marginTop: spacing[6],
    height: 52,
    minWidth: 160,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: fontSize.base, fontWeight: '700' },
});
```

- [ ] **Step 2: Overlay shell**

Create `apps/mobile/src/components/triage/TriageOverlay.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { X, Check } from '../../icons';
import { useTriageSession } from '../../hooks/useTriageSession';
import { TypeStep } from './steps/TypeStep';
import { ImportanceStep } from './steps/ImportanceStep';
import { WhenStep } from './steps/WhenStep';
import { ProjectStep } from './steps/ProjectStep';
import { ReviewStep } from './steps/ReviewStep';
import { TriageComplete } from './TriageComplete';
import type { Item } from '../../db/types';

interface TriageOverlayProps {
  tappedItem: Item;
  allItems: Item[];
  onClose: () => void;
}

const STEP_COUNT = 5; // type, importance, when, project, review
const STEP_INDEX: Record<string, number> = {
  type: 1,
  importance: 2,
  when: 3,
  project: 4,
  review: 5,
};

export function TriageOverlay({ tappedItem, allItems, onClose }: TriageOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const session = useTriageSession(tappedItem, allItems);

  // Entrance animation, same pattern VoiceCaptureOverlay uses for the whole
  // overlay — applied here to the overlay's own mount only.
  const overlayOpacity = useSharedValue(0);
  const overlayScale = useSharedValue(reducedMotion ? 1 : 0.97);
  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: reducedMotion ? 120 : 220 });
    if (!reducedMotion) overlayScale.value = withTiming(1, { duration: 220 });
  }, [overlayOpacity, overlayScale, reducedMotion]);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  // Per-card entrance — a lightweight version of the card-stack feel: each
  // new card (new item id, or a new step within the same item) fades and
  // slides up into place. No matching exit animation on the outgoing card —
  // that would need two overlapping mounted views; this is the cheap
  // one-sided version agreed in the design doc.
  const cardKey = `${session.currentItem?.id ?? 'done'}:${session.step}`;
  const cardOpacity = useSharedValue(1);
  const cardTranslateY = useSharedValue(0);
  const prevCardKey = useRef(cardKey);
  useEffect(() => {
    if (prevCardKey.current === cardKey) return;
    prevCardKey.current = cardKey;
    cardOpacity.value = 0;
    cardTranslateY.value = reducedMotion ? 0 : 14;
    cardOpacity.value = withTiming(1, { duration: reducedMotion ? 0 : 180 });
    if (!reducedMotion) cardTranslateY.value = withTiming(0, { duration: 180 });
  }, [cardKey, cardOpacity, cardTranslateY, reducedMotion]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  // Brief checkmark pulse before a card actually commits — covers both the
  // Object one-tap path and the Task Review "Process item" confirm.
  const [pulseVisible, setPulseVisible] = useState(false);
  const pulseOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(0.8);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const commitWithPulse = (commit: () => void) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPulseVisible(true);
    pulseOpacity.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
    pulseScale.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
    pulseTimeoutRef.current = setTimeout(() => {
      pulseOpacity.value = withTiming(0, { duration: reducedMotion ? 0 : 150 });
      setPulseVisible(false);
      commit();
    }, reducedMotion ? 200 : 480);
  };

  const tapWithHaptic = (fn: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  const progressIndex = STEP_INDEX[session.step] ?? 1;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: mat.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        overlayStyle,
      ]}
      accessibilityViewIsModal
    >
      {session.currentItem ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close Triage Mode"
              hitSlop={12}
            >
              <X size={20} color={mat.platinum} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.remaining, { color: mat.platinumMuted }]}>
              {session.remaining} remaining
            </Text>
          </View>

          <View style={styles.progressTrack}>
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  { backgroundColor: i < progressIndex ? mat.accent : mat.rim },
                ]}
              />
            ))}
          </View>

          <Animated.View style={[styles.cardArea, cardStyle]}>
            {session.step === 'type' ? (
              <TypeStep
                itemTitle={session.currentItem.title}
                onChooseTask={() => tapWithHaptic(session.chooseTask)}
                onChooseObject={() => commitWithPulse(session.chooseObject)}
              />
            ) : session.step === 'importance' ? (
              <ImportanceStep onAnswer={(v) => tapWithHaptic(() => session.answerImportance(v))} />
            ) : session.step === 'when' ? (
              <WhenStep onAnswer={(v) => tapWithHaptic(() => session.answerWhen(v))} />
            ) : session.step === 'project' ? (
              <ProjectStep
                projects={session.projects}
                selectedProjectId={session.answers.projectId}
                onAnswer={(v) => tapWithHaptic(() => session.answerProject(v))}
              />
            ) : (
              <ReviewStep
                priority={session.answers.priority ?? 'low'}
                when={session.answers.when ?? 'someday'}
                projectTitle={
                  session.answers.projectId
                    ? session.projects.find((p) => p.id === session.answers.projectId)?.title ?? null
                    : null
                }
                onConfirm={() => commitWithPulse(session.confirm)}
              />
            )}
          </Animated.View>

          {session.step !== 'type' ? (
            <TouchableOpacity
              onPress={() => tapWithHaptic(session.back)}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={[styles.backText, { color: mat.platinumMuted }]}>‹ Back</Text>
            </TouchableOpacity>
          ) : null}

          {pulseVisible ? (
            <View style={styles.pulseWrap} pointerEvents="none">
              <Animated.View
                style={[styles.pulseBadge, { backgroundColor: mat.accentSoft, borderColor: mat.rimStrong }, pulseStyle]}
              >
                <Check size={28} color={mat.accent} strokeWidth={2.5} />
              </Animated.View>
            </View>
          ) : null}
        </>
      ) : (
        <TriageComplete processedCount={session.processedCount} onDone={onClose} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 999, flexDirection: 'column' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  remaining: { fontSize: fontSize.sm, fontWeight: '600' },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[5],
  },
  progressSegment: { flex: 1, height: 3, borderRadius: radius.pill },
  cardArea: { flex: 1 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  backText: { fontSize: fontSize.base, fontWeight: '500' },
  pulseWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/triage/TriageComplete.tsx apps/mobile/src/components/triage/TriageOverlay.tsx
git commit -m "feat(mobile): add TriageOverlay composing the Inbox Triage Mode flow"
```

---

### Task 6: Wire Triage Mode into the Inbox, remove the old tap-to-edit path

**Files:**
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`

**Interfaces:**
- Consumes: `TriageOverlay` (Task 5), `useOverlayHost` from `../hooks/useOverlayHost` (already used elsewhere in the app — `setOverlay(id: string, node: ReactNode | null): void`).
- Produces: nothing new for other tasks — this is the final integration point.

- [ ] **Step 1: Read the current row wiring**

Open `apps/mobile/src/screens/InboxScreenV2.tsx`. Find:

```typescript
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
```

and

```typescript
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
```

and, inside the row renderer:

```tsx
                onPress={(selectedItem) => openItem({
                  item: selectedItem,
                  onComplete: ({ action }) => {
                    if (action !== 'cancelled') refresh();
                  },
                })}
```

- [ ] **Step 2: Replace `useOpenItem` with `useOverlayHost` + `TriageOverlay`**

Replace the import block:

```typescript
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
```

with:

```typescript
import { useItemComposer } from '../components/item-composer';
import { useOverlayHost } from '../hooks/useOverlayHost';
import { TriageOverlay } from '../components/triage/TriageOverlay';
```

Replace:

```typescript
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
```

with:

```typescript
  const { revision: composerRevision } = useItemComposer();
  const { setOverlay } = useOverlayHost();

  // Tapping an unprocessed item enters Triage Mode (a full-screen guided
  // session over the whole queue) instead of opening the generic task
  // editor. Selection-mode's swipe actions and "Classify as..." action
  // sheet are unaffected — those stay as the fast bulk-action path.
  const closeTriage = useCallback(() => {
    setOverlay('inbox-triage', null);
    refresh();
  }, [setOverlay, refresh]);

  const openTriage = useCallback((tappedItem: Item) => {
    setOverlay(
      'inbox-triage',
      <TriageOverlay tappedItem={tappedItem} allItems={inboxItems} onClose={closeTriage} />,
    );
  }, [setOverlay, inboxItems, closeTriage]);
```

`InboxScreenV2.tsx` does not currently import the `Item` type at the top level (it only infers item types structurally from `useInbox()`/`TaskSwipeItem`'s props). Add it — insert this line directly after the `import { useOverlayHost } ...` / `import { TriageOverlay } ...` lines you just added:

```typescript
import type { Item } from '../db/types';
```

`useCallback` is already imported from `'react'` on line 1 of this file — no change needed there.

- [ ] **Step 3: Replace the row's onPress**

Replace:

```tsx
                onPress={(selectedItem) => openItem({
                  item: selectedItem,
                  onComplete: ({ action }) => {
                    if (action !== 'cancelled') refresh();
                  },
                })}
```

with:

```tsx
                onPress={(selectedItem) => openTriage(selectedItem)}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manual on-device verification**

This app has no RN component test harness — verify on the physical dev-client device (per `apps/mobile/CLAUDE.md`, port 8082):

```bash
cd apps/mobile && npx expo start --dev-client --port 8082
```

On-device, confirm:
1. Open Inbox, tap any unprocessed item → Triage Mode opens full-screen, showing "What is this?" with that item's title.
2. Tap **Object** → item disappears, next card appears immediately (no importance/when/project questions shown for it). Later, confirm in Menu → Objects that it now shows there with a "want" status.
3. Tap **Task** → Importance step appears. Pick **High** → When step appears. Pick **Today** → Project step appears. Pick a project (or "No project") → Review step shows Task / High / Today / your project choice.
4. Tap **Process item** → checkmark pulse plays, haptic fires, next card (or the "Inbox zero" screen, if that was the last item) appears automatically.
5. On any Task step, tap **‹ Back** → returns to the previous question with your prior answer still selected where applicable (Project's selected row, if you'd already picked one).
6. Tap the **X** mid-session (before Review) → overlay closes, that item is still sitting unprocessed in the Inbox list (nothing was written for it).
7. Process every remaining item → "Inbox zero" screen appears with the correct processed count; tap **Done** → returns to an empty Inbox list.
8. Selection-mode (long-press an item, then use the swipe actions and the "Classify as..." sheet) still works exactly as before — unaffected by this change.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/InboxScreenV2.tsx
git commit -m "feat(mobile): wire Inbox Triage Mode into the Inbox tap flow"
```
