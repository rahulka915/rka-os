# Desktop Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the desktop sidebar's disabled Calendar placeholder: a day view with prev/next/today navigation, a quick-schedule bar, and a time-sorted flat list of that day's items.

**Architecture:** New `CalendarScreen.web.tsx` composes the existing `useCalendar(date)` hook and existing scheduling functions (`createTimedItem`, `updateItemStatus`) plus the shared `DetailPanel`/`ItemDetailForm`. `Sidebar.web.tsx`'s Calendar row stops being disabled. No new database code.

**Tech Stack:** React Native Web, `lucide-react-native`, existing `webTheme.ts` tokens.

## Global Constraints

- Desktop/web only — no mobile files touched.
- No new database/hook functions — `useCalendar`, `createTimedItem`, `updateItemStatus`, `formatDate` all already exist and work on web.
- Follow `webColors`/`webSpacing`/`webRadius`/`webFontSize` tokens exactly as used elsewhere.
- `tsc --noEmit` shows expected `TS2307` for `.web.tsx`-only cross-imports — not a real error. Use `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` (plain `npx tsc --noEmit` crashes with a stack overflow in this repo, unrelated to any change here).

---

### Task 1: Enable the Calendar sidebar entry

**Files:**
- Modify: `apps/mobile/src/webApp/Sidebar.web.tsx`

**Interfaces:**
- Produces: `SidebarView` now includes `'calendar'`, consumed by Task 3 (`AppShell.web.tsx`).

- [ ] **Step 1: Add `calendar` to the type and make the nav row live**

In `apps/mobile/src/webApp/Sidebar.web.tsx`, change the type:

```typescript
export type SidebarView = 'home' | 'inbox' | 'tasks' | 'areas' | 'calendar';
```

Replace the disabled Calendar row:

```typescript
        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <CalendarDays size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Calendar</Text>
          <Text style={styles.comingSoon}>Soon</Text>
        </Pressable>
```

with:

```typescript
        <Pressable
          onPress={() => onSelectView('calendar')}
          style={[styles.navRow, activeView === 'calendar' && styles.navRowActive]}
        >
          <CalendarDays
            size={18}
            color={activeView === 'calendar' ? webColors.accent : webColors.mutedForeground}
            strokeWidth={1.75}
          />
          <Text style={[styles.navLabel, activeView === 'calendar' && styles.navLabelActive]}>Calendar</Text>
        </Pressable>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new error kinds (pending `AppShell.web.tsx` wiring from Task 3 for the `'calendar'` case is fine mid-plan).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/Sidebar.web.tsx
git commit -m "feat(mobile): enable Calendar nav item in desktop sidebar"
```

---

### Task 2: Build the Calendar screen

**Files:**
- Create: `apps/mobile/src/webApp/CalendarScreen.web.tsx`

**Interfaces:**
- Consumes: `useCalendar(date)` from `../hooks/useDb` — returns `{ items, instances, timelineEntries, refresh }`, where `timelineEntries: TimelineEntry[]` is `{ item: Item; instance?: ItemInstance; time: string | null; minutes: number | null; timeOfDay: TimeOfDay; preferredTimeBucket: TimeOfDay; durationMinutes: number }` (per `apps/mobile/src/db/timelineEntry.ts:7-15`), already sorted time-first with untimed last.
- Consumes: `createTimedItem(type, title, scheduledDate, time, notes?)`, `updateItemStatus(id, status)`, `formatDate(date)` from `../db/database`.
- Consumes: `DetailPanel` from `./DetailPanel`, `ItemDetailForm` from `./ItemDetailForm`.
- Produces: named export `CalendarScreen` (no props), consumed by Task 3.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/webApp/CalendarScreen.web.tsx`:

```typescript
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCalendar } from '../hooks/useDb';
import { createTimedItem, updateItemStatus, formatDate } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return formatDate(date);
}

function dateLabelFor(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function CalendarScreen() {
  const [viewedDate, setViewedDate] = useState(() => formatDate(new Date()));
  const { timelineEntries, refresh } = useCalendar(viewedDate);
  const [titleText, setTitleText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = formatDate(new Date());
  const isToday = viewedDate === today;
  const selectedEntry = timelineEntries.find((e) => e.item.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = titleText.trim();
    if (!trimmed) return;
    createTimedItem('task', trimmed, viewedDate, timeText.trim() || '09:00');
    setTitleText('');
    setTimeText('');
    refresh();
  };

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => setViewedDate((d) => addDays(d, -1))} style={styles.navButton}>
            <ChevronLeft size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{dateLabelFor(viewedDate)}</Text>
            {!isToday ? (
              <Pressable onPress={() => setViewedDate(today)}>
                <Text style={styles.todayLink}>Today</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => setViewedDate((d) => addDays(d, 1))} style={styles.navButton}>
            <ChevronRight size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          </Pressable>
        </View>

        <View style={styles.captureRow}>
          <TextInput
            value={titleText}
            onChangeText={setTitleText}
            onSubmitEditing={submit}
            placeholder={`Schedule for ${dateLabelFor(viewedDate)}...`}
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureTitleInput}
          />
          <TextInput
            value={timeText}
            onChangeText={setTimeText}
            onSubmitEditing={submit}
            placeholder="09:00"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureTimeInput}
          />
        </View>

        {timelineEntries.length === 0 ? (
          <Text style={styles.empty}>Nothing scheduled for this day.</Text>
        ) : (
          <FlatList
            data={timelineEntries}
            keyExtractor={(entry) => entry.item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: entry }) => {
              const completed = entry.item.status === 'completed';
              return (
                <Pressable style={styles.row} onPress={() => setSelectedId(entry.item.id)}>
                  <Text style={styles.timeLabel}>{entry.time ?? 'Anytime'}</Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleComplete(entry.item);
                    }}
                    style={[styles.checkbox, completed && styles.checkboxDone]}
                  >
                    {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                  </Pressable>
                  <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                    {entry.item.title}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <DetailPanel visible={!!selectedEntry} onClose={() => setSelectedId(null)} title="Item">
        {selectedEntry ? (
          <ItemDetailForm
            item={selectedEntry.item}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
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
    paddingBottom: webSpacing[6],
    gap: webSpacing[4],
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  todayLink: {
    fontSize: webFontSize.sm,
    color: webColors.accent,
    fontWeight: '600',
  },
  captureRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  captureTitleInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureTimeInput: {
    width: 90,
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    textAlign: 'center',
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  listContent: {
    gap: webSpacing[2],
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
  timeLabel: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    width: 56,
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
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new error kinds.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/CalendarScreen.web.tsx
git commit -m "feat(mobile): add desktop Calendar screen"
```

---

### Task 3: Wire Calendar into the app shell

**Files:**
- Modify: `apps/mobile/src/webApp/AppShell.web.tsx`

**Interfaces:**
- Consumes: `CalendarScreen` from `./CalendarScreen` (Task 2).

- [ ] **Step 1: Add the import and render branch**

In `apps/mobile/src/webApp/AppShell.web.tsx`, add the import:

```typescript
import { CalendarScreen } from './CalendarScreen';
```

Change the `content` branching:

```typescript
  let content;
  if (activeView === 'home') content = <HomeScreen />;
  else if (activeView === 'inbox') content = <InboxScreen />;
  else if (activeView === 'tasks') content = <TasksScreen />;
  else if (activeView === 'calendar') content = <CalendarScreen />;
  else
    content = (
      <AreasProjectsScreen
        selectedAreaId={selectedAreaId}
        selectedProjectId={selectedProjectId}
        onSelectArea={handleSelectArea}
        onSelectProject={handleSelectProject}
      />
    );
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no errors other than the known `TS2307` set.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/AppShell.web.tsx
git commit -m "feat(mobile): wire desktop Calendar into the app shell"
```

---

### Task 4: Build, deploy, and verify in browser

**Files:** none (build/deploy/verification only)

- [ ] **Step 1: Build the web export**

Run: `cd apps/mobile && npm run web:build`
Expected: `Exported: dist` with no build errors.

- [ ] **Step 2: Deploy to Firebase Hosting**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase deploy --only hosting --project rka-os`
Expected: `Deploy complete!`.

- [ ] **Step 3: Verify in browser**

Use `preview_start` with the `mobile-web` launch config (reuse if running), reload, then use `preview_eval` (locating elements by `textContent` and dispatching a `click` MouseEvent on the nearest `r-cursor-*` ancestor, per the pattern that has worked reliably in every prior verification pass) plus `preview_screenshot` to confirm:
- Clicking "Calendar" in the sidebar shows today's date, highlighted active.
- The quick-schedule bar creates a real timed item (type a title + time, press Enter, confirm it appears in the list at the right time slot).
- Prev/Next day arrows navigate and the list updates; "Today" link appears when off today and jumps back correctly.
- Clicking a row opens the slide-over `DetailPanel`/`ItemDetailForm`; the checkbox toggles completion inline.

- [ ] **Step 4: No commit needed**

This task is verification-only; nothing to commit.

---

## What This Plan Does Not Do

- No week/month grid view, no drag-to-resize/reschedule.
- No recurring-item scheduling UI.
- No timezone handling beyond existing `formatDate`/`normalizeTimeInput` (local browser time).
