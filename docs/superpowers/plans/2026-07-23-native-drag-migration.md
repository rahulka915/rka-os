# Native-Feel Drag & Drop Migration Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace `react-native-draggable-flatlist@4.0.3` with `react-native-reorderable-list@0.18.1` across all three draggable surfaces, and add the missing iOS interaction cues — so reordering feels native.

**Why:** The old library targets Reanimated 2/3 and is years stale; this app runs Reanimated **4.5.0**, so it works only through compatibility paths. The replacement declares `reanimated >=3.12.0` / `gesture-handler >=2.12.0` (both satisfied), was published 2026-07-12, and provides three things we could not get before: an **`onIndexChange`** hook for the per-swap haptic tick (the single biggest missing native cue), a **`panGesture`** prop to resolve the swipe-vs-drag conflict on Home, and memoised row components that stop Home's 1×/sec re-render from reaching rows.

**Already done (do not repeat):** `react-native-reorderable-list@0.18.1` is installed.

## Global Constraints

- **`npm install` must use `--legacy-peer-deps`** in this repo.
- **Typecheck:** `npx tsc --noEmit` from `apps/mobile/` — clean before every commit.
- **Tests:** `npm test` (Node test runner, not Jest). The "Test Suites: N failed" line is a pre-existing unrelated quirk; judge by `pass N` / `fail 0`.
- **STAGE ONLY YOUR OWN FILES**, explicitly by full path. Never `git add -A`, `git add .`, or directory-level adds — this repo carries unrelated uncommitted work. Run `git status --porcelain` before each commit and `git restore --staged <path>` anything that isn't yours.
- **NEVER rewrite git history.** No `git reset`, `git rebase`, `git commit --amend`, or force operations. If a commit goes wrong, STOP and report it.
- **Row height must remain a pure function of the item**, never of list position. Badges (blocked/deadline/repeat/checklist) are all item-local — keep them that way.
- Do NOT start a dev server; Metro runs on 8082.
- Commit messages: conventional prefix, ending with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## API mapping (old → new)

| Old (`react-native-draggable-flatlist`) | New (`react-native-reorderable-list`) |
|---|---|
| `DraggableFlatList` | `ReorderableList` (default export) |
| `NestableScrollContainer` | `ScrollViewContainer` |
| `NestableDraggableFlatList` | `NestedReorderableList` (add `scrollable={false}`) |
| `renderItem={({item, drag, isActive}) => ...}` | `renderItem={({item}) => <Row item={item} />}` — `drag` now comes from `useReorderableDrag()` **inside** the row component |
| `<ScaleDecorator>` wrapper | delete — the library animates the active cell itself |
| `onDragBegin` | `useReorderableDragStart()` inside the row, or omit |
| `onDragEnd={({data}) => ...}` | `onReorder={({from, to}) => setX(reorderItems(x, from, to))}` |
| *(nothing)* | `onIndexChange` — **new**, fires on each swap; used for the haptic tick |
| `scrollEnabled={false}` on nested list | `scrollable={false}` |

`ReorderableList` extends `FlatListProps` minus `onScroll`, `scrollEventThrottle`, `removeClippedSubviews`, `CellRendererComponent`, `numColumns` — none of which we use.

---

### Task 1: Shared drag primitives

**Files:**
- Create: `apps/mobile/src/components/ui/dragFeel.ts`
- Rewrite: `apps/mobile/src/hooks/useHapticReorder.ts`
- Rewrite: `apps/mobile/src/components/ui/DragHandleButton.tsx`

- [ ] **Step 1: Create the shared feel module**

Create `apps/mobile/src/components/ui/dragFeel.ts`:

```ts
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// Reorder drags are vertical. On Home each row also has a horizontal
// SwipeableItem, and both are pan recognizers — so constrain the reorder pan
// to the Y axis and let it fail on decisive X movement. This is the library's
// documented way for the two gestures to coexist.
export function useVerticalDragGesture() {
  return useMemo(
    () => Gesture.Pan().activeOffsetY([-10, 10]).failOffsetX([-20, 20]),
    [],
  );
}
```

- [ ] **Step 2: Rewrite the reorder hook**

Replace the whole contents of `apps/mobile/src/hooks/useHapticReorder.ts`:

```ts
import { useCallback, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { reorderItems } from 'react-native-reorderable-list';
import { setManualOrder } from '../db/database';

function tickHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

// Shared drag-to-reorder behaviour for every manually-orderable list.
//
// The per-swap tick (onIndexChange) is the cue that makes reordering read as
// native: iOS fires a light impact every time the dragged row crosses a
// neighbour, not just on grab and drop. It must stay Light — it fires often,
// and anything heavier is unpleasant.
//
// `isReordering` is exposed only to hide cosmetic overlays mid-drag; it has no
// bearing on layout. Row height must stay a pure function of the item.
export function useHapticReorder<T extends { id: string }>(
  listKey: string,
  items: T[],
  onReordered: (items: T[]) => void,
) {
  const [isReordering, setIsReordering] = useState(false);

  const onDragStart = useCallback(() => {
    setIsReordering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // Must be a worklet — it runs on the UI thread as the drag crosses rows.
  const onIndexChange = useCallback(() => {
    'worklet';
    runOnJS(tickHaptic)();
  }, []);

  const onReorder = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      setIsReordering(false);
      const next = reorderItems(items, from, to);
      onReordered(next);
      setManualOrder(listKey, next.map((item) => item.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [items, listKey, onReordered],
  );

  return { isReordering, onDragStart, onIndexChange, onReorder };
}
```

- [ ] **Step 3: Rewrite the drag handle**

Replace the whole contents of `apps/mobile/src/components/ui/DragHandleButton.tsx`:

```tsx
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { DragHandle } from '../../icons';

interface DragHandleButtonProps {
  color: string;
}

// Shared grab affordance. `useReorderableDrag` may ONLY be called inside a
// list item component, which is why every row is now its own component —
// that also memoises rows so unrelated parent re-renders (Home ticks once a
// second) no longer re-render every row mid-drag.
export function DragHandleButton({ color }: DragHandleButtonProps) {
  const drag = useReorderableDrag();
  return (
    <TouchableOpacity onLongPress={drag} delayLongPress={150} hitSlop={10} style={styles.handle}>
      <DragHandle size={18} color={color} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 4: Typecheck**

`npx tsc --noEmit` will still report errors in the three screens (they haven't been migrated yet). That is expected at this point — confirm the ONLY errors are in `ProjectDetailScreen.tsx`, `TasksScreen.tsx`, `TimelineSection.tsx`, `HomeScreen.tsx`. Do not commit yet; commit at the end of Task 2 once the tree typechecks.

---

### Task 2: ProjectDetailScreen (simplest — plain list)

**Files:** Modify `apps/mobile/src/screens/ProjectDetailScreen.tsx`

- [ ] **Step 1: Swap imports**

Replace:
```ts
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
```
with:
```ts
import ReorderableList from 'react-native-reorderable-list';
```

- [ ] **Step 2: Extract the row into its own memoised component**

The existing `renderRow` closure must become a component, because `useReorderableDrag` (inside `DragHandleButton`) only works within a list item. Add this component ABOVE `export function ProjectDetailScreen()`, and move the row JSX into it. It takes everything the old closure captured as explicit props:

```tsx
const ProjectTaskRow = memo(function ProjectTaskRow({
  item,
  isDark,
  palette,
  cardBg,
  cardBorder,
  showConnector,
  isCompleting,
  onComplete,
  onOpen,
  onLongPress,
}: {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  cardBg: string;
  cardBorder: string;
  showConnector: boolean;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onLongPress: (item: Item) => void;
}) {
  const blocker = getBlockingTask(item.id);
  return (
    <View style={styles.cell}>
      {showConnector && <DependencyConnector isDark={isDark} leftOffset={CHECKBOX_CENTER_X} />}
      <View style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <LacquerDiscControl
          isCompleted={isCompleting}
          accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
          onToggle={() => onComplete(item)}
        />
        <TouchableOpacity
          style={styles.rowContent}
          activeOpacity={0.75}
          onPress={() => onOpen(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={400}
        >
          <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
          {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
          {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
          {checklistLabel(item) && (
            <Text style={[styles.rowTitle, { color: palette.textTertiary, fontSize: 12 }]}>{checklistLabel(item)}</Text>
          )}
        </TouchableOpacity>
        <DragHandleButton color={palette.textMuted} />
      </View>
    </View>
  );
});
```

Add `memo` to the React import at the top of the file. Note `isActive`/`ScaleDecorator` are gone — the library animates the active cell itself.

- [ ] **Step 2b: Preserve the existing badge set exactly**

Before writing the component, open the current file and copy the badge lines verbatim from the existing `renderRow` (blocked / deadline / repeat / checklist). Features A–D added these; the block above reflects them, but the file is the source of truth. If it differs, match the file, not this plan.

- [ ] **Step 3: Update the hook call and render**

Change the hook call to pass `tasks`:
```ts
const { isReordering, onDragStart, onIndexChange, onReorder } = useHapticReorder(listKey, tasks, setTasks);
```

Replace the `renderRow` function with a thin renderer:
```tsx
  const renderRow = ({ item }: { item: Item }) => {
    const index = tasks.findIndex((t) => t.id === item.id);
    const prevItem = tasks[index - 1];
    const blocker = getBlockingTask(item.id);
    const prevBlocksThis = !!blocker && !!prevItem && blocker.id === prevItem.id;
    const thisBlocksPrev = !!prevItem && getBlockingTask(prevItem.id)?.id === item.id;
    return (
      <ProjectTaskRow
        item={item}
        isDark={isDark}
        palette={palette}
        cardBg={cardBg}
        cardBorder={cardBorder}
        showConnector={!isReordering && (prevBlocksThis || thisBlocksPrev)}
        isCompleting={completingIds.has(item.id)}
        onComplete={handleComplete}
        onOpen={(t) => openEditorForItem({
          item: t,
          context: { projectId, projectTitle: title },
          onComplete: ({ action }) => { if (action !== 'cancelled') refresh(); },
        })}
        onLongPress={handleLongPress}
      />
    );
  };
```

Replace the list element:
```tsx
        <ReorderableList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
```
(`containerStyle` is not a prop here — use `contentContainerStyle`.)

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
```
Only `TasksScreen.tsx` / `TimelineSection.tsx` / `HomeScreen.tsx` errors may remain. Commit Tasks 1+2 together:
```bash
git add src/components/ui/dragFeel.ts src/hooks/useHapticReorder.ts src/components/ui/DragHandleButton.tsx src/screens/ProjectDetailScreen.tsx package.json package-lock.json
git commit -m "refactor(mobile): migrate ProjectDetail drag to react-native-reorderable-list

Old library targets Reanimated 2/3; this app runs 4.5. Adds the per-swap
haptic tick that makes reordering read as native.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: TasksScreen (nested, two lists)

**Files:** Modify `apps/mobile/src/screens/TasksScreen.tsx`

- [ ] **Step 1: Swap imports**

Replace the `react-native-draggable-flatlist` import with:
```ts
import { ScrollViewContainer, NestedReorderableList } from 'react-native-reorderable-list';
```

- [ ] **Step 2: Extract the row component**

Exactly as in Task 2, convert the body of `makeRenderRow` into a `memo`'d `TaskRow` component defined above `export function TasksScreen()`. It must render the same content the current row renders (project title, blocked / deadline / repeat / checklist badges) — copy those lines verbatim from the current file. Replace `<DragHandleButton onDrag={drag} .../>` with `<DragHandleButton color={palette.textMuted} />`, drop `ScaleDecorator` and `isActive`.

- [ ] **Step 3: Update both hook calls**

```ts
const activeReorder = useHapticReorder('tasks:active', active, setActive);
const somedayReorder = useHapticReorder('tasks:someday', someday, setSomeday);
```

- [ ] **Step 4: Swap the containers**

`<NestableScrollContainer ...>` → `<ScrollViewContainer ...>` (both occurrences, including the Logbook tab).

Each `<NestableDraggableFlatList ... scrollEnabled={false} />` becomes:
```tsx
                <NestedReorderableList
                  data={active}
                  keyExtractor={(item) => item.id}
                  renderItem={renderActiveRow}
                  onDragStart={activeReorder.onDragStart}
                  onIndexChange={activeReorder.onIndexChange}
                  onReorder={activeReorder.onReorder}
                  scrollable={false}
                />
```
and the same shape for `someday` using `somedayReorder`.

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/screens/TasksScreen.tsx
git commit -m "refactor(mobile): migrate Tasks drag to react-native-reorderable-list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Home — TimelineSection + HomeScreen, and the two saboteurs

This is the screen the user reports as worst. Two Home-specific problems must be fixed here or the migration will not feel better.

**Files:** Modify `apps/mobile/src/components/TimelineSection.tsx`, `apps/mobile/src/screens/HomeScreen.tsx`, `apps/mobile/src/hooks/usePersistentTimerState.ts`

- [ ] **Step 1: Stop the 1×/sec tick from re-rendering rows**

`usePersistentTimerState` runs `setInterval(() => setNow(Date.now()), 1000)` unconditionally, even with no active timer. HomeScreen consumes it, so all of TimelineSection re-renders every second — including mid-drag.

In `apps/mobile/src/hooks/usePersistentTimerState.ts`, find the `useEffect` containing `const id = setInterval(() => setNow(Date.now()), 1000);` and make the interval conditional on there being something to tick. Add an early return at the top of that effect's callback body, keeping the existing cleanup intact:

```ts
    if (timers.length === 0) return;
```

Add `timers.length` to that `useEffect`'s dependency array. Verify with `grep -n "setInterval" -A 6 -B 8 src/hooks/usePersistentTimerState.ts` first that `timers` is in scope at that point; if it is declared AFTER the effect, STOP and report rather than reordering declarations.

- [ ] **Step 2: Extract the timeline row component**

Convert the body of `renderRow` inside `TimeBlockItems` into a `memo`'d `TimelineTaskRow` component at module level (alongside the existing hoisted `TimeBlockItems`/`TimeBlockHeader`). Keep the `SwipeableItem` wrapper and all current badges. Replace `<DragHandleButton onDrag={drag} .../>` with `<DragHandleButton color={palette.textMuted} />`; drop `ScaleDecorator` and `isActive`.

Memoising the row is what makes Step 1 pay off — with stable props the rows no longer re-render on unrelated parent updates.

- [ ] **Step 3: Resolve the swipe-vs-drag gesture conflict**

Each row is wrapped in a horizontal `SwipeableItem` while the reorder drag is vertical; both are pan recognizers, so they fight. Pass the constrained gesture from Task 1.

In `TimeBlockItems`, add:
```ts
  const panGesture = useVerticalDragGesture();
```
(import it from `../components/ui/dragFeel` — adjust the relative path for this file: `./ui/dragFeel`.)

- [ ] **Step 4: Swap the list**

`<NestableDraggableFlatList ... scrollEnabled={false} />` becomes:
```tsx
      <NestedReorderableList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        onDragStart={onDragStart}
        onIndexChange={onIndexChange}
        onReorder={onReorder}
        panGesture={panGesture}
        scrollable={false}
      />
```
Update `TimeBlockItems`' props to accept `onDragStart` / `onIndexChange` / `onReorder` in place of `onDragBegin` / `onDragEnd`, and update the four `reorderByBlock[block.key]` call sites in `TimelineSection` accordingly. Update the four `useHapticReorder` calls to pass the block's items as the new second argument, e.g.:
```ts
const anytimeReorder = useHapticReorder<Item>('home:anytime', orderedBlocks.anytime, (data) => setOrderedBlocks((o) => ({ ...o, anytime: data })));
```

- [ ] **Step 5: Swap Home's outer container**

In `apps/mobile/src/screens/HomeScreen.tsx`, replace the `NestableScrollContainer` import and both JSX tags with `ScrollViewContainer` from `react-native-reorderable-list`.

- [ ] **Step 6: Commit the TimelineSection RepeatBadge line too**

`TimelineSection.tsx` currently carries an uncommitted `RepeatBadge` line from earlier work. It is correct — keep it and let it land with this commit.

- [ ] **Step 7: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/components/TimelineSection.tsx src/screens/HomeScreen.tsx src/hooks/usePersistentTimerState.ts
git commit -m "refactor(mobile): migrate Home drag and fix its two feel saboteurs

Stops the 1/sec timer tick re-rendering rows mid-drag, and constrains the
reorder pan to the Y axis so it no longer fights each row's swipe gesture.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Remove the old library

- [ ] **Step 1: Confirm nothing imports it**

Run: `cd apps/mobile && grep -rn "react-native-draggable-flatlist" src/ App.tsx`
Expected: no matches. If any remain, STOP and report — do not remove the package.

- [ ] **Step 2: Uninstall and verify**

```bash
cd apps/mobile && npm uninstall react-native-draggable-flatlist --legacy-peer-deps
npx tsc --noEmit
npm test
```
Both must be clean (`fail 0`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(mobile): drop react-native-draggable-flatlist

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Device verification (user only)

1. **Project detail** — drag a task. Expect: firm haptic on lift, a **light tick each time it passes another row** (new), medium on drop.
2. **Tasks** — reorder in Active and Someday; confirm the two lists stay independent and the page still scrolls.
3. **Home** — expand a time block, drag a row. Expect no per-second hitch, and horizontal swipe-to-activate/archive still works without triggering a drag.
4. **Home, scrolled** — scroll Home down first, then drag inside a block. This is the known weak spot for nested lists; report if the row jumps or the drag misplaces.

## Known follow-up (deliberately deferred)

The lift animation still uses the library default. `cellAnimations` accepts any `ViewStyle` key plus `transform`, but its values may apply constantly rather than only while dragging — a static `scale: 1.03` risks permanently scaling every row. Tune it only with the device visible, targeting iOS's subtle raise (~1.02–1.05 plus a shadow) rather than the old 1.1× pop.
