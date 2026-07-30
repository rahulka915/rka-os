# Home "Today" Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home shows a "Today" widget below the Inbox preview, listing today's tasks with checkbox-complete and tap-to-open, so the screen answers "what do I have to do today."

**Architecture:** A new `TodayCard` component reads `todayItems` from the already-existing `useHomeData()` hook (no new queries) and renders a flat, sorted (overdue-first) list of rows. `HomeScreen.tsx` regains two small handlers (`handleItemComplete`, `handleItemTap`) it lost in a prior cleanup pass, wires them to `TodayCard`, and destructures `todayItems` from `useHomeData()` alongside the `inboxCount`/`refresh` it already uses.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript. No automated UI test suite in this project — verification is manual via the iOS simulator/dev build, per existing project convention.

## Global Constraints

- No new database queries or hooks — reuse `useHomeData()`'s existing `todayItems` (`apps/mobile/src/hooks/useDb.ts:66-98`) unchanged.
- Tasks only — no medications, habits, or other item types (spec's non-goal).
- No time-of-day sectioning, no swipe actions, no drag-reorder, no stat/progress summary row (all spec non-goals).
- Overdue items (`item.status === 'overdue'`) sort first; row title renders in `palette.red` (`#ff3b30` light / `#ff5147` dark, from `apps/mobile/src/theme/colors.ts`) instead of `palette.text`.
- Completing a blocked task (has an incomplete `dependsOn` relation via `getBlockingTask`) must show the same `Alert.alert('Blocked', ...)` guard used elsewhere in the app, not silently complete it.

---

### Task 1: `TodayCard` component

**Files:**
- Create: `apps/mobile/src/components/home/TodayCard.tsx`

**Interfaces:**
- Consumes: `Item` type from `apps/mobile/src/db/types.ts`; `LacquerDiscControl`, `LACQUER_DISC_COMPLETION_DURATION` from `apps/mobile/src/components/ui/LacquerDiscControl.tsx` (props: `{ isCompleted: boolean; isEnabled?: boolean; onToggle: () => void; size?: number; accessibilityLabel?: string }`); `getThemeColors` from `apps/mobile/src/theme`.
- Produces: `TodayCard({ items, completingIds, onComplete, onOpen, isDark }: TodayCardProps)` — a React component. Consumed by Task 2 (`HomeScreen.tsx`).
  - `TodayCardProps`: `{ items: Item[]; completingIds: Set<string>; onComplete: (item: Item) => void; onOpen: (item: Item) => void; isDark: boolean }`

- [ ] **Step 1: Create the component file**

```tsx
// apps/mobile/src/components/home/TodayCard.tsx
import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  isDark: boolean;
}

const TodayTaskRow = memo(function TodayTaskRow({
  item,
  isDark,
  isCompleting,
  onComplete,
  onOpen,
}: {
  item: Item;
  isDark: boolean;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
}) {
  const palette = getThemeColors(isDark);
  const isOverdue = item.status === 'overdue';
  return (
    <View style={[styles.row, { backgroundColor: palette.surface }]}>
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
    </View>
  );
});

// Overdue items surface first so they're not buried in the day's list; the
// remainder keep whatever order useHomeData's todayItems already returns
// them in (no secondary sort key worth relying on there).
function sortTodayItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const aOverdue = a.status === 'overdue' ? 0 : 1;
    const bOverdue = b.status === 'overdue' ? 0 : 1;
    return aOverdue - bOverdue;
  });
}

export function TodayCard({ items, completingIds, onComplete, onOpen, isDark }: TodayCardProps) {
  const palette = getThemeColors(isDark);
  const sorted = sortTodayItems(items);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
        TODAY · {items.length} {items.length === 1 ? 'TASK' : 'TASKS'}
      </Text>
      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to do today</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Enjoy the calm</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {sorted.map((item) => (
            <TodayTaskRow
              key={item.id}
              item={item}
              isDark={isDark}
              isCompleting={completingIds.has(item.id)}
              onComplete={onComplete}
              onOpen={onOpen}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors mentioning `TodayCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/TodayCard.tsx
git commit -m "feat: add TodayCard component for Home's today-tasks widget"
```

---

### Task 2: Wire `TodayCard` into `HomeScreen`

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (current full content below — this is the entire file as of the last commit, `d032bfc`)

**Interfaces:**
- Consumes: `TodayCard` from Task 1 (`TodayCardProps` as defined above); `todayItems: Item[]` from `useHomeData()` (`apps/mobile/src/hooks/useDb.ts:66-98`, already returns `{ todayItems, inboxCount, upcomingCount, anytime, morningItems, afternoonItems, eveningItems, refresh }`); `getBlockingTask(itemId: string): Item | null` and `updateItemStatus(id: string, status: Item['status']): void` from `apps/mobile/src/db/database.ts`; `useOpenItem()` from `apps/mobile/src/hooks/useOpenItem.ts` (returns `(options: OpenItemEditorOptions) => void`, where `OpenItemEditorOptions` is `{ item: Item } & OpenComposerOptions`, and `OpenComposerOptions` includes `onComplete?: (result: { action: string }) => void` per the existing call sites in `TasksScreen.tsx`/`ProjectDetailScreen.tsx`); `LACQUER_DISC_COMPLETION_DURATION` from `apps/mobile/src/components/ui/LacquerDiscControl.tsx`.
- Produces: nothing consumed by later tasks — this is the last task.

The current full content of `apps/mobile/src/screens/HomeScreen.tsx`:

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const { inboxCount, refresh } = useHomeData();

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) refresh();
  }, [inboxOpen, refresh]);

  useEffect(() => {
    refresh();
  }, [composerRevision, refresh]);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader
        onProfilePress={onHeroPress}
        onSettingsPress={onSettingsPress}
      />

      <ScrollViewContainer showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View>

        {/* Inbox preview */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
```

- [ ] **Step 1: Add imports**

Replace:
```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';
```

with:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { TodayCard } from '../components/home/TodayCard';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { useItemComposer } from '../components/item-composer';
import { useOpenItem } from '../hooks/useOpenItem';
import { getBlockingTask, updateItemStatus } from '../db/database';
import { LACQUER_DISC_COMPLETION_DURATION } from '../components/ui/LacquerDiscControl';
import type { Item } from '../db/types';
```

- [ ] **Step 2: Destructure `todayItems`, add `openItem` and `completingIds` state**

Replace:
```tsx
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const { inboxCount, refresh } = useHomeData();
```

with:
```tsx
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add `handleItemComplete` and `handleItemTap` handlers**

Insert immediately after the existing two `useEffect` calls (after the closing `}, [composerRevision, refresh]);` line), before the `return (`:

```tsx

  const handleItemComplete = useCallback((item: Item) => {
    if (completingIds.has(item.id)) return;
    const blocker = getBlockingTask(item.id);
    if (blocker) {
      Alert.alert('Blocked', `Complete "${blocker.title}" first.`, [{ text: 'OK' }]);
      return;
    }
    setCompletingIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'completed');
      refresh();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  }, [completingIds, refresh]);

  const handleItemTap = useCallback((item: Item) => {
    openItem({
      item,
      onComplete: ({ action }) => {
        if (action !== 'cancelled') refresh();
      },
    });
  }, [openItem, refresh]);
```

- [ ] **Step 4: Render `TodayCard` below the Inbox preview**

Replace:
```tsx
        {/* Inbox preview */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        </View>
```

with:
```tsx
        {/* Inbox preview */}
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today */}
        <TodayCard
          items={todayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          isDark={isDark}
        />

        </View>
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). On Home:
- A task scheduled for today, one added via "Add to Today" (long-press → Add to Today on Tasks/Missions), and a recurring task due today all appear under "TODAY".
- Tap a row's checkbox — the disc animates, then the task disappears from the list after `refresh()`.
- Set up a task blocked by another incomplete task (long-press → "Depends on..." on Tasks screen), try completing the blocked one from Home — confirm the "Blocked" alert appears and it stays in the list.
- Tap a row's title (not the checkbox) — confirm the item editor opens; save a change and confirm the list refreshes.
- Manually set a task's status to `overdue` (or let its due date lapse) — confirm its title renders in red and it sorts to the top of the list.
- With no tasks for today, confirm "Nothing to do today" / "Enjoy the calm" shows instead of an empty list.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: wire TodayCard into Home screen"
```

---

## Self-Review Notes

- **Spec coverage:** Data reuse (`todayItems`, no new queries) → Task 2 Step 2. Overdue-first sort + red accent → Task 1's `sortTodayItems`/`TodayTaskRow`. Checkbox-complete with blocked-task guard → Task 2 Step 3 (`handleItemComplete`). Tap-to-open → Task 2 Step 3 (`handleItemTap`). Empty state copy → Task 1 Step 1. No swipe/drag/medications/stat-row → none added, matches non-goals.
- **Placeholder scan:** No TBD/TODO; every step has concrete code.
- **Type consistency:** `TodayCardProps` in Task 1 (`items`, `completingIds`, `onComplete`, `onOpen`, `isDark`) matches exactly how Task 2 Step 4 invokes `<TodayCard ... />`. `handleItemComplete(item: Item)` and `handleItemTap(item: Item)` signatures in Task 2 match what `TodayCard`'s `onComplete`/`onOpen` props expect from Task 1.
- **Scope check:** Single subsystem (Home screen + one new component), two tightly-scoped tasks, each independently testable and committed separately.
