# Mission Icons & Area Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Missions (Projects) show a neutral placeholder icon by default, a user-settable emoji icon (editable from the mission detail screen), and a text-chip badge showing their linked Area, when one is set.

**Architecture:** No schema migration — the emoji is stored as a new `icon` key inside the existing `project` item's `metadata` JSON blob, written via the existing `updateItemMetadata(id, metadata)` function. `LensSurface` gets a new optional `icon` slot rendered next to its title, wired up only in `ProjectDetailScreen`. The emoji picker is a visually-hidden `TextInput` that triggers the system emoji keyboard — no new library. `ProjectsScreen`'s row reads `metadata.icon` (falling back to a new `ProjectPlaceholderIcon`, itself a thin wrapper around the already-available `FolderKanban` heroicon) and resolves the mission's Area title from the already-loaded `useAreas()` list to render a badge chip.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript, `expo-sqlite` (via `src/db/database.ts`), `react-native-heroicons`, no automated UI test suite in this project — verification is manual via the iOS simulator/dev build per existing project convention.

## Global Constraints

- No new npm dependencies (emoji picker uses a plain `TextInput`, placeholder icon reuses `react-native-heroicons` already exported from `apps/mobile/src/icons.tsx`).
- No database schema/migration changes — `icon` lives inside `project` metadata JSON, following the exact pattern used by `updateMedication` (`apps/mobile/src/db/database.ts:705-713`): read existing metadata, merge, write back.
- `ProjectPortfolioIcon` (`apps/mobile/src/components/icons/ProjectPortfolioIcon.tsx`) must NOT be modified or removed — it's used in 6 other places (`CalendarScreen`, `AreaDetailScreen`, `MenuScreen`, `UpNextCard`, `ItemEditorSheet`, and `ProjectsScreen`'s `QuickCreateSheet` icon prop at line 122). Only `ProjectsScreen`'s row rendering (line 88) switches away from it.
- `LensSurface` (`apps/mobile/src/components/LensSurface.tsx`) is shared by other Lens screens (Areas, Workouts, Medications) — the new `icon` prop must be optional and default to rendering nothing, so unrelated screens are unaffected.
- Badge/chip styling has no existing "filled pill" component to copy (`BlockedBadge`/`DeadlineBadge`/`RepeatBadge` are text+icon only, no background) — use `palette.fill` for background, `palette.textSecondary` for text, per the design spec's "neutral text chip" requirement.
- Follow the existing metadata-read pattern verbatim: `item.metadata ? JSON.parse(item.metadata) : {}`.

---

### Task 1: Add `ProjectPlaceholderIcon` component

**Files:**
- Create: `apps/mobile/src/components/icons/ProjectPlaceholderIcon.tsx`

**Interfaces:**
- Consumes: `FolderKanban` from `apps/mobile/src/icons.tsx` (already exported, wraps `react-native-heroicons/outline/FolderIcon`).
- Produces: `ProjectPlaceholderIcon({ size?: number, color?: string }): JSX.Element` — used by Task 4 (`ProjectsScreen` row) and Task 3 (`ProjectDetailScreen` header, when no emoji set).

- [ ] **Step 1: Create the component**

```tsx
// apps/mobile/src/components/icons/ProjectPlaceholderIcon.tsx
import { FolderKanban } from '../../icons';

interface ProjectPlaceholderIconProps {
  size?: number;
  color?: string;
}

// Neutral default icon for missions with no custom emoji set (see metadata.icon).
export function ProjectPlaceholderIcon({ size = 24, color = '#8E8E93' }: ProjectPlaceholderIconProps) {
  return <FolderKanban size={size} color={color} strokeWidth={1.75} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors mentioning `ProjectPlaceholderIcon.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/icons/ProjectPlaceholderIcon.tsx
git commit -m "feat: add ProjectPlaceholderIcon as neutral mission default icon"
```

---

### Task 2: Add `icon` slot to `LensSurface`

**Files:**
- Modify: `apps/mobile/src/components/LensSurface.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LensSurfaceProps.icon?: ReactNode`, rendered inside `headerLeft`, between the back button and the title. Consumed by Task 3 (`ProjectDetailScreen`).

- [ ] **Step 1: Add the `icon` prop to the interface**

In `apps/mobile/src/components/LensSurface.tsx`, change:

```tsx
interface LensSurfaceProps {
  title: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  contextBar?: ReactNode;
  children: ReactNode;
}
```

to:

```tsx
interface LensSurfaceProps {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  headerRight?: ReactNode;
  contextBar?: ReactNode;
  children: ReactNode;
}
```

- [ ] **Step 2: Destructure and render it**

Change the function signature:

```tsx
export function LensSurface({ title, onBack, headerRight, contextBar, children }: LensSurfaceProps) {
```

to:

```tsx
export function LensSurface({ title, icon, onBack, headerRight, contextBar, children }: LensSurfaceProps) {
```

Change the `headerLeft` block:

```tsx
        <View style={styles.headerLeft}>
          {handleBack && (
            <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <ChevronLeft size={20} color={palette.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
```

to:

```tsx
        <View style={styles.headerLeft}>
          {handleBack && (
            <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <ChevronLeft size={20} color={palette.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
          {icon}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check — no regression on other Lens screens**

Since `icon` defaults to `undefined` and renders nothing, `AreasScreen`, `MedicationsScreen`, and other `LensSurface` consumers are visually unchanged. No action needed beyond confirming (by reading) that none of them pass a 5th positional-like prop that would collide — they all use named props already, so this is safe by construction.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/LensSurface.tsx
git commit -m "feat: add optional icon slot to LensSurface header"
```

---

### Task 3: Emoji picker on `ProjectDetailScreen`

**Files:**
- Modify: `apps/mobile/src/screens/ProjectDetailScreen.tsx`

**Interfaces:**
- Consumes: `updateItemMetadata(id: string, metadata: Record<string, any>): void` and `getItemWithMetadata(id: string): Item | null` (both from `apps/mobile/src/db/database.ts`, already used elsewhere in the codebase — see Global Constraints). `ProjectPlaceholderIcon` from Task 1.
- Produces: mission's `metadata.icon: string` (single emoji), persisted via `updateItemMetadata`. Read back by Task 4 (`ProjectsScreen` row).

- [ ] **Step 1: Add imports**

At the top of `apps/mobile/src/screens/ProjectDetailScreen.tsx`, add `TextInput` to the existing `react-native` import and add two new imports:

Change:
```tsx
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
```
to:
```tsx
import { Alert, View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
```

Change:
```tsx
import { getRelatedItems, getBlockingTask, applyManualOrder, updateItemStatus, deleteItem, planForToday, unplanToday, isPlannedForToday } from '../db/database';
```
to:
```tsx
import { getRelatedItems, getBlockingTask, applyManualOrder, updateItemStatus, deleteItem, planForToday, unplanToday, isPlannedForToday, getItemWithMetadata, updateItemMetadata } from '../db/database';
```

Add, alongside the other component imports (after the `DependencyConnector` import line):
```tsx
import { ProjectPlaceholderIcon } from '../components/icons/ProjectPlaceholderIcon';
```

- [ ] **Step 2: Add icon state, load it on focus, and add a save handler**

Inside `export function ProjectDetailScreen()`, after the existing `const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());` line, add:

```tsx
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const emojiInputRef = useRef<TextInput>(null);
```

Add `useRef` to the existing React import:
```tsx
import { useCallback, useEffect, useState, useRef, memo } from 'react';
```

Find the existing `refresh` callback:
```tsx
  const refresh = useCallback(() => {
    setTasks(applyManualOrder(listKey, getRelatedItems(projectId, 'project')));
  }, [projectId, listKey]);
```

Change it to also load the mission's own metadata:

```tsx
  const refresh = useCallback(() => {
    setTasks(applyManualOrder(listKey, getRelatedItems(projectId, 'project')));
    const project = getItemWithMetadata(projectId);
    const meta = project?.metadata ? JSON.parse(project.metadata) : {};
    setIcon(typeof meta.icon === 'string' ? meta.icon : undefined);
  }, [projectId, listKey]);
```

Add a handler that persists a newly-picked emoji, placed after `refresh`:

```tsx
  const saveIcon = useCallback((nextIcon: string) => {
    const project = getItemWithMetadata(projectId);
    const meta = project?.metadata ? JSON.parse(project.metadata) : {};
    updateItemMetadata(projectId, { ...meta, icon: nextIcon });
    setIcon(nextIcon);
    emojiInputRef.current?.blur();
  }, [projectId]);
```

- [ ] **Step 3: Render the icon trigger + hidden emoji `TextInput`**

Find:
```tsx
  return (
    <LensSurface title={title}>
```

Change to:
```tsx
  return (
    <LensSurface
      title={title}
      icon={
        <TouchableOpacity
          onPress={() => emojiInputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel="Change mission icon"
          hitSlop={8}
        >
          {icon ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            <ProjectPlaceholderIcon size={22} />
          )}
          <TextInput
            ref={emojiInputRef}
            style={styles.hiddenEmojiInput}
            value=""
            onChangeText={(text) => {
              const firstChar = Array.from(text)[0];
              if (firstChar) saveIcon(firstChar);
            }}
            keyboardAppearance="dark"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </TouchableOpacity>
      }
    >
```

- [ ] **Step 4: Add the two new styles**

In the `StyleSheet.create({...})` block near the bottom of the file, add:

```tsx
  iconEmoji: {
    fontSize: 22,
  },
  hiddenEmojiInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run the app (per project convention — the RKA Launcher tool starts Expo on port 8082 for a dev-client build; see project memory `project_ios_dev_build`). Open a mission's detail screen:
- Confirm the placeholder folder icon appears next to the title when no emoji is set.
- Tap the icon — the emoji keyboard should appear (the hidden `TextInput` receives focus).
- Type an emoji — confirm it replaces the placeholder icon immediately and the keyboard dismisses.
- Navigate away and back to the mission — confirm the emoji persisted.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/ProjectDetailScreen.tsx
git commit -m "feat: add emoji icon picker to mission detail screen"
```

---

### Task 4: Show emoji/placeholder icon + Area badge on `ProjectsScreen` rows

**Files:**
- Modify: `apps/mobile/src/screens/ProjectsScreen.tsx`

**Interfaces:**
- Consumes: `ProjectPlaceholderIcon` (Task 1), `item.metadata` (JSON string, parsed inline), `areas: Item[]` (already loaded via `useAreas()`), `getRelation(itemId, relationType): string | null` (already imported in this file).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the placeholder icon import**

Change:
```tsx
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
```
to:
```tsx
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
import { ProjectPlaceholderIcon } from '../components/icons/ProjectPlaceholderIcon';
```

(`ProjectPortfolioIcon` stays imported — it's still used by `QuickCreateSheet`'s `icon` prop later in this same file.)

- [ ] **Step 2: Add an area-title lookup helper**

Inside `export function ProjectsScreen()`, after the existing:
```tsx
  const { projects, refresh } = useProjects();
  const { areas } = useAreas();
```

add:
```tsx
  const areaTitleById = new Map(areas.map(area => [area.id, area.title]));
```

- [ ] **Step 3: Update `renderRow` to show the icon and area badge**

Find:
```tsx
  const renderRow = (item: Item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => (navigation as any).navigate('ProjectDetail', { projectId: item.id, title: item.title })}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={400}
    >
      <ProjectPortfolioIcon size={34} />
      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{getProjectItemCount(item.id)}</Text>
    </TouchableOpacity>
  );
```

Replace with:
```tsx
  const renderRow = (item: Item) => {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    const icon: string | undefined = typeof meta.icon === 'string' ? meta.icon : undefined;
    const areaId = getRelation(item.id, 'area');
    const areaTitle = areaId ? areaTitleById.get(areaId) : undefined;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
        activeOpacity={0.7}
        onPress={() => (navigation as any).navigate('ProjectDetail', { projectId: item.id, title: item.title })}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        {icon ? <Text style={styles.rowIconEmoji}>{icon}</Text> : <ProjectPlaceholderIcon size={34} />}
        <View style={styles.rowTitleGroup}>
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
          {areaTitle ? (
            <View style={[styles.areaBadge, { backgroundColor: palette.fill }]}>
              <Text style={[styles.areaBadgeText, { color: palette.textSecondary }]} numberOfLines={1}>
                {areaTitle}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{getProjectItemCount(item.id)}</Text>
      </TouchableOpacity>
    );
  };
```

- [ ] **Step 4: Adjust `styles.rowTitle` and add the new styles**

`rowTitle` currently is a flat text style directly inside the row's flex-row; now that title + badge are grouped in `rowTitleGroup`, find `styles.rowTitle` in the `StyleSheet.create({...})` block and check its existing definition includes `flex: 1` (or similar) — that flex-consuming rule must move to `rowTitleGroup` so the layout doesn't break. Locate the current rule (e.g. `rowTitle: { flex: 1, fontSize: 16, fontWeight: '600' }` — exact values may differ slightly, keep them, just relocate `flex: 1`) and change it to:

```tsx
  rowTitleGroup: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowIconEmoji: {
    fontSize: 28,
    width: 34,
    textAlign: 'center',
  },
  areaBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  areaBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
```

(Keep whatever `fontSize`/`fontWeight` values `rowTitle` already had — only move `flex: 1` out to `rowTitleGroup` and add the four new style entries above.)

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

In the Missions list:
- A mission with no emoji and no area shows the placeholder folder icon, title, and count — no badge.
- A mission with an emoji set (from Task 3) shows that emoji instead of the placeholder.
- Long-press a mission → "Move to Domain..." → pick an area → confirm an area-name chip appears under its title.
- Long-press again → "Remove from domain" → confirm the chip disappears.
- Confirm row layout doesn't clip/wrap awkwardly with a long title + area chip together (test with a long mission title).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/ProjectsScreen.tsx
git commit -m "feat: show mission icon and area badge on Missions list rows"
```

---

## Self-Review Notes

- **Spec coverage:** Default placeholder icon → Task 1 & 4. Custom emoji icon, editable from detail screen → Task 2 & 3. Area text-chip badge → Task 4. All three spec goals covered.
- **Placeholder scan:** No TBD/TODO; all steps have concrete code.
- **Type consistency:** `updateItemMetadata(id: string, metadata: Record<string, any>)` and `getItemWithMetadata(id: string): Item | null` are used identically across Task 3 and match their real signatures from `database.ts`. `ProjectPlaceholderIcon({ size?, color? })` signature matches its Task 1 definition everywhere it's called (Task 3, Task 4).
- **Scope check:** Single subsystem (Missions screen + its detail screen), four tightly-scoped tasks, each independently testable and committed separately.
