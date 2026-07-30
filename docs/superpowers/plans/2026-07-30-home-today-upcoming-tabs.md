# Home Today/Upcoming Tab Card + Compact Inbox Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TodayCard` on Home gains a Today/Upcoming segmented tab (Upcoming shows a capped, grouped preview with a "View all" link to the full Upcoming screen), and `InboxScrollCard` returns to its original compact half-width size.

**Architecture:** A new `useUpcomingPreview()` hook (mirroring the existing `useCompletedItems()`/`useArchivedItems()` pattern in `useDb.ts`) computes a capped, date-grouped preview using the same `getUpcomingItems`/`groupByScheduledDate` utilities the standalone Upcoming screen already uses. `TodayCard` renders a local tab-switch UI over two data sources it receives as props. `HomeScreen` wires the new hook and a new `onViewUpcoming` navigation callback threaded down from `App.tsx`.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript, `@react-navigation/native` v6 (nested navigator `navigate(tab, { screen })` pattern already used elsewhere in `App.tsx`). No automated UI test suite — verification is manual via the iOS simulator/dev build, per project convention.

## Global Constraints

- No new database queries — reuse `getUpcomingItems(fromDate: string): Item[]` and `groupByScheduledDate(items: Item[], today: string): UpcomingGroup[]` (`apps/mobile/src/utils/upcomingGrouping.ts`) unchanged.
- Upcoming tab preview is capped at 5 items total (across however many leading date groups that spans); no inner `ScrollView` for it (avoids nesting a scrollable list inside Home's page-level `ScrollViewContainer`).
- Upcoming tab rows: tap-to-open only, no checkbox (matches the standalone Upcoming screen's own row treatment).
- `InboxScrollCard.tsx` itself is not modified — only its wrapper `View`'s width in `HomeScreen.tsx` changes, from full-width back to `width: '50%'`. Its `aspectRatio: 1.16` on `squareCard` derives compact sizing automatically from the narrower width.

---

### Task 1: `useUpcomingPreview()` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts`

**Interfaces:**
- Consumes: `getUpcomingItems`, `formatDate` from `apps/mobile/src/db/database.ts` (not yet imported in this file); `groupByScheduledDate`, `type UpcomingGroup` from `apps/mobile/src/utils/upcomingGrouping.ts` (new import).
- Produces: `useUpcomingPreview(): { groups: UpcomingGroup[]; refresh: () => void }` — `groups` is already capped at 5 items total. Consumed by Task 3 (`HomeScreen.tsx`).

- [ ] **Step 1: Add the new imports**

In `apps/mobile/src/hooks/useDb.ts`, change:
```ts
import {
  getInboxItems,
  getTodayItems,
  getTodayInstances,
  getTodayLogs,
  getItemsByStatus,
  getItemsByType,
  createItem,
  updateItemStatus,
  deleteItem,
  completeInstance,
  getMedications,
  logMedicationTaken,
  logHalfDoseTaken,
  getMedicationLogs,
  getLastTakenLog,
  getItemsForDate,
  getInstancesForDate,
  getTimelineEntriesForDate,
  getDb,
  type MedicationMeta,
  getPersistentMedicationTimers,
  getCompletedItems,
  getPlannedTodayItems,
  getRepeatingItemsForToday,
} from '../db/database';
```
to:
```ts
import {
  getInboxItems,
  getTodayItems,
  getTodayInstances,
  getTodayLogs,
  getItemsByStatus,
  getItemsByType,
  createItem,
  updateItemStatus,
  deleteItem,
  completeInstance,
  getMedications,
  logMedicationTaken,
  logHalfDoseTaken,
  getMedicationLogs,
  getLastTakenLog,
  getItemsForDate,
  getInstancesForDate,
  getTimelineEntriesForDate,
  getDb,
  type MedicationMeta,
  getPersistentMedicationTimers,
  getCompletedItems,
  getPlannedTodayItems,
  getRepeatingItemsForToday,
  getUpcomingItems,
  formatDate,
} from '../db/database';
import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';
```

- [ ] **Step 2: Add the hook after `useArchivedItems`**

Find (`apps/mobile/src/hooks/useDb.ts:217-224`):
```ts
export function useArchivedItems() {
  const [items, setItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setItems(getItemsByStatus('archived'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, refresh };
}
```

Add immediately after it:
```ts

const UPCOMING_PREVIEW_LIMIT = 5;

// Caps a date-grouped list at `limit` items total, cutting off mid-group
// (not dropping whole trailing groups) — the "View all" row in the
// consuming UI covers whatever's cut off after this point.
function capUpcomingGroups(groups: UpcomingGroup[], limit: number): UpcomingGroup[] {
  const capped: UpcomingGroup[] = [];
  let remaining = limit;
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    capped.push({ ...group, items });
    remaining -= items.length;
  }
  return capped;
}

export function useUpcomingPreview() {
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);
  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setGroups(capUpcomingGroups(groupByScheduledDate(getUpcomingItems(today), today), UPCOMING_PREVIEW_LIMIT));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { groups, refresh };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useDb.ts
git commit -m "feat: add useUpcomingPreview hook for Home's Upcoming tab"
```

---

### Task 2: Add Today/Upcoming tabs to `TodayCard`

**Files:**
- Modify: `apps/mobile/src/components/home/TodayCard.tsx` (current full content below — this is the entire file as of the last commit)

**Interfaces:**
- Consumes: `UpcomingGroup` type from `apps/mobile/src/utils/upcomingGrouping.ts`; `DeadlineBadge` from `apps/mobile/src/components/DeadlineBadge.tsx` (props: `{ isDark: boolean; dueDate: string }`); `ChevronRight` from `apps/mobile/src/icons.tsx`.
- Produces: `TodayCardProps` gains `upcomingGroups: UpcomingGroup[]` and `onViewUpcoming: () => void`. Consumed by Task 3 (`HomeScreen.tsx`).

The current full content of `apps/mobile/src/components/home/TodayCard.tsx`:

```tsx
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

- [ ] **Step 1: Replace the entire file**

Write the full new content:

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

Note: `styles.container`'s `marginHorizontal: 12` is preserved from the original (it was previously on the outer container, now still is — the old `sectionLabel`'s "TODAY · N tasks" count text is replaced by the segmented control, per the approved design, which shows a tab switch instead of a static count label).

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors mentioning `TodayCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/TodayCard.tsx
git commit -m "feat: add Today/Upcoming tabs to Home's TodayCard"
```

---

### Task 3: Wire `useUpcomingPreview` + `onViewUpcoming` into `HomeScreen`, shrink Inbox card

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (current full content below)

**Interfaces:**
- Consumes: `useUpcomingPreview()` from Task 1; `TodayCard`'s new props (`upcomingGroups`, `onViewUpcoming`) from Task 2.
- Produces: `HomeScreenProps` gains `onViewUpcoming: () => void`. Consumed by Task 4 (`App.tsx`).

The current full content of `apps/mobile/src/screens/HomeScreen.tsx`:

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

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const { revision: composerRevision } = useItemComposer();
  const openItem = useOpenItem();
  const { inboxCount, todayItems, refresh } = useHomeData();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

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

        {/* Today */}
        <TodayCard
          items={todayItems}
          completingIds={completingIds}
          onComplete={handleItemComplete}
          onOpen={handleItemTap}
          isDark={isDark}
        />

        </View>
      </ScrollViewContainer>
    </YStack>
  );
}
```

- [ ] **Step 1: Add `onViewUpcoming` to props, import `useUpcomingPreview`**

Replace:
```tsx
import { useHomeData } from '../hooks/useDb';
```
with:
```tsx
import { useHomeData, useUpcomingPreview } from '../hooks/useDb';
```

Replace:
```tsx
interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress }: HomeScreenProps) {
```
with:
```tsx
interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
  onSettingsPress: () => void;
  onViewUpcoming: () => void;
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress, onSettingsPress, onViewUpcoming }: HomeScreenProps) {
```

- [ ] **Step 2: Call `useUpcomingPreview()` and refresh it alongside the existing refresh triggers**

Replace:
```tsx
  const { inboxCount, todayItems, refresh } = useHomeData();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

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
```
with:
```tsx
  const { inboxCount, todayItems, refresh } = useHomeData();
  const { groups: upcomingGroups, refresh: refreshUpcoming } = useUpcomingPreview();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) {
      refresh();
      refreshUpcoming();
    }
  }, [inboxOpen, refresh, refreshUpcoming]);

  useEffect(() => {
    refresh();
    refreshUpcoming();
  }, [composerRevision, refresh, refreshUpcoming]);
```

- [ ] **Step 3: Pass the new props to `TodayCard` and shrink the Inbox wrapper**

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
with:
```tsx
        {/* Inbox preview */}
        <View style={{ width: '50%', marginHorizontal: 12, marginTop: 8 }}>
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
          upcomingGroups={upcomingGroups}
          onViewUpcoming={onViewUpcoming}
          isDark={isDark}
        />

        </View>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: an error in `App.tsx` about the missing `onViewUpcoming` prop on `<HomeScreen ... />` — expected at this point, fixed in Task 4. Confirm no *other* errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: wire Upcoming preview and compact Inbox card into HomeScreen"
```

---

### Task 4: Thread `onViewUpcoming` from `App.tsx`

**Files:**
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `HomeScreenProps.onViewUpcoming` from Task 3.
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the prop to the `Home` tab's `HomeScreen` render**

Find (`apps/mobile/App.tsx:253-265`):
```tsx
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    isExperimentalHome ? (
                      <HomeScreenExperimental onInboxPress={() => setInboxOpen(true)} inboxOpen={inboxOpen} />
                    ) : (
                      <HomeScreen
                        onInboxPress={() => setInboxOpen(true)}
                        inboxOpen={inboxOpen}
                        onHeroPress={() => navigation.navigate('Profile')}
                        onSettingsPress={() => (navigation.getParent() as any)?.navigate('Settings')}
                      />
                    )
                  )}
```

Replace with:
```tsx
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    isExperimentalHome ? (
                      <HomeScreenExperimental onInboxPress={() => setInboxOpen(true)} inboxOpen={inboxOpen} />
                    ) : (
                      <HomeScreen
                        onInboxPress={() => setInboxOpen(true)}
                        inboxOpen={inboxOpen}
                        onHeroPress={() => navigation.navigate('Profile')}
                        onSettingsPress={() => (navigation.getParent() as any)?.navigate('Settings')}
                        onViewUpcoming={() => (navigation as any).navigate('Menu', { screen: 'Upcoming' })}
                      />
                    )
                  )}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (the Task 3 warning about the missing prop is now resolved).

- [ ] **Step 3: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). On Home:
- Today tab still behaves exactly as before (regression check: complete via checkbox, tap to open, overdue red/first).
- Switch to Upcoming — confirm future-scheduled tasks appear grouped under date labels (e.g. "TOMORROW"), capped at 5 total.
- Tap an Upcoming row (not "View all") — confirm the item editor opens, no checkbox is present.
- Tap "View all" — confirm it navigates to the full Upcoming screen (Menu → Upcoming) showing the complete list.
- With no future-scheduled tasks, confirm the Upcoming tab shows "Nothing scheduled" and no "View all" row.
- Confirm the Inbox card renders at roughly half its previous width, square-proportioned, in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat: thread onViewUpcoming into Home's HomeScreen"
```

---

## Self-Review Notes

- **Spec coverage:** Tab UI + Today unchanged/Upcoming grouped-capped-preview → Task 2. Data source (`getUpcomingItems`/`groupByScheduledDate`, capped, no new queries) → Task 1. "View all" navigation → Task 4 (with the prop plumbed through Task 3). Inbox card back to half-width → Task 3 Step 3. All spec goals and non-goals (no checkbox on Upcoming, no inner scroll, no changes to `UpcomingScreen.tsx`/`InboxScrollCard.tsx` internals) are respected.
- **Placeholder scan:** No TBD/TODO; every step has concrete, complete code.
- **Type consistency:** `useUpcomingPreview()`'s return (`{ groups: UpcomingGroup[], refresh }`) in Task 1 matches exactly how Task 3 destructures and passes it (`upcomingGroups={upcomingGroups}`) into `TodayCard`'s `upcomingGroups: UpcomingGroup[]` prop from Task 2. `onViewUpcoming: () => void` is consistent across Task 2's `TodayCardProps`, Task 3's `HomeScreenProps`, and Task 4's `App.tsx` call site.
- **Scope check:** Single subsystem (Home's Today widget + Inbox card sizing), four small tasks with a natural dependency order (hook → component → screen wiring → app-level navigation prop), each independently testable and committed separately.
