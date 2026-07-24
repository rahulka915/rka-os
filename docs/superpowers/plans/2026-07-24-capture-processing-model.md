# Capture & Processing Model — Object Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Object capture type from the Capture & Processing Model spec —
Inbox classification, a "To Get" collection screen, and an Object detail/edit screen with
status lifecycle, price, links, tags, linked Task/Project, and photos.

**Architecture:** Entirely additive to the existing polymorphic `items` table — `'object'`
becomes a new `ItemType` value, Object-specific fields live in the existing `metadata`
JSON column (same pattern as `priority`/`durationMinutes`), category reuses the existing
`tags` field, and linked Task/Project reuse the existing generic `itemRelations` table via
the already-existing `setRelation`/`getRelation` functions. No new tables, no schema
migration. Photos are the one piece needing a native module
(`expo-image-picker`) and a rebuild, done in the last task.

**Tech Stack:** React Native, TypeScript, Expo SQLite, `expo-image-picker` (new),
`expo-file-system` (already installed).

## Global Constraints

- `npx tsc --noEmit` (run from `apps/mobile/`) must be clean after every task.
- No automated test coverage for the new screens (RN component/gesture UI isn't
  unit-testable in this project's `node --test` setup) — verification is `tsc` plus
  manual device checklists.
- No changes to `ItemEditorSheet.tsx`, Task/Project/Area behavior, or the existing
  "Classify as..." destinations beyond adding one new option.
- Every new DB interaction reuses an existing generic function
  (`getItemsByType`, `getItemWithMetadata`, `updateItemMetadata`, `setRelation`,
  `getRelation`, `deleteItem`, `createItem` is NOT used — Objects are only created via
  Inbox classification, never directly) — do not add new bespoke DB functions where a
  generic one already does the job.
- Tasks 1-4 are pure JS/TS — verify via Metro reload. Task 5 (photos) is the only one
  requiring a native rebuild; do not rebuild until Task 5.

---

### Task 1: Data model — `ItemType`, `ObjectStatus`, Inbox classification destination

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/db/database.ts` (`GtdDestination` type + `processInboxItem`)

**Interfaces:**
- Produces: `ItemType` gains `'object'`. New exported type `ObjectStatus = 'want' |
  'need' | 'saving' | 'ready' | 'ordered' | 'owned'` in `db/types.ts`. `GtdDestination`
  gains `'object'`. Later tasks import `ObjectStatus` from `../db/types` (or `../../db/types`
  depending on file depth).

- [ ] **Step 1: Add `'object'` to `ItemType` and export `ObjectStatus`**

In `apps/mobile/src/db/types.ts`, find:
```ts
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'meal';
```

Replace with:
```ts
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'meal' | 'object';

// Object's own possession-tracking lifecycle — independent of the generic ItemStatus
// column (which has no vocabulary for "I want this"). Not a strict pipeline: a user can
// jump straight to 'owned' or move backward, no enforced transitions.
export type ObjectStatus = 'want' | 'need' | 'saving' | 'ready' | 'ordered' | 'owned';
```

- [ ] **Step 2: Add `'object'` to `GtdDestination` and a new `processInboxItem` case**

In `apps/mobile/src/db/database.ts`, find:
```ts
export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication'
  | 'reference' | 'someday' | 'delete';
```

Replace with:
```ts
export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication' | 'object'
  | 'reference' | 'someday' | 'delete';
```

Find the `case 'medication':` block inside `processInboxItem` (immediately follows
`case 'habit':`):
```ts
    case 'medication':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['medication', 'active', JSON.stringify({ ...meta, gtdContext: 'medication' }), now, id]
      );
      break;
```

Add a new case immediately after it:
```ts
    case 'object':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['object', 'active', JSON.stringify({ ...meta, gtdContext: 'object', objectStatus: 'want' }), now, id]
      );
      break;
```

Every classified Object starts at `objectStatus: 'want'` — the lifecycle's natural entry
point.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/types.ts apps/mobile/src/db/database.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add Object ItemType and its Inbox classification path

First implementation piece of the Capture & Processing Model spec.
'object' joins the existing polymorphic ItemType union (no new table).
ObjectStatus (want/need/saving/ready/ordered/owned) is a new metadata
field, deliberately independent of the generic status column, which
has no vocabulary for "I want this." processInboxItem gains a new
'object' destination, seeding objectStatus: 'want' on classification.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Inbox — "Object" as a Classify destination

**Files:**
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`

**Interfaces:**
- Consumes: `'object'` `GtdDestination` from Task 1 (already flows through
  `handleBulkProcess`/`processInboxItem` — no new function needed here).

- [ ] **Step 1: Add the menu option**

Find:
```ts
    Alert.alert('Classify as...', 'This reassigns the entity type, not just when it happens.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mission', onPress: () => handleBulkProcess('project') },
      { text: 'Domain', onPress: () => handleBulkProcess('area') },
      { text: 'Habit', onPress: () => handleBulkProcess('habit') },
      { text: 'Medication', onPress: () => handleBulkProcess('medication') },
      { text: 'Reference', onPress: () => handleBulkProcess('reference') },
    ]);
```

Replace with:
```ts
    Alert.alert('Classify as...', 'This reassigns the entity type, not just when it happens.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mission', onPress: () => handleBulkProcess('project') },
      { text: 'Domain', onPress: () => handleBulkProcess('area') },
      { text: 'Habit', onPress: () => handleBulkProcess('habit') },
      { text: 'Medication', onPress: () => handleBulkProcess('medication') },
      { text: 'Object', onPress: () => handleBulkProcess('object') },
      { text: 'Reference', onPress: () => handleBulkProcess('reference') },
    ]);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run the app, open Inbox, capture/select an item, enter selection mode, tap "Classify
as...", confirm "Object" appears and tapping it removes the item from Inbox (it now has
`type: 'object'` — nothing displays it yet until Task 4, but confirm via re-opening Inbox
that the item is gone, i.e. no longer `type: 'task'`/`status: 'inbox'`).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/InboxScreenV2.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add Object option to Inbox's Classify menu

One new Alert.alert option, reusing the existing handleBulkProcess/
processInboxItem pipeline — no new Inbox logic.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ObjectDetailScreen` — fields, tags, linked Task/Project, delete

**Files:**
- Create: `apps/mobile/src/screens/ObjectDetailScreen.tsx`

**Interfaces:**
- Consumes: `getItemWithMetadata`, `updateItemMetadata`, `deleteItem`, `setRelation`,
  `getRelation` from `../db/database` (all pre-existing). `useProjects`, `useTasks` from
  `../hooks/useDb` (pre-existing). `ObjectStatus` from `../db/types` (Task 1).
- Produces: route name `'ObjectDetail'` with params `{ objectId: string }` — Task 4's
  `ToGetScreen` navigates here with `navigation.navigate('ObjectDetail', { objectId:
  item.id })`.

- [ ] **Step 1: Add `updateItemTitle` to `database.ts`**

`updateItemMetadata` only ever touches the `metadata` column — there's no existing
generic "rename an item" function to reuse (unlike every other field this screen edits,
which already has one). In `apps/mobile/src/db/database.ts`, find `export function
updateItemMetadata` and add immediately after it:

```ts
export function updateItemTitle(id: string, title: string): void {
  getDb().runSync(`UPDATE items SET title = ?, updatedAt = ? WHERE id = ?`, [title, Date.now(), id]);
}
```

- [ ] **Step 2: Write the screen**

```tsx
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  deleteItem,
  getItemWithMetadata,
  getRelation,
  setRelation,
  updateItemMetadata,
  updateItemTitle,
} from '../db/database';
import { useProjects, useTasks } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ChevronLeft, Tag as TagIcon, Trash2, X } from '../icons';
import type { Item, ObjectStatus } from '../db/types';

interface ObjectDetailRouteParams {
  objectId: string;
}

const STATUS_OPTIONS: Array<{ value: ObjectStatus; label: string }> = [
  { value: 'want', label: 'Want' },
  { value: 'need', label: 'Need' },
  { value: 'saving', label: 'Saving' },
  { value: 'ready', label: 'Ready to Buy' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'owned', label: 'Owned' },
];

function parseMetadata(item: Item | null): Record<string, unknown> {
  if (!item?.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readTags(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : [];
}

function readLinks(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.links) ? meta.links.filter((l): l is string => typeof l === 'string') : [];
}

export function ObjectDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { objectId } = route.params as ObjectDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const [item, setItem] = useState<Item | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');

  const load = useCallback(() => {
    const loaded = getItemWithMetadata(objectId);
    setItem(loaded);
    setTitle(loaded?.title ?? '');
    const meta = parseMetadata(loaded);
    setPrice(typeof meta.price === 'number' ? String(meta.price) : '');
  }, [objectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!item) return null;

  const meta = parseMetadata(item);
  const objectStatus: ObjectStatus = (meta.objectStatus as ObjectStatus) ?? 'want';
  const tags = readTags(meta);
  const links = readLinks(meta);
  const linkedProjectId = getRelation(objectId, 'project');
  const linkedTaskId = getRelation(objectId, 'relatedTask');
  const linkedProject = projects.find((p) => p.id === linkedProjectId);
  const linkedTask = tasks.find((t) => t.id === linkedTaskId);

  const saveMeta = (updates: Record<string, unknown>) => {
    updateItemMetadata(objectId, { ...meta, ...updates });
    load();
  };

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) return;
    updateItemTitle(objectId, trimmed);
    load();
  };

  const setStatus = (value: ObjectStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveMeta({ objectStatus: value });
  };

  const savePrice = () => {
    const parsed = parseFloat(price);
    saveMeta({ price: Number.isFinite(parsed) ? parsed : undefined });
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    saveMeta({ tags: [...tags, tag] });
    setTagDraft('');
  };

  const removeTag = (tag: string) => saveMeta({ tags: tags.filter((t) => t !== tag) });

  const addLink = () => {
    const link = linkDraft.trim();
    if (!link || links.includes(link)) {
      setLinkDraft('');
      return;
    }
    saveMeta({ links: [...links, link] });
    setLinkDraft('');
  };

  const removeLink = (link: string) => saveMeta({ links: links.filter((l) => l !== link) });

  const promptLinkProject = () => {
    Alert.alert('Link to mission', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(linkedProjectId ? [{ text: 'Remove link', onPress: () => setRelation(objectId, 'project', null) }] : []),
      ...projects.map((project) => ({
        text: project.title,
        onPress: () => setRelation(objectId, 'project', project.id),
      })),
    ]);
  };

  const promptLinkTask = () => {
    Alert.alert('Link to task', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(linkedTaskId ? [{ text: 'Remove link', onPress: () => setRelation(objectId, 'relatedTask', null) }] : []),
      ...tasks.map((task) => ({
        text: task.title,
        onPress: () => setRelation(objectId, 'relatedTask', task.id),
      })),
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete object?', `Delete "${item.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(objectId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <LensSurface title="Object">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.titleInput, { color: palette.text }]}
          value={title}
          onChangeText={setTitle}
          onBlur={saveTitle}
          placeholder="Object title"
          placeholderTextColor={palette.textTertiary}
        />

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>STATUS</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((option) => {
            const selected = objectStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: selected ? palette.blue : palette.separator, backgroundColor: selected ? palette.blueSoft : 'transparent' },
                ]}
                onPress={() => setStatus(option.value)}
              >
                <Text style={[styles.chipText, { color: selected ? palette.blue : palette.textSecondary }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PRICE</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: palette.separator }]}
          value={price}
          onChangeText={setPrice}
          onBlur={savePrice}
          placeholder="0.00"
          placeholderTextColor={palette.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKS</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.fieldInput, styles.addInput, { color: palette.text, borderColor: palette.separator }]}
            value={linkDraft}
            onChangeText={setLinkDraft}
            onSubmitEditing={addLink}
            placeholder="https://..."
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: palette.blue, opacity: linkDraft.trim() ? 1 : 0.35 }]} onPress={addLink} disabled={!linkDraft.trim()}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {links.map((link) => (
          <View key={link} style={[styles.listRow, { borderBottomColor: palette.separator }]}>
            <Text style={[styles.listRowText, { color: palette.text }]} numberOfLines={1}>{link}</Text>
            <TouchableOpacity onPress={() => removeLink(link)} hitSlop={10}>
              <X size={16} color={palette.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TAGS</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.fieldInput, styles.addInput, { color: palette.text, borderColor: palette.separator }]}
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            placeholder="Add a tag"
            placeholderTextColor={palette.textTertiary}
            autoCorrect={false}
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: palette.blue, opacity: tagDraft.trim() ? 1 : 0.35 }]} onPress={addTag} disabled={!tagDraft.trim()}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {tags.map((tag) => (
          <View key={tag} style={[styles.listRow, { borderBottomColor: palette.separator }]}>
            <View style={styles.listRowLabel}>
              <TagIcon size={16} color={palette.textMuted} strokeWidth={1.8} />
              <Text style={[styles.listRowText, { color: palette.text }]}>#{tag}</Text>
            </View>
            <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={10}>
              <X size={16} color={palette.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKED TO</Text>
        <TouchableOpacity style={[styles.listRow, { borderBottomColor: palette.separator }]} onPress={promptLinkProject}>
          <Text style={[styles.listRowText, { color: palette.text }]}>Mission</Text>
          <Text style={[styles.listRowValue, { color: palette.textSecondary }]}>{linkedProject?.title ?? 'None'} ›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.listRow, { borderBottomColor: palette.separator }]} onPress={promptLinkTask}>
          <Text style={[styles.listRowText, { color: palette.text }]}>Task</Text>
          <Text style={[styles.listRowValue, { color: palette.textSecondary }]}>{linkedTask?.title ?? 'None'} ›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.deleteButton, { backgroundColor: palette.redSoft }]} onPress={confirmDelete}>
          <Trash2 size={16} color={palette.red} strokeWidth={1.8} />
          <Text style={[styles.deleteText, { color: palette.red }]}>Delete object</Text>
        </TouchableOpacity>
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    gap: 8,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  fieldInput: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  listRow: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  listRowText: {
    fontSize: 15,
    flexShrink: 1,
  },
  listRowValue: {
    fontSize: 14,
  },
  deleteButton: {
    marginTop: 24,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
```

- [ ] **Step 3: Confirm the icons used already exist**

`ChevronLeft`, `Tag`, `Trash2`, `X` are all already exported from `apps/mobile/src/icons.tsx`
(used elsewhere in the app already) — no new icon exports needed for this task.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: errors about `'ObjectDetail'` not being a known route — expected, Task 4
registers it in `MenuStack`. All other errors must be resolved before moving on.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/ObjectDetailScreen.tsx apps/mobile/src/db/database.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add ObjectDetailScreen

Deliberately not a reuse of ItemEditorSheet (built around scheduling
concepts — When/Duration/Repeat/Deadline — that don't apply to a
possession-tracking lifecycle). Title, status (6-stage lifecycle
chips), price, links, tags (mirrors ItemEditorSheet's tag-editor
pattern), and linked Mission/Task (Alert-based pickers, mirroring
ProjectsScreen's promptSetArea) all persist via existing generic DB
functions — only one new function needed (updateItemTitle; every
other field already had a reusable one). Not yet reachable from any
screen — Task 4 wires navigation to it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: "To Get" screen + Menu wiring

**Files:**
- Create: `apps/mobile/src/screens/ToGetScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/MenuScreen.tsx`
- Modify: `apps/mobile/src/icons.tsx`

**Interfaces:**
- Consumes: `getItemsByType('object')` from `../db/database` (pre-existing).
  `ObjectDetailScreen` from Task 3 (registered here for the first time).

- [ ] **Step 1: Add a shopping-bag icon export**

In `apps/mobile/src/icons.tsx`, add anywhere among the other exports:
```ts
export { default as ShoppingBag } from 'react-native-heroicons/outline/ShoppingBagIcon';
```

- [ ] **Step 2: Write `ToGetScreen.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, ScrollView, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ShoppingBag } from '../icons';
import type { Item, ObjectStatus } from '../db/types';

const STATUS_LABELS: Record<ObjectStatus, string> = {
  want: 'Want',
  need: 'Need',
  saving: 'Saving',
  ready: 'Ready to Buy',
  ordered: 'Ordered',
  owned: 'Owned',
};

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function firstTag(item: Item): string {
  const meta = parseMetadata(item);
  return Array.isArray(meta.tags) && typeof meta.tags[0] === 'string' ? meta.tags[0] : 'Other';
}

export function ToGetScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [objects, setObjects] = useState<Item[]>([]);

  useFocusEffect(useCallback(() => {
    setObjects(getItemsByType('object'));
  }, []));

  const groups = new Map<string, Item[]>();
  for (const item of objects) {
    const key = firstTag(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const groupNames = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));

  return (
    <LensSurface title="To Get">
      {objects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to get yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Classify a captured item as "Object" in Inbox</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groupNames.map((group) => (
            <View key={group} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.toUpperCase()}</Text>
              <View style={styles.sectionRows}>
                {(groups.get(group) ?? []).map((item) => {
                  const meta = parseMetadata(item);
                  const objectStatus: ObjectStatus = (meta.objectStatus as ObjectStatus) ?? 'want';
                  const price = typeof meta.price === 'number' ? meta.price : null;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.row, { backgroundColor: palette.surface }]}
                      activeOpacity={0.7}
                      onPress={() => (navigation as any).navigate('ObjectDetail', { objectId: item.id })}
                    >
                      <ShoppingBag size={24} color={palette.textMuted} strokeWidth={1.6} />
                      <View style={styles.rowBody}>
                        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                          {STATUS_LABELS[objectStatus]}{price != null ? ` · $${price.toFixed(2)}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionRows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: 13,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
```

- [ ] **Step 3: Register both new routes in `MenuStack`**

In `apps/mobile/src/navigation/MenuStack.tsx`, find:
```tsx
import { MedicationsScreen } from '../screens/MedicationsScreen';

const Stack = createNativeStackNavigator();

export function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MenuHome" component={MenuScreen} />
      <Stack.Screen name="Areas" component={AreasScreen} />
      <Stack.Screen name="AreaDetail" component={AreaDetailScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Upcoming" component={UpcomingScreen} />
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="Medications" component={MedicationsScreen} />
    </Stack.Navigator>
  );
}
```

Replace with:
```tsx
import { MedicationsScreen } from '../screens/MedicationsScreen';
import { ToGetScreen } from '../screens/ToGetScreen';
import { ObjectDetailScreen } from '../screens/ObjectDetailScreen';

const Stack = createNativeStackNavigator();

export function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MenuHome" component={MenuScreen} />
      <Stack.Screen name="Areas" component={AreasScreen} />
      <Stack.Screen name="AreaDetail" component={AreaDetailScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Upcoming" component={UpcomingScreen} />
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="Medications" component={MedicationsScreen} />
      <Stack.Screen name="ToGet" component={ToGetScreen} />
      <Stack.Screen name="ObjectDetail" component={ObjectDetailScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 4: Add the Menu row**

In `apps/mobile/src/screens/MenuScreen.tsx`, find the `menuItems` array's `Medications`
entry (the last one):
```ts
    {
      route: 'Medications',
      label: 'Medications',
      sub: 'Inventory and schedules',
      icon: MedicationBottleIcon,
      accent: palette.green,
      soft: palette.greenSoft,
    },
  ] as const;
```

Replace with:
```ts
    {
      route: 'Medications',
      label: 'Medications',
      sub: 'Inventory and schedules',
      icon: MedicationBottleIcon,
      accent: palette.green,
      soft: palette.greenSoft,
    },
    {
      route: 'ToGet',
      label: 'To Get',
      sub: 'Things you want to own',
      icon: ShoppingBag,
      accent: palette.pink,
      soft: palette.pinkSoft,
    },
  ] as const;
```

Add the import (find the existing icon imports near the top):
```ts
import { Dumbbell, ChevronRight } from '../icons';
```

Replace with:
```ts
import { Dumbbell, ChevronRight, ShoppingBag } from '../icons';
```

Also update the section count text just below the `menuItems` array's usage (find
`"6 destinations"`):
```tsx
          <Text style={[styles.sectionCount, { color: palette.textTertiary }]}>6 destinations</Text>
```

Replace with:
```tsx
          <Text style={[styles.sectionCount, { color: palette.textTertiary }]}>7 destinations</Text>
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors — this resolves the `'ObjectDetail'` route-name error noted at the end
of Task 3.

- [ ] **Step 6: Manual verification**

1. Menu → "To Get" (new row) appears, tapping it opens the (likely empty, or showing the
   item classified in Task 2) list.
2. Tap an Object row → `ObjectDetailScreen` opens with that item's data.
3. Edit status, price, add a link, add a tag, link a Mission, link a Task — back out to
   "To Get", confirm the row reflects the new status/price.
4. Delete the object from its detail screen → confirm it's gone from "To Get".

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/ToGetScreen.tsx apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/MenuScreen.tsx apps/mobile/src/icons.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add "To Get" Menu screen, wire ObjectDetail navigation

New Menu row (matches the existing Domains/Missions/.../Medications
pattern exactly), listing Objects grouped by their first tag ("Other"
for untagged). Tapping a row opens ObjectDetailScreen (built in the
previous commit, unreachable until now). Completes the JS-only portion
of the Capture & Processing Model's Object type — photos (Task 5) is
the only piece left, and the only one needing a native rebuild.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Photos — `expo-image-picker`, local storage, one native rebuild

**Files:**
- Create: `apps/mobile/src/services/objectPhotos.ts`
- Modify: `apps/mobile/src/screens/ObjectDetailScreen.tsx`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json` / `package-lock.json` (via install)

**Interfaces:**
- Produces: `pickAndStoreObjectPhoto(): Promise<string | null>` (returns a local
  `file://` path already copied into app storage, or `null` if the user cancelled/denied
  permission) and `deleteStoredObjectPhoto(uri: string): Promise<void>`, both exported
  from `objectPhotos.ts`. `ObjectDetailScreen` calls both.

- [ ] **Step 1: Install `expo-image-picker`**

Run: `cd apps/mobile && npx expo install expo-image-picker`
Expected: installs cleanly, updates `package.json`/`package-lock.json`.

- [ ] **Step 2: Add the config plugin entry**

In `apps/mobile/app.json`, find:
```json
      [
        "expo-calendar",
        {
          "calendarPermission": "RKA OS reads your calendar so your day view can show real events alongside your tasks."
        }
      ],
```

Add immediately after it:
```json
      [
        "expo-image-picker",
        {
          "photosPermission": "RKA OS accesses your photos so you can attach one to an object you're tracking."
        }
      ],
```

- [ ] **Step 3: Write `objectPhotos.ts`**

```ts
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const PHOTOS_DIR = `${FileSystem.documentDirectory}objectPhotos/`;

async function ensurePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

// Copies the picked image into the app's own document directory rather than storing the
// picker's tmp-path, which isn't guaranteed to persist across app restarts.
export async function pickAndStoreObjectPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;

  await ensurePhotosDir();
  const source = result.assets[0].uri;
  const extension = source.split('.').pop() ?? 'jpg';
  const destination = `${PHOTOS_DIR}${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: source, to: destination });
  return destination;
}

export async function deleteStoredObjectPhoto(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
```

- [ ] **Step 4: Wire photos into `ObjectDetailScreen.tsx`**

Add to the imports:
```ts
import { Image } from 'react-native';
import { deleteStoredObjectPhoto, pickAndStoreObjectPhoto } from '../services/objectPhotos';
```

(Merge `Image` into the existing `react-native` import line rather than adding a second
one — find `import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
View } from 'react-native';` and add `Image` to that list.)

Add a `readPhotoUris` helper alongside the existing `readTags`/`readLinks` helpers:
```ts
function readPhotoUris(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.photoUris) ? meta.photoUris.filter((p): p is string => typeof p === 'string') : [];
}
```

Inside the component, alongside the existing `tags`/`links` derived values, add:
```ts
  const photoUris = readPhotoUris(meta);
```

Add handler functions alongside `addTag`/`removeTag`:
```ts
  const addPhoto = async () => {
    const uri = await pickAndStoreObjectPhoto();
    if (!uri) return;
    saveMeta({ photoUris: [...photoUris, uri] });
  };

  const removePhoto = async (uri: string) => {
    await deleteStoredObjectPhoto(uri);
    saveMeta({ photoUris: photoUris.filter((p) => p !== uri) });
  };
```

Add a new section to the JSX, immediately before the `LINKS` section (find `<Text
style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKS</Text>` and insert
before it):
```tsx
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PHOTOS</Text>
        <View style={styles.photoRow}>
          {photoUris.map((uri) => (
            <TouchableOpacity key={uri} onLongPress={() => removePhoto(uri)} delayLongPress={400}>
              <Image source={{ uri }} style={styles.photoThumb} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.addPhotoButton, { borderColor: palette.separator }]} onPress={addPhoto}>
            <Text style={[styles.addPhotoText, { color: palette.textSecondary }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

```

Add the two new styles to the `StyleSheet.create` block (anywhere in the object):
```ts
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  addPhotoButton: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
  },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit the code (before rebuilding)**

```bash
git add apps/mobile/src/services/objectPhotos.ts apps/mobile/src/screens/ObjectDetailScreen.tsx apps/mobile/app.json apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "$(cat <<'EOF'
feat(mobile): add photo support to Object detail

expo-image-picker (new dependency) + expo-file-system (already
installed) to pick and copy an image into the app's own document
directory (objectPhotos/) rather than referencing the picker's tmp
path, which isn't guaranteed to persist. Long-press a thumbnail to
remove it. This is the one piece of the Capture & Processing Model's
Object type that touches native code — requires a fresh dev-client
build before it works on-device (does not take effect via Metro
reload alone).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Rebuild and install**

This repeats exactly the process already used successfully once this session for the
calendar integration:

Run: `df -h / | tail -1` — confirm enough free disk space before starting (a local iOS
build needs several GB; if tight, ask the user to free space first rather than starting a
build likely to fail partway through).

Run: `cd apps/mobile && eas build --local --platform ios --profile development --non-interactive`
Expected: eventually prints `Build successful` and a path to a `build-*.ipa` file. This
can take 10-20+ minutes.

Then extract and install:
```bash
cd apps/mobile
rm -rf /tmp/rkaos-ipa-extract && mkdir -p /tmp/rkaos-ipa-extract
unzip -q build-*.ipa -d /tmp/rkaos-ipa-extract
xcrun devicectl list devices
```
Note the target iPhone's identifier from the `list devices` output, then:
```bash
xcrun devicectl device install app --device <IDENTIFIER> /tmp/rkaos-ipa-extract/Payload/RKAOS.app
```
Expected: `App installed:` with a `bundleID: com.rahul.rkaos` confirmation.

- [ ] **Step 8: Manual verification on-device**

1. Metro must be running (`npx expo start --dev-client --port 8082` from `apps/mobile/`)
   before opening the freshly-installed app.
2. Open an Object's detail screen, tap "+ Add" under Photos, grant the photo-library
   permission when prompted, pick an image — confirm it appears as a thumbnail.
3. Force-quit and reopen the app, confirm the photo is still there (proves it's copied to
   local storage, not a picker tmp path).
4. Long-press a thumbnail, confirm it's removed both from the screen and (spot-check via
   the file no longer existing — not required to verify directly, trusting
   `deleteStoredObjectPhoto`'s implementation) from storage.
5. Full regression pass on Tasks 1-4's manual checklists, since this is the first time the
   whole Object feature runs on a freshly rebuilt binary rather than a Metro-reloaded one.
