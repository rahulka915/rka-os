# Habit Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a habit on mobile or web opens a dedicated detail page (streak, month calendar, chronological log, tap-to-toggle past days) instead of the generic item editor.

**Architecture:** A shared pure calendar-grid builder (`buildHabitCalendarMonth`) and a shared DB-layer toggle (`toggleHabitOccurrence`) — added once each to `database.ts`/`database.web.ts` — drive both a new mobile screen (joining the existing Area/Project/Object dedicated-screen pattern) and a new web detail-panel view (swapped into the existing `DetailPanel`).

**Tech Stack:** React Native (Expo SDK 54) + React Navigation (mobile), React Native Web (desktop), existing `repeat.ts`/`streak.ts`/`habits.ts` pure utils, existing `activityLogs` SQLite table / Firestore mirror.

## Global Constraints

- `toggleHabitOccurrence` never touches `item.scheduledDate` or runs rrule roll-forward — only adds/removes a `completed-occurrence` activity log entry. The existing check-in controls (Home widget, Habits list) are untouched.
- Only past days (including today) that match the habit's `rrule` are toggleable; future or non-matching days are inert.
- Verify with `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` from `apps/mobile/`, filtering `TS2307`. No test suite covers screens/components in this repo — manual on-device (mobile) / browser (web, via the desktop web app deploy) verification is the bar, matching every prior feature this session.

---

### Task 1: Shared calendar builder + `toggleHabitOccurrence` (both platforms)

**Files:**
- Create: `apps/mobile/src/utils/habitCalendar.ts`
- Modify: `apps/mobile/src/db/database.ts` (add `toggleHabitOccurrence`, near `getCompletedOccurrenceDates` at line ~410)
- Modify: `apps/mobile/src/db/database.web.ts` (add `toggleHabitOccurrence`, near `getCompletedOccurrenceDates` at line ~296)

**Interfaces:**
- Produces: `buildHabitCalendarMonth(rrule, completedDates, anchor, today): HabitCalendarMonth` — imported by both `HabitDetailScreen.tsx` (Task 2) and `HabitDetailPanel.web.tsx` (Task 3).
- Produces: `toggleHabitOccurrence(itemId: string, date: string): void` — exported from both `database.ts` and `database.web.ts`, same name and signature, called by Task 2 and Task 3.

- [ ] **Step 1: Create `src/utils/habitCalendar.ts`**

```typescript
import { parseRepeatRule, dayMatchesRepeat, addDays } from './repeat';

export interface HabitCalendarDay {
  date: string;           // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isScheduled: boolean;   // rrule matches this date
  isCompleted: boolean;   // in completedDates
  isToday: boolean;
  isFuture: boolean;      // date > today
}

export interface HabitCalendarMonth {
  year: number;
  month: number;          // 0-11
  label: string;          // "August 2026"
  weeks: HabitCalendarDay[][];
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Builds full calendar weeks (Sun-Sat) covering the target month, including
// leading/trailing days from adjacent months so every week row has 7 cells.
export function buildHabitCalendarMonth(
  rrule: string | null | undefined,
  completedDates: Set<string>,
  anchor: Date,
  today: string,
): HabitCalendarMonth {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const rule = parseRepeatRule(rrule);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOfMonth = toDateString(year, month, 1);
  const firstWeekday = new Date(`${firstOfMonth}T00:00:00`).getDay();

  const cells: HabitCalendarDay[] = [];

  // Leading days from the previous month.
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = addDays(firstOfMonth, -(i + 1));
    cells.push(buildDay(date, false, rule, completedDates, today));
  }

  // Days in the target month.
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDateString(year, month, day);
    cells.push(buildDay(date, true, rule, completedDates, today));
  }

  // Trailing days from the next month, padded to a full week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const date = addDays(last, 1);
    cells.push(buildDay(date, false, rule, completedDates, today));
  }

  const weeks: HabitCalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { year, month, label: `${MONTH_LABELS[month]} ${year}`, weeks };
}

function buildDay(
  date: string,
  inCurrentMonth: boolean,
  rule: ReturnType<typeof parseRepeatRule>,
  completedDates: Set<string>,
  today: string,
): HabitCalendarDay {
  return {
    date,
    dayOfMonth: Number(date.split('-')[2]),
    inCurrentMonth,
    isScheduled: rule ? dayMatchesRepeat(rule, date) : false,
    isCompleted: completedDates.has(date),
    isToday: date === today,
    isFuture: date > today,
  };
}
```

- [ ] **Step 2: Add `toggleHabitOccurrence` to `apps/mobile/src/db/database.ts`**

Insert directly after `getCompletedOccurrenceDates` (after its closing `}`, currently ending around line 411):

```typescript
// Adds or removes a single 'completed-occurrence' log entry for an arbitrary
// date — used by the habit detail page's calendar to backfill a forgotten
// check-in or undo a mistaken one. Deliberately does NOT touch
// item.scheduledDate or run the rrule roll-forward updateItemStatus performs
// for "check in today" — streak/isCompletedToday are derived purely from
// these log entries, so this stays fully consistent with the existing
// check-in controls without needing to replicate their roll-forward logic.
export function toggleHabitOccurrence(itemId: string, date: string): void {
  const rows = getDb().getAllSync<{ id: string; details: string | null }>(
    `SELECT id, details FROM activityLogs WHERE entityId = ? AND actionType = 'completed-occurrence'`,
    [itemId]
  );
  const existing = rows.find((row) => {
    if (!row.details) return false;
    try {
      return (JSON.parse(row.details) as { occurrence?: string }).occurrence === date;
    } catch {
      return false;
    }
  });
  if (existing) {
    getDb().runSync(`DELETE FROM activityLogs WHERE id = ?`, [existing.id]);
  } else {
    logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }));
  }
}
```

- [ ] **Step 3: Add `toggleHabitOccurrence` to `apps/mobile/src/db/database.web.ts`**

Insert directly after `getCompletedOccurrenceDates` (after its closing `}`, currently ending around line 296):

```typescript
// Web mirror of database.ts's toggleHabitOccurrence — same log-only
// semantics, Firestore instead of SQL.
export function toggleHabitOccurrence(itemId: string, date: string): void {
  const existing = getActivityLogsSnapshot().find((log) => {
    if (log.entityId !== itemId || log.actionType !== 'completed-occurrence' || !log.details) return false;
    try {
      return (JSON.parse(log.details) as { occurrence?: string }).occurrence === date;
    } catch {
      return false;
    }
  });
  if (existing) {
    write(deleteActivityLogDoc(existing.id), 'toggleHabitOccurrence');
  } else {
    logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }));
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `cd "apps/mobile" && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit > /tmp/tsc_habitcal1.txt 2>&1; grep -v "TS2307" /tmp/tsc_habitcal1.txt`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/habitCalendar.ts apps/mobile/src/db/database.ts apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): add habit calendar builder and toggleHabitOccurrence

Shared pure month-grid builder plus a DB-layer toggle for individual
completed-occurrence log entries, used by the upcoming habit detail page on
both mobile and web to show and correct check-in history."
```

---

### Task 2: Mobile `HabitDetailScreen`

**Files:**
- Create: `apps/mobile/src/screens/HabitDetailScreen.tsx`
- Modify: `apps/mobile/src/hooks/useOpenItem.ts`
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `buildHabitCalendarMonth`, `toggleHabitOccurrence` (Task 1); `getItemWithMetadata(id): Item | null`, `getCompletedOccurrenceDates(itemId): Set<string>`, `formatDate(date: Date): string` (all existing, `../db/database`); `computeStreak(rrule, completedDates, today): number` (existing, `../utils/streak`); `LensSurface` (existing, `../components/LensSurface`); `useItemComposer().openEditorForItem({ item, onComplete }): void` (existing).
- Produces: `HabitDetailScreen()` — registered as root-stack route `"HabitDetail"` with params `{ habitId: string; title: string }`.

- [ ] **Step 1: Create `src/screens/HabitDetailScreen.tsx`**

```tsx
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemWithMetadata, getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence } from '../db/database';
import { computeStreak } from '../utils/streak';
import { buildHabitCalendarMonth, type HabitCalendarDay } from '../utils/habitCalendar';
import { useItemComposer } from '../components/item-composer';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ChevronLeft, ChevronRight, Flame, Pencil } from '../icons';
import type { Item } from '../db/types';

interface HabitDetailRouteParams {
  habitId: string;
  title: string;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { habitId } = route.params as HabitDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem } = useItemComposer();

  const [item, setItem] = useState<Item | null>(null);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [monthAnchor, setMonthAnchor] = useState(new Date());

  const today = formatDate(new Date());

  const load = useCallback(() => {
    const loaded = getItemWithMetadata(habitId);
    setItem(loaded);
    setCompletedDates(getCompletedOccurrenceDates(habitId));
  }, [habitId]);

  useFocusEffect(load);

  const streak = useMemo(
    () => (item ? computeStreak(item.rrule, completedDates, today) : 0),
    [item, completedDates, today],
  );

  const calendar = useMemo(
    () => buildHabitCalendarMonth(item?.rrule, completedDates, monthAnchor, today),
    [item, completedDates, monthAnchor, today],
  );

  const sortedLog = useMemo(
    () => [...completedDates].sort((a, b) => b.localeCompare(a)),
    [completedDates],
  );

  const handleToggleDay = (day: HabitCalendarDay) => {
    if (!day.isScheduled || day.isFuture) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleHabitOccurrence(habitId, day.date);
    load();
  };

  const handleEdit = () => {
    if (!item) return;
    openEditorForItem({
      item,
      onComplete: ({ action }) => {
        if (action === 'deleted') {
          navigation.goBack();
        } else {
          load();
        }
      },
    });
  };

  if (!item) {
    return <LensSurface title="Habit"><View /></LensSurface>;
  }

  return (
    <LensSurface
      title={item.title}
      headerRight={
        <TouchableOpacity onPress={handleEdit} hitSlop={12}>
          <Pencil size={19} color={palette.text} strokeWidth={1.75} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.streakRow}>
          <Flame size={22} color={streak > 0 ? palette.red : palette.textTertiary} />
          <Text style={[styles.streakText, { color: streak > 0 ? palette.red : palette.textTertiary }]}>
            {streak} day{streak === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month - 1, 1))} hitSlop={10}>
            <ChevronLeft size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: palette.text }]}>{calendar.label}</Text>
          <TouchableOpacity onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month + 1, 1))} hitSlop={10}>
            <ChevronRight size={18} color={palette.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={[styles.weekdayLabel, { color: palette.textTertiary }]}>{label}</Text>
          ))}
        </View>

        {calendar.weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day) => {
              const disabled = !day.isScheduled || day.isFuture;
              return (
                <TouchableOpacity
                  key={day.date}
                  onPress={() => handleToggleDay(day)}
                  disabled={disabled}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      day.isCompleted && { backgroundColor: palette.red },
                      !day.isCompleted && day.isScheduled && !day.isFuture && { borderWidth: 1.5, borderColor: palette.red },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: day.isCompleted ? palette.surface : day.inCurrentMonth ? palette.text : palette.textTertiary },
                      ]}
                    >
                      {day.dayOfMonth}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <Text style={[styles.logHeader, { color: palette.textSecondary }]}>History</Text>
        {sortedLog.length === 0 ? (
          <Text style={[styles.logEmpty, { color: palette.textTertiary }]}>No check-ins yet.</Text>
        ) : (
          sortedLog.map((date) => (
            <View key={date} style={[styles.logRow, { borderBottomColor: palette.separator }]}>
              <Text style={[styles.logDate, { color: palette.text }]}>
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '700',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  logEmpty: {
    fontSize: 14,
  },
  logRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logDate: {
    fontSize: 14,
    fontWeight: '500',
  },
});
```

- [ ] **Step 2: Add the `habit` case to `useOpenItem.ts`**

In `apps/mobile/src/hooks/useOpenItem.ts`, add a case alongside the existing `object`/`area`/`project` ones:

```typescript
      case 'habit':
        navigateTo('HabitDetail', { habitId: item.id, title: item.title });
        return;
```

Update the file's top comment (`... every other type ... still has no dedicated screen ...`) to remove `habit` from that list, since it's no longer accurate.

- [ ] **Step 3: Register the route in `App.tsx`**

Add the import alongside the existing detail-screen imports (after `import { ObjectDetailScreen } from './src/screens/ObjectDetailScreen';`):

```typescript
import { HabitDetailScreen } from './src/screens/HabitDetailScreen';
```

Add the route registration alongside `ObjectDetail`'s (after its `<RootStack.Screen name="ObjectDetail" .../>` block):

```tsx
          <RootStack.Screen
            name="HabitDetail"
            component={HabitDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
```

- [ ] **Step 4: Typecheck**

Run: `cd "apps/mobile" && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit > /tmp/tsc_habitdetail.txt 2>&1; grep -v "TS2307" /tmp/tsc_habitdetail.txt`

Expected: no output.

- [ ] **Step 5: Manual verification on device/simulator**

Start the dev client, open Habits:
- Tap a habit row → lands on the new detail screen (not the generic editor).
- Streak number matches what the list showed.
- Calendar shows the current month; days matching the rrule are outlined, completed days filled; tapping a past scheduled day toggles it and the streak/log update immediately.
- Tapping a future day or a non-scheduled day does nothing.
- Pencil icon opens the generic editor; renaming or changing repeat there and returning reflects on this screen; deleting from there returns to the Habits list.
- Long-press "Edit" on the Habits list row now also lands here (same destination as a tap).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/HabitDetailScreen.tsx apps/mobile/src/hooks/useOpenItem.ts apps/mobile/App.tsx
git commit -m "feat(mobile): add HabitDetailScreen with calendar and history

Tapping a habit now opens a dedicated screen — streak, a tappable month
calendar for correcting past check-ins, and a chronological log — joining
the existing Area/Project/Object dedicated-screen pattern instead of falling
through to the generic task-shaped editor."
```

---

### Task 3: Web `HabitDetailPanel`

**Files:**
- Create: `apps/mobile/src/webApp/HabitDetailPanel.web.tsx`
- Modify: `apps/mobile/src/webApp/HabitsScreen.web.tsx`

**Interfaces:**
- Consumes: `buildHabitCalendarMonth`, `toggleHabitOccurrence` (Task 1); `getCompletedOccurrenceDates(itemId): Set<string>`, `formatDate(date: Date): string` (existing, `../db/database`); `computeStreak` (existing, `../utils/streak`); `webColors`, `webSpacing`, `webRadius`, `webFontSize` (existing, `../theme/webTheme`).
- Produces: `HabitDetailPanel({ item, onEdit }: { item: Item; onEdit: () => void })` — rendered by `HabitsScreen.web.tsx` inside the existing `DetailPanel` when `mode === 'detail'`.

- [ ] **Step 1: Create `src/webApp/HabitDetailPanel.web.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Flame, Pencil } from 'lucide-react-native';
import { getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence } from '../db/database';
import { computeStreak } from '../utils/streak';
import { buildHabitCalendarMonth, type HabitCalendarDay } from '../utils/habitCalendar';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface HabitDetailPanelProps {
  item: Item;
  onEdit: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitDetailPanel({ item, onEdit }: HabitDetailPanelProps) {
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  // Bumped on every toggle to force completedDates/calendar/streak to recompute —
  // there is no live subscription for a single item's log entries the way
  // useDbRefresh covers list queries.
  const [revision, setRevision] = useState(0);

  const today = formatDate(new Date());
  const completedDates = useMemo(() => getCompletedOccurrenceDates(item.id), [item.id, revision]);
  const streak = useMemo(() => computeStreak(item.rrule, completedDates, today), [item.rrule, completedDates, today]);
  const calendar = useMemo(
    () => buildHabitCalendarMonth(item.rrule, completedDates, monthAnchor, today),
    [item.rrule, completedDates, monthAnchor, today],
  );
  const sortedLog = useMemo(() => [...completedDates].sort((a, b) => b.localeCompare(a)), [completedDates]);

  const handleToggleDay = (day: HabitCalendarDay) => {
    if (!day.isScheduled || day.isFuture) return;
    toggleHabitOccurrence(item.id, day.date);
    setRevision((r) => r + 1);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View style={styles.streakRow}>
        <Flame size={20} color={streak > 0 ? webColors.destructive : webColors.mutedForeground} strokeWidth={2} />
        <Text style={[styles.streakText, streak > 0 && { color: webColors.destructive }]}>
          {streak} day{streak === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.monthHeader}>
        <Pressable onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month - 1, 1))}>
          <ChevronLeft size={16} color={webColors.foreground} strokeWidth={2} />
        </Pressable>
        <Text style={styles.monthLabel}>{calendar.label}</Text>
        <Pressable onPress={() => setMonthAnchor(new Date(calendar.year, calendar.month + 1, 1))}>
          <ChevronRight size={16} color={webColors.foreground} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {calendar.weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day) => {
            const disabled = !day.isScheduled || day.isFuture;
            return (
              <Pressable key={day.date} onPress={() => handleToggleDay(day)} disabled={disabled} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    day.isCompleted && { backgroundColor: webColors.destructive },
                    !day.isCompleted && day.isScheduled && !day.isFuture && styles.dayCircleOutline,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: day.isCompleted ? webColors.card : day.inCurrentMonth ? webColors.foreground : webColors.mutedForeground },
                    ]}
                  >
                    {day.dayOfMonth}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.logHeader}>History</Text>
      {sortedLog.length === 0 ? (
        <Text style={styles.logEmpty}>No check-ins yet.</Text>
      ) : (
        sortedLog.map((date) => (
          <View key={date} style={styles.logRow}>
            <Text style={styles.logDate}>
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginBottom: webSpacing[4],
  },
  streakText: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.mutedForeground,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[2],
  },
  monthLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: webSpacing[1],
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: webRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleOutline: {
    borderWidth: 1.5,
    borderColor: webColors.destructive,
  },
  dayText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
  },
  logHeader: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: webColors.mutedForeground,
    marginTop: webSpacing[5],
    marginBottom: webSpacing[2],
  },
  logEmpty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  logRow: {
    paddingVertical: webSpacing[2],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  logDate: {
    fontSize: webFontSize.sm,
    fontWeight: '500',
    color: webColors.foreground,
  },
});
```

- [ ] **Step 2: Wire mode toggle into `HabitsScreen.web.tsx`**

Add the import:

```typescript
import { HabitDetailPanel } from './HabitDetailPanel';
```

Add a `mode` state alongside `selectedId`:

```typescript
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
```

Update `setSelectedId` calls on row tap to also reset the mode, and update the `DetailPanel` body. Replace:

```tsx
          <Pressable style={styles.row} onPress={() => setSelectedId(row.item.id)}>
```

with:

```tsx
          <Pressable style={styles.row} onPress={() => { setSelectedId(row.item.id); setMode('detail'); }}>
```

Replace the `DetailPanel` block:

```tsx
      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Habit">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
```

with:

```tsx
      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={mode === 'edit' ? 'Edit Habit' : 'Habit'}>
        {selectedItem ? (
          mode === 'edit' ? (
            <ItemDetailForm
              item={selectedItem}
              onChanged={() => { refresh(); setMode('detail'); }}
              onDeleted={() => {
                setSelectedId(null);
                refresh();
              }}
            />
          ) : (
            <HabitDetailPanel item={selectedItem} onEdit={() => setMode('edit')} />
          )
        ) : null}
      </DetailPanel>
```

- [ ] **Step 3: Typecheck**

Run: `cd "apps/mobile" && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit > /tmp/tsc_habitweb.txt 2>&1; grep -v "TS2307" /tmp/tsc_habitweb.txt`

Expected: no output.

- [ ] **Step 4: Build and deploy**

```bash
cd "apps/mobile" && npm run web:build
firebase deploy --only hosting --project rka-os
```

- [ ] **Step 5: Verify in browser**

Load `https://rka-os.web.app`, go to Habits, tap a habit row:
- Detail panel shows streak, calendar, and history log instead of the generic form.
- Tapping a past scheduled day toggles it; streak and history update immediately.
- Pencil button swaps the panel to the edit form (title/repeat/delete); saving or navigating back returns to the detail view; deleting closes the panel.

- [ ] **Step 6: Commit and push**

```bash
git add apps/mobile/src/webApp/HabitDetailPanel.web.tsx apps/mobile/src/webApp/HabitsScreen.web.tsx
git commit -m "feat(mobile): add web Habit detail panel with calendar and history

Mirrors the new mobile HabitDetailScreen: streak, tappable month calendar,
and chronological log inside the existing DetailPanel, with a pencil button
swapping to the existing ItemDetailForm for title/repeat/delete."
git push origin main
```
