# Home Block-Header Add + Row Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Home's block-header "Add"/"Add item" actions to a real capture flow
prefilled with that block's time bucket, and show each item's duration on Home rows.

**Architecture:** `ItemComposerContext` gains one optional field (`preferredTimeBucket`)
that `createDraft` already has a slot for (today hardcoded to `'anytime'`). `HomeScreen`'s
two stub branches (`quickAdd`, `addItem`) both call `openCapture` with that context.
Separately, `TimelineTaskRow` gains a duration badge rendered inline with the title (not
on a new line) using the existing `getTimelineDurationMinutes` helper, to preserve the
uniform row height drag-reorder depends on.

**Tech Stack:** React Native, TypeScript, existing `ItemComposerProvider` overlay system.

## Global Constraints

- `npx tsc --noEmit` (run from `apps/mobile/`) must be clean after every task.
- No automated test coverage exists for this UI (RN component/gesture behavior isn't
  unit-testable in this project's `node --test` setup) — verification is `tsc` plus a
  manual device checklist, per the spec.
- Draggable Home rows must stay uniform height regardless of content (per the
  `feedback_drag_reorder_uniform_height` project memory) — the duration badge must render
  unconditionally, inline with the title, never adding a new line or conditional height.
- `moveItems`/`sort` stubs are explicitly out of scope — do not touch them in this plan.

---

### Task 1: Add `preferredTimeBucket` to `ItemComposerContext` and thread it through `createDraft`

**Files:**
- Modify: `apps/mobile/src/components/item-composer/types.ts:7-16`
- Modify: `apps/mobile/src/components/item-composer/itemComposerPersistence.ts:62`

**Interfaces:**
- Produces: `ItemComposerContext.preferredTimeBucket?: TimeOfDay`. Task 2 passes this when
  calling `openCapture`.

- [ ] **Step 1: Add the field to `ItemComposerContext`**

In `apps/mobile/src/components/item-composer/types.ts`, find:
```ts
export type ItemComposerContext = {
  status?: 'inbox' | 'active';
  scheduledDate?: string;
  scheduledTime?: string;
  projectId?: string;
  projectTitle?: string;
  lockScheduleDate?: boolean;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  durationMinutes?: number;
};
```

Replace with:
```ts
export type ItemComposerContext = {
  status?: 'inbox' | 'active';
  scheduledDate?: string;
  scheduledTime?: string;
  projectId?: string;
  projectTitle?: string;
  lockScheduleDate?: boolean;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  durationMinutes?: number;
  preferredTimeBucket?: TimeOfDay;
};
```

(`TimeOfDay` is already imported at the top of this file — no new import needed.)

- [ ] **Step 2: Make `createDraft` use it**

In `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, find (line 62):
```ts
    preferredTimeBucket: 'anytime',
```

Replace with:
```ts
    preferredTimeBucket: context.preferredTimeBucket ?? 'anytime',
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/item-composer/types.ts apps/mobile/src/components/item-composer/itemComposerPersistence.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add preferredTimeBucket to ItemComposerContext

Lets a caller of openCapture prefill which time-of-day bucket a new
item lands in — createDraft already had a preferredTimeBucket field on
ItemDraft, just no way to set it from outside (hardcoded to 'anytime').
Same "context overrides, default falls back" pattern durationMinutes
already uses on the line above.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire Home's block-header Add/Quick-add to open capture

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx:22` (import)
- Modify: `apps/mobile/src/screens/HomeScreen.tsx:246-253` (the `quickAdd`/`addItem`
  branches of `onTimeBlockAction`)

**Interfaces:**
- Consumes: `preferredTimeBucket` from Task 1. `openCapture` from `useItemComposer()`
  (already exported — `HomeScreen.tsx` just doesn't currently destructure it).

- [ ] **Step 1: Destructure `openCapture` too**

Find (line 35):
```ts
  const { openEditorForItem, revision: composerRevision } = useItemComposer();
```

Replace with:
```ts
  const { openCapture, openEditorForItem, revision: composerRevision } = useItemComposer();
```

- [ ] **Step 2: Wire the two stub branches**

Find:
```ts
              } else if (action === 'quickAdd') {
                console.log('Quick add for:', block);
              } else if (action === 'addItem') {
                console.log('Add item to:', block);
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
              }
```

Replace with:
```ts
              } else if (action === 'quickAdd' || action === 'addItem') {
                openCapture({
                  context: { status: 'active', preferredTimeBucket: block },
                  onComplete: ({ action: completionAction }) => {
                    if (completionAction === 'saved') refresh();
                  },
                });
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
              }
```

`moveItems`/`sort` stay untouched stubs — out of scope per the spec. `block`'s type
(`TimeBlockType`) is structurally identical to `TimeOfDay` (`'anytime' | 'morning' |
'afternoon' | 'evening'` in both), so no cast is needed passing it as
`preferredTimeBucket`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): wire block-header Add/Quick-add to open capture

quickAdd (swipe) and addItem (long-press menu) were both console.log
stubs despite the swipe action already being correctly labeled "Add"
in a previous fix. Both now open the capture sheet with the block's
time bucket prefilled via the new preferredTimeBucket context field.
moveItems/sort remain stubs — out of scope for this pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Show duration on Home rows

**Files:**
- Modify: `apps/mobile/src/components/TimelineSection.tsx` (imports, a new local
  formatter, `TimelineTaskRow`'s title rendering, one new style)

**Interfaces:**
- Consumes: `getTimelineDurationMinutes(item: Item, instance?: ItemInstance): number` from
  `../utils/timelineItem` (existing, unmodified).

- [ ] **Step 1: Import the duration helper**

Find (near the top of `apps/mobile/src/components/TimelineSection.tsx`, after the last
existing import — the `TimerReset, ArrowRight, Archive, Check, Plus` line added in the
swipe-actions work):
```tsx
import { TimerReset, ArrowRight, Archive, Check, Plus } from '../icons';
```

Add immediately after it:
```tsx
import { getTimelineDurationMinutes } from '../utils/timelineItem';
```

- [ ] **Step 2: Add the local formatter**

Find the `hexToRgba` function (a small standalone helper already in this file, just above
`TimelineTaskRow`):
```tsx
// Alpha-blends a hex color for chip/row tints — RN has no native rgba(#hex, a).
function hexToRgba(hex: string, alpha: number): string {
```

Add a new function immediately before it:
```tsx
function formatDurationBadge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

```

- [ ] **Step 3: Render the badge inline with the title**

Inside `TimelineTaskRow`, find:
```tsx
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: blocker ? palette.textMuted : palette.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.notes && (
```

Replace with:
```tsx
              <View style={styles.itemContent}>
                <View style={styles.itemTitleRow}>
                  <Text
                    style={[styles.itemTitle, styles.itemTitleFlex, { color: blocker ? palette.textMuted : palette.text }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.durationBadge, { color: palette.textMuted }]} numberOfLines={1}>
                    {formatDurationBadge(getTimelineDurationMinutes(item))}
                  </Text>
                </View>
                {item.notes && (
```

- [ ] **Step 4: Add the two new styles**

Find the `styles` `StyleSheet.create` block in this file and locate the existing
`itemTitle` entry (do not modify it). Add two new entries anywhere in the same
`StyleSheet.create({...})` object:
```ts
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  itemTitleFlex: {
    flex: 1,
  },
  durationBadge: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
  },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/TimelineSection.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): show duration on Home rows

Reuses getTimelineDurationMinutes (already used by CalendarScreen) —
no new data, just surfacing durationMinutes that every item already
has. Rendered inline with the title (not a new line) and always
present (not conditional) so it can never change a row's measured
height, per the uniform-row-height constraint drag-reorder depends on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Confirm no stray stub text remains for the two wired actions**

Run: `cd apps/mobile && grep -n "Quick add for:\|Add item to:" src/screens/HomeScreen.tsx`
Expected: no matches (both `console.log` lines should be gone — replaced by the
`openCapture` call). A second check confirms the two still-out-of-scope stubs are
untouched:

Run: `cd apps/mobile && grep -n "Move items to:\|Sort items in:" src/screens/HomeScreen.tsx`
Expected: both still present (unchanged, by design).

- [ ] **Step 3: Run the pure-logic test suite (sanity check nothing else broke)**

Run: `cd apps/mobile && npm test`
Expected: all existing tests pass (this plan doesn't touch any file `npm test` covers —
regression guard only).

- [ ] **Step 4: Report the manual verification checklist to the user**

Requires the EAS dev client on a physical iPhone or the iOS Simulator — not reachable from
this session's tools. Report this checklist and wait for confirmation:

1. Swipe right on a block header ("Add") → capture sheet opens; save a title-only item
   from, say, the Morning block → confirm it actually lands under Morning (not Anytime).
2. Long-press a block header → "Add item" → same capture sheet, same prefilled bucket,
   confirmed by testing from a different block (e.g. Evening) and checking placement.
3. Every Home row shows a duration badge (e.g. "15m", "1h", "1h 30m"); it doesn't wrap,
   doesn't push the row taller, and doesn't crowd out a two-line title.
4. An item with no explicit duration set shows "45m" (the default).
5. Drag-reorder still feels smooth with the badge present — no visual glitch/jump during
   a drag (this is the actual failure mode if the uniform-height constraint were broken).
6. Both light and dark mode render the badge legibly.
