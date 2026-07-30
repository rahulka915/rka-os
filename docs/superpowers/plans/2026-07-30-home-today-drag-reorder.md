# Home Today Tab Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Today's tasks in Home's `TodayCard` become drag-to-reorder, using the exact same infrastructure `TasksScreen`/`ProjectDetailScreen` already use.

**Architecture:** `TodayCard` switches its Today-tab local list from a derived `sortTodayItems()` (overdue-first) to `applyManualOrder('home:today', items)` held in local state, driven by `useHapticReorder`. Rendering switches from a plain `View`/`.map()` to `NestedReorderableList` (Home's outer scroll is already a reorderable-list `ScrollViewContainer`), with a `DragHandleButton` added to each row.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript, `react-native-reorderable-list` (already a dependency, already used identically by `TasksScreen.tsx`/`ProjectDetailScreen.tsx`). No automated UI test suite — manual verification per project convention.

## Global Constraints

- Only `apps/mobile/src/components/home/TodayCard.tsx` changes — no changes to `UpcomingScreen.tsx`, `TasksScreen.tsx`, `ProjectDetailScreen.tsx`, or `HomeScreen.tsx` (its props to `TodayCard` are unchanged).
- Upcoming tab stays exactly as-is: no drag handle, no reorder, plain `View`/`.map()`.
- List key for persistence: `'home:today'` (new, distinct from any existing list key).
- Overdue tasks (`item.status === 'overdue'`) keep red title styling regardless of position — this is per-row styling, not sort-driven.

---

### Task 1: Drag-to-reorder for the Today tab

**Files:**
- Modify: `apps/mobile/src/components/home/TodayCard.tsx` (current full content below — the entire file as of the last commit, `328c2da`'s predecessor `46e7fce`)

**Interfaces:**
- Consumes: `applyManualOrder<T extends { id: string }>(listKey: string, items: T[]): T[]` from `apps/mobile/src/db/database.ts`; `useHapticReorder<T extends { id: string }>(listKey: string, items: T[], onReordered: (items: T[]) => void): { isReordering: boolean; onDragStart: () => void; onIndexChange: () => void; onReorder: ({ from, to }: { from: number; to: number }) => void }` from `apps/mobile/src/hooks/useHapticReorder.ts`; `NestedReorderableList` from `react-native-reorderable-list`; `DragHandleButton` from `apps/mobile/src/components/ui/DragHandleButton.tsx` (props: `{ color: string }`).
- Produces: nothing consumed elsewhere — `TodayCardProps` is unchanged, this is a purely internal change.

The current full content of `apps/mobile/src/components/home/TodayCard.tsx`:

```tsx
import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { DeadlineBadge } from '../DeadlineBadge';
import { ChevronRight } from '../../icons';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';
import type { UpcomingGroup } from '../../utils/upcomingGrouping';

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  upcomingGroups: UpcomingGroup[];
  onViewUpcoming: () => void;
  isDark: boolean;
}

type TodayTab = 'today' | 'upcoming';

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

const UpcomingTaskRow = memo(function UpcomingTaskRow({
  item,
  isDark,
  onOpen,
}: {
  item: Item;
  isDark: boolean;
  onOpen: (item: Item) => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => onOpen(item)}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
      </View>
    </TouchableOpacity>
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

export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  upcomingGroups,
  onViewUpcoming,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);
  const [activeTab, setActiveTab] = useState<TodayTab>('today');
  const sorted = sortTodayItems(items);
  const hasUpcoming = upcomingGroups.some((group) => group.items.length > 0);

  return (
    <View style={styles.container}>
      <View style={[styles.segmentedControl, { backgroundColor: palette.fill }]}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'today' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'today' ? palette.text : palette.textSecondary }]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'upcoming' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'upcoming' ? palette.text : palette.textSecondary }]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'today' ? (
        sorted.length === 0 ? (
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
        )
      ) : !hasUpcoming ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing scheduled</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tasks with a future date land here</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {upcomingGroups.map((group) => (
            <View key={group.date}>
              <Text style={[styles.groupLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              <View style={styles.rows}>
                {group.items.map((item) => (
                  <UpcomingTaskRow key={item.id} item={item} isDark={isDark} onOpen={onOpen} />
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.row, styles.viewAllRow, { backgroundColor: palette.surface }]}
            activeOpacity={0.7}
            onPress={onViewUpcoming}
          >
            <Text style={[styles.rowTitle, { color: palette.textSecondary }]}>View all</Text>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
          </TouchableOpacity>
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
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
  viewAllRow: {
    justifyContent: 'space-between',
    minHeight: 44,
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

- [ ] **Step 1: Replace the entire file**

Write the full new content:

```tsx
import { memo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NestedReorderableList } from 'react-native-reorderable-list';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { DragHandleButton } from '../ui/DragHandleButton';
import { DeadlineBadge } from '../DeadlineBadge';
import { ChevronRight } from '../../icons';
import { getThemeColors } from '../../theme';
import { applyManualOrder } from '../../db/database';
import { useHapticReorder } from '../../hooks/useHapticReorder';
import type { Item } from '../../db/types';
import type { UpcomingGroup } from '../../utils/upcomingGrouping';

const TODAY_LIST_KEY = 'home:today';

interface TodayCardProps {
  items: Item[];
  completingIds: Set<string>;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  upcomingGroups: UpcomingGroup[];
  onViewUpcoming: () => void;
  isDark: boolean;
}

type TodayTab = 'today' | 'upcoming';

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
      <DragHandleButton color={palette.textMuted} />
    </View>
  );
});

const UpcomingTaskRow = memo(function UpcomingTaskRow({
  item,
  isDark,
  onOpen,
}: {
  item: Item;
  isDark: boolean;
  onOpen: (item: Item) => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => onOpen(item)}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
      </View>
    </TouchableOpacity>
  );
});

export function TodayCard({
  items,
  completingIds,
  onComplete,
  onOpen,
  upcomingGroups,
  onViewUpcoming,
  isDark,
}: TodayCardProps) {
  const palette = getThemeColors(isDark);
  const [activeTab, setActiveTab] = useState<TodayTab>('today');
  const hasUpcoming = upcomingGroups.some((group) => group.items.length > 0);

  // Manual drag order takes over from here — items land in their
  // last-persisted order (new items with no stored position fall to the
  // end). Overdue styling stays per-row (see TodayTaskRow), independent of
  // this order.
  const [ordered, setOrdered] = useState<Item[]>([]);
  useEffect(() => {
    setOrdered(applyManualOrder(TODAY_LIST_KEY, items));
  }, [items]);
  const { onDragStart, onIndexChange, onReorder } = useHapticReorder(TODAY_LIST_KEY, ordered, setOrdered);

  return (
    <View style={styles.container}>
      <View style={[styles.segmentedControl, { backgroundColor: palette.fill }]}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'today' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'today' ? palette.text : palette.textSecondary }]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'upcoming' && { backgroundColor: palette.surface }]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'upcoming' ? palette.text : palette.textSecondary }]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'today' ? (
        ordered.length === 0 ? (
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
                onComplete={onComplete}
                onOpen={onOpen}
              />
            )}
            onDragStart={onDragStart}
            onIndexChange={onIndexChange}
            onReorder={onReorder}
            scrollable={false}
          />
        )
      ) : !hasUpcoming ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing scheduled</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tasks with a future date land here</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {upcomingGroups.map((group) => (
            <View key={group.date}>
              <Text style={[styles.groupLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              <View style={styles.rows}>
                {group.items.map((item) => (
                  <UpcomingTaskRow key={item.id} item={item} isDark={isDark} onOpen={onOpen} />
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.row, styles.viewAllRow, { backgroundColor: palette.surface }]}
            activeOpacity={0.7}
            onPress={onViewUpcoming}
          >
            <Text style={[styles.rowTitle, { color: palette.textSecondary }]}>View all</Text>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
          </TouchableOpacity>
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
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
  viewAllRow: {
    justifyContent: 'space-between',
    minHeight: 44,
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
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). On Home's Today tab:
- Long-press a row's drag handle (trailing edge) and drag it to a new position — confirm it moves, haptics fire on each crossing and on drop.
- Close and reopen the app (or background/foreground it) — confirm the dragged order persists.
- Tap a row's checkbox — confirm it still completes the task (does not trigger a drag).
- Tap a row's title — confirm it still opens the item editor.
- Confirm an overdue task's title is still red regardless of where it sits in the list.
- Add a new task for today (e.g. via "Add to Today" elsewhere) — confirm it appears in the list without disturbing the existing manual order.
- Switch to the Upcoming tab — confirm no drag handles appear there and it behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/home/TodayCard.tsx
git commit -m "feat: add drag-to-reorder to Home's Today tab"
```

---

## Self-Review Notes

- **Spec coverage:** Manual-order-wins sort change → `applyManualOrder`/`useHapticReorder` wiring in Step 1. Drag handle + `NestedReorderableList` rendering → Step 1. Upcoming tab untouched → Step 1 (its block is byte-for-byte the same as before). Overdue red styling stays per-row → `TodayTaskRow` unchanged in that regard.
- **Placeholder scan:** No TBD/TODO; complete code in the single step.
- **Type consistency:** `applyManualOrder<Item>('home:today', items)` and `useHapticReorder<Item>('home:today', ordered, setOrdered)` match their real generic signatures from `database.ts`/`useHapticReorder.ts`. `TodayCardProps` is unchanged, so no ripple into `HomeScreen.tsx`.
- **Scope check:** Single file, single task — this is a self-contained, independently testable change.
