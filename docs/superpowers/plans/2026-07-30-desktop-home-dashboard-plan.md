# Desktop Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Home dashboard view to the desktop web app's sidebar (stats, quick capture, today-by-time-block, recently completed) and make it the default landing view.

**Architecture:** New `HomeScreen.web.tsx` composes existing hooks (`useHomeData`, `useCompletedItems`) and existing shared components (`DetailPanel`, `ItemDetailForm`) — no new data-layer code. `Sidebar.web.tsx` gains a `'home'` nav entry. `AppShell.web.tsx` defaults to it.

**Tech Stack:** React Native Web, `lucide-react-native` icons, existing `webTheme.ts` tokens.

## Global Constraints

- Desktop/web only — no mobile files touched.
- No new database/hook functions — `useHomeData()` and `useCompletedItems()` already exist and are platform-generic via Metro `.web` resolution.
- Follow `webColors`/`webSpacing`/`webRadius`/`webFontSize` tokens exactly as used in `TasksScreen.web.tsx`/`InboxScreen.web.tsx` — no new hardcoded colors.
- `tsc --noEmit` will show `TS2307 Cannot find module` for any `.web.tsx`-only cross-import (no `moduleSuffixes` configured) — this is expected and NOT a real error; verify no other error types appear.

---

### Task 1: Add Home to the sidebar

**Files:**
- Modify: `apps/mobile/src/webApp/Sidebar.web.tsx`

**Interfaces:**
- Produces: `SidebarView` now includes `'home'`, consumed by Task 3 (`AppShell.web.tsx`).

- [ ] **Step 1: Add the `home` view and nav item**

In `apps/mobile/src/webApp/Sidebar.web.tsx`:

Change the import line to add `Home`:

```typescript
import { Home, Inbox, ListTodo, CalendarDays, Folder } from 'lucide-react-native';
```

Change the type:

```typescript
export type SidebarView = 'home' | 'inbox' | 'tasks';
```

Change `NAV_ITEMS` to list Home first:

```typescript
const NAV_ITEMS: Array<{ view: SidebarView; label: string; Icon: typeof Inbox }> = [
  { view: 'home', label: 'Home', Icon: Home },
  { view: 'inbox', label: 'Inbox', Icon: Inbox },
  { view: 'tasks', label: 'Tasks', Icon: ListTodo },
];
```

No other changes needed — the existing `.map` over `NAV_ITEMS`, active-state styling, and inbox-count-badge logic (`view === 'inbox'`) all keep working unchanged since they already key off `view`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new errors printed (TS2307 lines are filtered out as expected/known).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/Sidebar.web.tsx
git commit -m "feat(mobile): add Home nav item to desktop sidebar"
```

---

### Task 2: Build the Home dashboard screen

**Files:**
- Create: `apps/mobile/src/webApp/HomeScreen.web.tsx`

**Interfaces:**
- Consumes: `useHomeData()` from `../hooks/useDb` — returns `{ todayItems, inboxCount, upcomingCount, anytime, morningItems, afternoonItems, eveningItems, refresh }` (all `Item[]` except counts, per `apps/mobile/src/hooks/useDb.ts:86-118`).
- Consumes: `useCompletedItems()` from `../hooks/useDb` — returns `{ items, refresh }` (`Item[]`, sorted `completedAt` desc, per `apps/mobile/src/hooks/useDb.ts:228-235`).
- Consumes: `updateItemStatus(id, status)`, `createItem(type, title, status)`, `formatDate(date)` from `../db/database`.
- Consumes: `DetailPanel` from `./DetailPanel`, `ItemDetailForm` from `./ItemDetailForm` (same props contract as used in `TasksScreen.web.tsx`).
- Consumes: `webColors`, `webSpacing`, `webRadius`, `webFontSize` from `../theme/webTheme`.
- Produces: default export-free named export `HomeScreen` (function component, no props), consumed by Task 3.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/webApp/HomeScreen.web.tsx`:

```typescript
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useHomeData, useCompletedItems } from '../hooks/useDb';
import { updateItemStatus, createItem, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

const BUCKETS: Array<{ key: 'morningItems' | 'afternoonItems' | 'eveningItems' | 'anytime'; label: string }> = [
  { key: 'morningItems', label: 'MORNING' },
  { key: 'afternoonItems', label: 'AFTERNOON' },
  { key: 'eveningItems', label: 'EVENING' },
  { key: 'anytime', label: 'ANYTIME' },
];

function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HomeScreen() {
  const { anytime, morningItems, afternoonItems, eveningItems, inboxCount, upcomingCount, refresh } = useHomeData();
  const { items: completedItems, refresh: refreshCompleted } = useCompletedItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');

  const buckets = { morningItems, afternoonItems, eveningItems, anytime };
  const todayCount = morningItems.length + afternoonItems.length + eveningItems.length + anytime.length;
  const today = formatDate(new Date());
  const completedTodayCount = completedItems.filter(
    (item) => item.completedAt != null && formatDate(new Date(item.completedAt)) === today
  ).length;

  const allTodayItems = [...morningItems, ...afternoonItems, ...eveningItems, ...anytime];
  const selectedItem = allTodayItems.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
    refreshCompleted();
  };

  const submitCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('task', trimmed);
    setCaptureText('');
    refresh();
  };

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Inbox" value={inboxCount} />
          <StatCard label="Today" value={todayCount} />
          <StatCard label="Upcoming" value={upcomingCount} />
          <StatCard label="Completed today" value={completedTodayCount} />
        </View>

        <View style={styles.captureRow}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
          <TextInput
            value={captureText}
            onChangeText={setCaptureText}
            onSubmitEditing={submitCapture}
            placeholder="Add to inbox..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInput}
          />
        </View>

        {todayCount === 0 ? (
          <Text style={styles.empty}>Nothing scheduled for today.</Text>
        ) : (
          BUCKETS.map(({ key, label }) => {
            const bucketItems = buckets[key];
            if (bucketItems.length === 0) return null;
            return (
              <View key={key} style={styles.section}>
                <Text style={styles.sectionLabel}>{label}</Text>
                {bucketItems.map((item) => {
                  const completed = item.status === 'completed';
                  return (
                    <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleComplete(item);
                        }}
                        style={[styles.checkbox, completed && styles.checkboxDone]}
                      >
                        {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                      </Pressable>
                      <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}

        {completedItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENTLY COMPLETED</Text>
            {completedItems.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.completedRow}>
                <Check size={13} color={webColors.accent} strokeWidth={2.5} />
                <Text style={styles.completedTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.completedTime}>
                  {item.completedAt != null ? relativeTime(item.completedAt) : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Task">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={() => {
              refresh();
              refreshCompleted();
            }}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
              refreshCompleted();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  dateLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  statsRow: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[4],
  },
  statValue: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  statLabel: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginTop: webSpacing[1],
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  section: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  completedTitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    flex: 1,
  },
  completedTime: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new errors printed.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/HomeScreen.web.tsx
git commit -m "feat(mobile): add desktop Home dashboard screen"
```

---

### Task 3: Wire Home into the app shell as the default view

**Files:**
- Modify: `apps/mobile/src/webApp/AppShell.web.tsx`

**Interfaces:**
- Consumes: `HomeScreen` from `./HomeScreen` (Task 2), `SidebarView` from `./Sidebar` (Task 1, now includes `'home'`).

- [ ] **Step 1: Update AppShell**

Replace the full contents of `apps/mobile/src/webApp/AppShell.web.tsx`:

```typescript
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { useInbox } from '../hooks/useDb';
import { webColors } from '../theme/webTheme';

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const { count: inboxCount } = useInbox();

  return (
    <View style={styles.container}>
      <Sidebar activeView={activeView} onSelectView={setActiveView} inboxCount={inboxCount} />
      <View style={styles.content}>
        {activeView === 'home' ? <HomeScreen /> : activeView === 'inbox' ? <InboxScreen /> : <TasksScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: webColors.background,
    height: '100%',
  },
  content: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new errors printed.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/AppShell.web.tsx
git commit -m "feat(mobile): make Home the default desktop landing view"
```

---

### Task 4: Build, deploy, and verify in browser

**Files:** none (build/deploy/verification only)

- [ ] **Step 1: Build the web export**

Run: `cd apps/mobile && npm run web:build`
Expected: `Exported: dist` with no build errors.

- [ ] **Step 2: Deploy to Firebase Hosting**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase deploy --only hosting --project rka-os`
Expected: `Deploy complete!` with the hosting URL `https://rka-os.web.app`.

- [ ] **Step 3: Verify in browser**

Use `preview_start` with the `mobile-web` launch config, then `preview_screenshot` (plain, no eval hack — this was the reliable pattern from the prior verification session) to confirm:
- Home is the view shown immediately after sign-in (not Inbox).
- Sidebar shows Home above Inbox, with Home highlighted active.
- Stat cards render with real counts.
- Quick capture bar is visible.
- Today's time-block sections (or the empty state) render.
- Recently completed section renders if any completed items exist.

If a real signed-in session isn't available in the preview tab, note that in the report and ask the user to spot-check `https://rka-os.web.app` themselves — do not block completion on this alone since sign-in state is tied to a real Firebase session.

- [ ] **Step 4: No commit needed**

This task is verification-only; nothing to commit.

---

## What This Plan Does Not Do

- No drag-reorder, project/area grouping, or charts on Home.
- No new database functions — everything is composed from `useHomeData()`, `useCompletedItems()`, `updateItemStatus`, `createItem`, all of which already exist and work on web.
- Recently-completed rows are read-only (no un-complete from Home) by design, per the spec.
