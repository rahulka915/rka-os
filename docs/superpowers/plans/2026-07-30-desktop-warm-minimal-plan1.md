# Desktop Warm Minimal Redesign — Plan 1: Shell, Inbox & Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new desktop app shell (sidebar, main content area, slide-over detail panel) in the warm-minimal visual language, with Inbox and Tasks as the first two screens — enough to see and use the whole new direction end to end.

**Architecture:** All new code lives under a new `apps/mobile/src/webApp/` directory, using the `.web.tsx` suffix convention already established for the data layer. A new `App.web.tsx` at the project root replaces `App.tsx` only for web builds (Metro resolves `./App` to it automatically, same mechanism as `database.web.ts`) — mobile's entry point and every mobile screen are completely untouched. The new screens call the exact same data hooks (`useInbox`, `useTasks`) and mutation functions (`updateItemStatus`, `processInboxItem`, etc.) already working on web from the Core GTD plans — this plan is presentation-only.

**Tech Stack:** `lucide-react-native` (already a dependency, newly used here), existing `firebase/auth` via `useBackup`, browser preview tools for verification (this work is inherently visual, so screenshots matter more than they did for the data-layer plans).

## Global Constraints

- Mobile is untouched. No file under `apps/mobile/src/screens/`, `apps/mobile/App.tsx`, or any other existing mobile component is modified by this plan.
- Colors, spacing, and type scale come from `docs/superpowers/specs/2026-07-30-desktop-warm-minimal-design.md`'s Visual Language section, copied verbatim into `theme/webTheme.ts` — no ad hoc hex values in components.
- Icons come from `lucide-react-native`, imported directly (not through `src/icons.tsx`, which is the existing Heroicons wrapper mobile uses) — `size` prop for dimensions, `strokeWidth={1.5}` or `{2}` for stroke, per the design spec.
- **Scope-narrowing decision, made at planning time**: the design spec describes the slide-over *interaction pattern* but not field-level parity with mobile's `ItemEditorSheet` (which has schedule pickers, checklists, tags, priority, project linking, deadlines — 700+ lines deeply tied to mobile's modal/sheet chrome). Reusing it as-is isn't a clean fit for a slide-over panel. This plan's detail panel covers **title, notes, complete/uncomplete, and delete** only. Full editor parity is out of scope here and not yet planned as a follow-up.
- No dark mode this pass — the spec defines one palette (warm minimal light); `webTheme.ts` is a flat object, not a light/dark pair like mobile's `getThemeColors`.
- No drag-to-reorder, no swipe gestures, no triage overlay, no project grouping — Inbox and Tasks are both simple flat lists this pass, matching "enough to validate the direction," not full parity with `InboxScreenV2`/`TasksScreen`.
- No automated UI tests, matching the rest of this codebase — verified via the fetch-and-eval-bundle technique plus `preview_screenshot`, since this pass is about how things *look*, which a DOM-text snapshot alone can't confirm.

---

## File Structure

**Create:**
- `apps/mobile/src/theme/webTheme.ts` — color/spacing/type tokens for the new visual language
- `apps/mobile/src/webApp/Sidebar.web.tsx` — persistent left nav
- `apps/mobile/src/webApp/DetailPanel.web.tsx` — generic slide-over container (chrome only)
- `apps/mobile/src/webApp/ItemDetailForm.web.tsx` — title/notes/complete/delete content, shared by Inbox and Tasks panels
- `apps/mobile/src/webApp/InboxScreen.web.tsx`
- `apps/mobile/src/webApp/TasksScreen.web.tsx`
- `apps/mobile/src/webApp/SignInScreen.web.tsx`
- `apps/mobile/src/webApp/AppShell.web.tsx` — sidebar + content area + view switching + panel host
- `apps/mobile/App.web.tsx` — new root component for web builds

**Modify:** none. This plan is additive only.

---

## Task 1: Web theme tokens

**Files:**
- Create: `apps/mobile/src/theme/webTheme.ts`

**Interfaces:**
- Produces: `webColors` (object with `background`, `foreground`, `primary`, `accent`, `card`, `muted`, `mutedForeground`, `border`, `destructive`), `webSpacing` (numeric scale), `webRadius` (`sm`, `md`, `lg`, `pill`), `webFontSize` (`xs` through `xl`). Consumed by every other task in this plan.

- [ ] **Step 1: Write the tokens**

```typescript
// apps/mobile/src/theme/webTheme.ts
// Warm-minimal palette for the desktop web app only — see
// docs/superpowers/specs/2026-07-30-desktop-warm-minimal-design.md.
// Mobile keeps its own theme (theme/colors.ts) untouched; nothing here is
// imported by any mobile screen.
export const webColors = {
  background: '#FFFBEB',
  foreground: '#0F172A',
  primary: '#78716C',
  accent: '#D97706',
  card: '#FFFFFF',
  muted: '#F6F6F6',
  mutedForeground: '#64748B',
  border: '#EEEDED',
  destructive: '#DC2626',
} as const;

export const webSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const webRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const webFontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/theme/webTheme.ts
git commit -m "feat(mobile): add web theme tokens for the desktop redesign"
```

---

## Task 2: Sidebar

**Files:**
- Create: `apps/mobile/src/webApp/Sidebar.web.tsx`

**Interfaces:**
- Consumes: `webColors`, `webSpacing`, `webRadius`, `webFontSize` from `../theme/webTheme`; `Inbox`, `ListTodo`, `CalendarDays`, `Folder` from `lucide-react-native`.
- Produces: `SidebarView` type (`'inbox' | 'tasks'`), `SidebarProps { activeView: SidebarView; onSelectView: (view: SidebarView) => void; inboxCount: number }`, `Sidebar` component. Consumed by Task 5 (`AppShell.web.tsx`).

- [ ] **Step 1: Write the component**

Calendar and Areas/Projects are shown as disabled placeholders — visually present (per the design spec's stated shell structure) but not yet wired to a screen, so clicking them does nothing this pass rather than silently pretending to navigate somewhere real.

```typescript
// apps/mobile/src/webApp/Sidebar.web.tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Inbox, ListTodo, CalendarDays, Folder } from 'lucide-react-native';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export type SidebarView = 'inbox' | 'tasks';

export interface SidebarProps {
  activeView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  inboxCount: number;
}

const NAV_ITEMS: Array<{ view: SidebarView; label: string; Icon: typeof Inbox }> = [
  { view: 'inbox', label: 'Inbox', Icon: Inbox },
  { view: 'tasks', label: 'Tasks', Icon: ListTodo },
];

export function Sidebar({ activeView, onSelectView, inboxCount }: SidebarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.workspaceLabel}>RKA OS</Text>

      <View style={styles.navSection}>
        {NAV_ITEMS.map(({ view, label, Icon }) => {
          const active = view === activeView;
          return (
            <Pressable
              key={view}
              onPress={() => onSelectView(view)}
              style={[styles.navRow, active && styles.navRowActive]}
            >
              <Icon size={18} color={active ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
              {view === 'inbox' && inboxCount > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{inboxCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <CalendarDays size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Calendar</Text>
          <Text style={styles.comingSoon}>Soon</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Areas & Projects</Text>
      <ScrollView style={styles.treeSection}>
        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <Folder size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Coming soon</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: '100%',
    backgroundColor: webColors.card,
    borderRightWidth: 1,
    borderRightColor: webColors.border,
    paddingVertical: webSpacing[5],
    paddingHorizontal: webSpacing[3],
  },
  workspaceLabel: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[5],
  },
  navSection: {
    gap: webSpacing[1],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
  },
  navRowActive: {
    backgroundColor: `${webColors.accent}1A`,
  },
  navRowDisabled: {
    opacity: 0.5,
  },
  navLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
  },
  navLabelActive: {
    color: webColors.foreground,
    fontWeight: '600',
  },
  navLabelDisabled: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: webSpacing[1],
  },
  countBadgeText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.card,
  },
  comingSoon: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  divider: {
    height: 1,
    backgroundColor: webColors.border,
    marginVertical: webSpacing[4],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  treeSection: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/Sidebar.web.tsx
git commit -m "feat(mobile): add desktop sidebar component"
```

---

## Task 3: Detail panel

**Files:**
- Create: `apps/mobile/src/webApp/DetailPanel.web.tsx`

**Interfaces:**
- Consumes: `webColors`, `webSpacing`, `webRadius` from `../theme/webTheme`; `X` from `lucide-react-native`.
- Produces: `DetailPanelProps { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }`, `DetailPanel` component. Consumed by Task 6 and 7 (Inbox/Tasks screens), wrapping Task 4's `ItemDetailForm`.

- [ ] **Step 1: Write the component**

Chrome only — no knowledge of items or the data layer, so it's reusable for anything that needs a slide-over later (not just tasks).

```typescript
// apps/mobile/src/webApp/DetailPanel.web.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface DetailPanelProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function DetailPanel({ visible, onClose, title, children }: DetailPanelProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title ?? ''}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },
  panel: {
    width: '38%',
    minWidth: 380,
    height: '100%',
    backgroundColor: webColors.card,
    borderLeftWidth: 1,
    borderLeftColor: webColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[5],
    paddingVertical: webSpacing[4],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: webSpacing[5],
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/DetailPanel.web.tsx
git commit -m "feat(mobile): add slide-over detail panel shell"
```

---

## Task 4: Item detail form

**Files:**
- Create: `apps/mobile/src/webApp/ItemDetailForm.web.tsx`

**Interfaces:**
- Consumes: `updateItemTitle`, `updateItem`, `updateItemStatus`, `deleteItem` from `../db/database` (Metro resolves to `database.web.ts`); `webColors`, `webSpacing`, `webRadius`, `webFontSize` from `../theme/webTheme`; `Check`, `Trash2` from `lucide-react-native`; `Item` from `../db/types`.
- Produces: `ItemDetailFormProps { item: Item; onChanged: () => void; onDeleted: () => void }`, `ItemDetailForm` component. Consumed by Task 6 and 7.

- [ ] **Step 1: Write the component**

Title and notes save on blur (not on every keystroke, to avoid a Firestore write per character) via local state seeded from the item and reset whenever a different item is opened.

```typescript
// apps/mobile/src/webApp/ItemDetailForm.web.tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { updateItemTitle, updateItem, updateItemStatus, deleteItem } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface ItemDetailFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

export function ItemDetailForm({ item, onChanged, onDeleted }: ItemDetailFormProps) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
  }, [item.id, item.title, item.notes]);

  const completed = item.status === 'completed';

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      updateItemTitle(item.id, trimmed);
      onChanged();
    }
  };

  const saveNotes = () => {
    if (notes !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notes || null });
      onChanged();
    }
  };

  const toggleComplete = () => {
    updateItemStatus(item.id, completed ? 'active' : 'completed');
    onChanged();
  };

  const handleDelete = () => {
    deleteItem(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        style={styles.titleInput}
        placeholder="Untitled"
        placeholderTextColor={webColors.mutedForeground}
      />

      <Pressable onPress={toggleComplete} style={styles.completeRow}>
        <View style={[styles.checkbox, completed && styles.checkboxDone]}>
          {completed ? <Check size={14} color={webColors.card} strokeWidth={2.5} /> : null}
        </View>
        <Text style={styles.completeLabel}>{completed ? 'Completed' : 'Mark as complete'}</Text>
      </Pressable>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onBlur={saveNotes}
        style={styles.notesInput}
        placeholder="Add notes…"
        placeholderTextColor={webColors.mutedForeground}
        multiline
      />

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  titleInput: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
    padding: 0,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  checkbox: {
    width: 20,
    height: 20,
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
  completeLabel: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    fontWeight: '500',
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[4],
    paddingTop: webSpacing[4],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  deleteLabel: {
    fontSize: webFontSize.sm,
    color: webColors.destructive,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ItemDetailForm.web.tsx
git commit -m "feat(mobile): add shared item detail form for the slide-over panel"
```

---

## Task 5: Inbox screen

**Files:**
- Create: `apps/mobile/src/webApp/InboxScreen.web.tsx`

**Interfaces:**
- Consumes: `useInbox` from `../hooks/useDb`; `processInboxItem` from `../db/database`; `DetailPanel` (Task 3); `ItemDetailForm` (Task 4); `webColors`/`webSpacing`/`webRadius`/`webFontSize` from `../theme/webTheme`; `Item` from `../db/types`.
- Produces: `InboxScreen` component (no props — reads via `useInbox` directly). Consumed by Task 8 (`AppShell.web.tsx`).

- [ ] **Step 1: Write the component**

Row actions are deliberately minimal — "Today" and "Someday" cover the two most common triage destinations without needing the full GTD-destination picker mobile's triage overlay has; the detail panel's own actions (complete/delete) still apply once opened.

```typescript
// apps/mobile/src/webApp/InboxScreen.web.tsx
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInbox } from '../hooks/useDb';
import { processInboxItem } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export function InboxScreen() {
  const { items, refresh } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const moveToday = (item: Item) => {
    processInboxItem(item.id, 'today');
    refresh();
  };
  const moveSomeday = (item: Item) => {
    processInboxItem(item.id, 'someday');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.count}>{items.length} unprocessed</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>Inbox zero. Nice work.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.rowActions}>
              <Pressable onPress={() => moveToday(item)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>Today</Text>
              </Pressable>
              <Pressable onPress={() => moveSomeday(item)} style={styles.actionChip}>
                <Text style={styles.actionChipText}>Someday</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Inbox item">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[6],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  rowActions: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  actionChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  actionChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/InboxScreen.web.tsx
git commit -m "feat(mobile): add desktop Inbox screen"
```

---

## Task 6: Tasks screen

**Files:**
- Create: `apps/mobile/src/webApp/TasksScreen.web.tsx`

**Interfaces:**
- Consumes: `useTasks` from `../hooks/useDb`; `updateItemStatus` from `../db/database`; `DetailPanel` (Task 3); `ItemDetailForm` (Task 4); `webColors`/`webSpacing`/`webRadius`/`webFontSize` from `../theme/webTheme`; `Check` from `lucide-react-native`; `Item` from `../db/types`.
- Produces: `TasksScreen` component (no props). Consumed by Task 8.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/webApp/TasksScreen.web.tsx
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTasks } from '../hooks/useDb';
import { updateItemStatus } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = tasks.find((i) => i.id === selectedId) ?? null;

  const toggleComplete = (item: Item) => {
    updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.count}>{tasks.length}</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet.</Text>}
        renderItem={({ item }) => {
          const completed = item.status === 'completed';
          return (
            <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
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
        }}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Task">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[6],
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
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/TasksScreen.web.tsx
git commit -m "feat(mobile): add desktop Tasks screen"
```

---

## Task 7: Sign-in screen

**Files:**
- Create: `apps/mobile/src/webApp/SignInScreen.web.tsx`

**Interfaces:**
- Consumes: `useBackup` from `../hooks/useBackup`; `webColors`/`webSpacing`/`webRadius`/`webFontSize` from `../theme/webTheme`.
- Produces: `SignInScreen` component (no props). Consumed by Task 8 (`App.web.tsx`).

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/webApp/SignInScreen.web.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useBackup } from '../hooks/useBackup';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export function SignInScreen() {
  // useBackup's own `error` state only covers backUpNow's failures, not
  // signIn/signUp — those reject without touching it — so a failed sign-in
  // needs its own local error state rather than reading the shared one.
  const { signIn, signUp, busy } = useBackup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authError, setAuthError] = useState<string | null>(null);

  const submit = () => {
    if (!email.trim() || !password) return;
    setAuthError(null);
    const action = mode === 'signIn' ? signIn : signUp;
    action(email.trim(), password).catch((err: unknown) => {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>RKA OS</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={webColors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={webColors.mutedForeground}
          secureTextEntry
          style={styles.input}
        />

        {authError ? <Text style={styles.error}>{authError}</Text> : null}

        <Pressable onPress={submit} disabled={busy} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>
            {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchModeText}>
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 360,
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[6],
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  subtitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[2],
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  error: {
    fontSize: webFontSize.xs,
    color: webColors.destructive,
  },
  submitButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    marginTop: webSpacing[2],
  },
  submitButtonText: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.card,
  },
  switchModeText: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    textAlign: 'center',
    marginTop: webSpacing[2],
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/SignInScreen.web.tsx
git commit -m "feat(mobile): add desktop sign-in screen"
```

---

## Task 8: App shell and new root entry

**Files:**
- Create: `apps/mobile/src/webApp/AppShell.web.tsx`
- Create: `apps/mobile/App.web.tsx`

**Interfaces:**
- Consumes: `Sidebar`/`SidebarView` (Task 2); `InboxScreen` (Task 5); `TasksScreen` (Task 6); `SignInScreen` (Task 7); `useInbox` from `../hooks/useDb`; `useBackup`, `BackupProvider` from `./hooks/useBackup`; `webColors` from `./theme/webTheme`.
- Produces: `AppShell` component; `App` (default export of `App.web.tsx`), which Metro resolves in place of `App.tsx` for web builds since `index.ts` imports `./App` by its extensionless path.

- [ ] **Step 1: Write the app shell**

```typescript
// apps/mobile/src/webApp/AppShell.web.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { useInbox } from '../hooks/useDb';
import { webColors } from '../theme/webTheme';

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('inbox');
  const { count: inboxCount } = useInbox();

  return (
    <View style={styles.container}>
      <Sidebar activeView={activeView} onSelectView={setActiveView} inboxCount={inboxCount} />
      <View style={styles.content}>
        {activeView === 'inbox' ? <InboxScreen /> : <TasksScreen />}
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

- [ ] **Step 2: Write the new root entry**

`BackupProvider` is the same one mobile uses (`src/hooks/useBackup.ts`) — it already starts the web Firestore store on sign-in via the `Platform.OS === 'web'` branch added in the Core GTD plans, so no new sync wiring is needed here.

```typescript
// apps/mobile/App.web.tsx
import { BackupProvider, useBackup } from './src/hooks/useBackup';
import { AppShell } from './src/webApp/AppShell';
import { SignInScreen } from './src/webApp/SignInScreen';

function AppContent() {
  const { isSignedIn } = useBackup();
  return isSignedIn ? <AppShell /> : <SignInScreen />;
}

export default function App() {
  return (
    <BackupProvider>
      <AppContent />
    </BackupProvider>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Run the existing test suite to confirm mobile is unaffected**

Run: `cd apps/mobile && npm test`
Expected: all 91 tests pass (this plan added no new pure-logic functions, so the count doesn't change).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/webApp/AppShell.web.tsx apps/mobile/App.web.tsx
git commit -m "feat(mobile): add desktop app shell and new web root entry"
```

---

## Task 9: Verify in the browser

**Files:** none (verification only)

Same technique established in the Core GTD plans: the preview browser doesn't execute the page's own `<script defer>` tag reliably, so fetch-and-eval the bundle and read results through an external probe rather than relying on `console` capture (React's `%s`-formatted messages don't come through `preview_console_logs`).

- [ ] **Step 1: Start the probe server**

```bash
cat > /tmp/probe_server.py <<'EOF'
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        with open('/tmp/probe.log', 'a') as f:
            f.write(q.get('m', [''])[0] + '\n---\n')
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 8123), H).serve_forever()
EOF
rm -f /tmp/probe.log
nohup python3 /tmp/probe_server.py > /dev/null 2>&1 &
sleep 2
curl -s "http://localhost:8123/?m=ready" -o /dev/null -w "probe %{http_code}\n"
```

Expected: `probe 204`.

- [ ] **Step 2: Start the web dev server and load the app**

Use `preview_start` with the `mobile-web` launch config, wait ~20 seconds, then run via `preview_eval` (substitute the actual port Metro reports):

```javascript
(async () => {
  window.__beacon = (msg) => {
    try { fetch('http://localhost:8123/?m=' + encodeURIComponent(String(msg).slice(0, 900)), { mode: 'no-cors' }); } catch(e) {}
  };
  const orig = console.error;
  console.error = function(...args) {
    window.__beacon('ERR: ' + args.map(a => (a && a.stack) ? a.stack : String(a)).join(' :: '));
    orig.apply(console, args);
  };
  window.addEventListener('error', (e) => window.__beacon('WINDOW: ' + (e.error && e.error.stack ? e.error.stack : e.message)));

  const snap = (tag) => {
    const root = document.getElementById('root');
    window.__beacon(tag + ' children=' + (root ? root.children.length : -1) + ' TEXT=' + (root ? root.innerText.slice(0,250).replace(/\n/g,' | ') : 'none'));
  };

  const res = await fetch('http://localhost:8098/index.ts.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable');
  const text = await res.text();
  try { (0, eval)(text); window.__beacon('EVAL_OK'); } catch (e) { window.__beacon('THREW: ' + (e && e.stack ? e.stack : String(e))); }
  snap('T0');
  setTimeout(() => snap('T150'), 150);
  return 'started';
})()
```

Then: `sleep 8 && cat /tmp/probe.log`

Expected: `EVAL_OK`, then a `T0` line showing "Sign in" (the new sign-in screen renders, since no session is active in this fresh eval context) and no `ERR:`/`WINDOW:` lines.

- [ ] **Step 3: Screenshot the sign-in screen**

Run `preview_screenshot` against the same server. Since the eval-injection approach only lasts a few seconds before the tab typically dies (a known limitation from the Core GTD plans, not specific to this one), take the screenshot immediately after Step 2's `EVAL_OK`, before running anything else.

Expected: a visible card with "RKA OS" / "Sign in to continue", email/password fields, and an amber "Sign in" button — confirming the warm-minimal palette actually renders (background cream, accent amber), not just that the DOM text is present.

- [ ] **Step 4: Manual sign-in check**

The eval-injection tab is too short-lived to drive a real sign-in flow. Start the dev server normally (`npm run web` in a terminal) and open the printed URL in an actual browser tab, sign in with the account used throughout the Core GTD plans, and confirm:
- The sidebar renders with Inbox/Tasks/Calendar (disabled)/Areas & Projects (disabled placeholder).
- Inbox shows the real inbox items ("duck", "hue hue" per earlier session data, or whatever's current).
- Clicking a row opens the slide-over panel from the right with title/notes/complete/delete.
- Switching to Tasks in the sidebar shows the tasks list.

- [ ] **Step 5: Clean up**

```bash
pkill -f probe_server.py
rm -f /tmp/probe.log /tmp/probe_server.py
```

---

## What this plan does not do (by design)

- Calendar and Areas/Projects screens — sidebar entries exist but are disabled; no follow-up plan written yet.
- Full item-editor parity (schedule, checklist, tags, priority, project linking, deadlines) — the slide-over panel only covers title/notes/complete/delete this pass.
- Dark mode — one fixed palette.
- Drag-to-reorder, swipe gestures, triage overlay, project grouping in Tasks.
- Mac/Tauri wrapper.
