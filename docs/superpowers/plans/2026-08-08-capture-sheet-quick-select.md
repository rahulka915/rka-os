# Capture Sheet Quick-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Today" toggle chip and a Mission/destination picker to the FAB quick-capture sheet (`CaptureSheet.tsx`), reachable inline without opening full item Details.

**Architecture:** A new `MissionPickerSheet.tsx` (a second, stacked `BottomSheet`) is opened from `CaptureSheet.tsx` via a new `missionPickerVisible` local state. `CaptureSheet` gains a chip row (`Today` + `Mission`) below the note input. Both interactions write directly to the existing `ItemDraft` via the already-passed `onChange` prop — no new persistence code, no schema change.

**Tech Stack:** React Native + TypeScript, existing `BottomSheet` overlay host, existing `itemComposerMaterial` theme tokens, `src/db/database.ts`'s `getItemsByType`/`getRelation`.

## Global Constraints

- No new DB columns/tables — Today uses `draft.metadata.plannedDate` (today's `YYYY-MM-DD`), Mission uses existing `draft.projectId`/`draft.projectTitle` (spec, "Data flow / persistence").
- User-facing copy says "Mission"/"Domain", never "project"/"area" (per `AGENTS.md`/`CLAUDE.md` terminology rule).
- Reuse existing `material.accent`/`material.accentSoft`/`material.fill`/`material.rimStrong` selected/unselected chip styling (spec, matches `ItemEditorSheet.tsx` `bucketChip`/`choiceChip` pattern) — no new color tokens.
- `CaptureSheet.tsx`'s "Inbox" pill (`styles.contextChip`, currently a bare `Text`/`View`) becomes tappable and opens the same picker as the Mission chip (spec: "Same control").

---

### Task 1: Mission picker sheet component

**Files:**
- Create: `apps/mobile/src/components/item-composer/MissionPickerSheet.tsx`

**Interfaces:**
- Consumes: `getItemsByType('project')` and `getItemsByType('area')` (`src/db/database.ts`), `getRelation(id, 'area')` (`src/db/database.ts`), `BottomSheet` props (`src/components/ui/BottomSheet.tsx`), `getItemComposerMaterial`/`getThemeColors` (`src/theme`).
- Produces: `MissionPickerSheet` component with props:
  ```ts
  type MissionPickerSheetProps = {
    visible: boolean;
    onClose: () => void;
    onSelect: (mission: { id: string; title: string } | null) => void; // null = Inbox
  };
  ```
  Later tasks (Task 2) render `<MissionPickerSheet visible={...} onClose={...} onSelect={...} />` and pass a handler that writes `projectId`/`projectTitle` onto the draft.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../../theme';
import { getItemsByType, getRelation } from '../../db/database';

type MissionPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (mission: { id: string; title: string } | null) => void;
};

type MissionRow = { id: string; title: string; domainTitle?: string };

export function MissionPickerSheet({ visible, onClose, onSelect }: MissionPickerSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [query, setQuery] = useState('');

  const missions = useMemo<MissionRow[]>(() => {
    if (!visible) return [];
    const domains = getItemsByType('area');
    const domainTitleById = new Map(domains.map((d) => [d.id, d.title]));
    return getItemsByType('project').map((project) => {
      const domainId = getRelation(project.id, 'area');
      return {
        id: project.id,
        title: project.title,
        domainTitle: domainId ? domainTitleById.get(domainId) : undefined,
      };
    });
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter((m) => m.title.toLowerCase().includes(q));
  }, [missions, query]);

  const grouped = useMemo(() => {
    const byDomain = new Map<string, MissionRow[]>();
    filtered.forEach((m) => {
      const key = m.domainTitle ?? 'No Domain';
      const list = byDomain.get(key) ?? [];
      list.push(m);
      byDomain.set(key, list);
    });
    return Array.from(byDomain.entries()).map(([domainTitle, rows]) => ({ domainTitle, rows }));
  }, [filtered]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title="Move to"
      topAnchored
      scrollable={false}
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
    >
      <TextInput
        style={[styles.search, { color: palette.text, borderColor: material.rim }]}
        placeholder="Search missions"
        placeholderTextColor={palette.textTertiary}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
      <FlatList
        data={[{ domainTitle: null, rows: [] as MissionRow[] }, ...grouped]}
        keyExtractor={(section, index) => section.domainTitle ?? `inbox-${index}`}
        renderItem={({ item: section }) => {
          if (section.domainTitle === null) {
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: material.rim }]}
                onPress={() => onSelect(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowText, { color: palette.text }]}>Inbox</Text>
              </TouchableOpacity>
            );
          }
          return (
            <View>
              <Text style={[styles.sectionHeader, { color: palette.textMuted }]}>
                {section.domainTitle.toUpperCase()}
              </Text>
              {section.rows.map((mission) => (
                <TouchableOpacity
                  key={mission.id}
                  style={[styles.row, { borderBottomColor: material.rim }]}
                  onPress={() => onSelect({ id: mission.id, title: mission.title })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowText, { color: palette.text }]}>{mission.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
        ListEmptyComponent={
          query.trim() ? (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>No missions found</Text>
          ) : null
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16, maxHeight: '70%' },
  content: { paddingBottom: spacing[3], flex: 1 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  search: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 15 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors referencing `MissionPickerSheet.tsx`. (Pre-existing `.web.tsx` module-resolution false alarms elsewhere are unrelated — see `apps/mobile/CLAUDE.md`.)

- [ ] **Step 3: Commit**

```bash
cd apps/mobile && git add src/components/item-composer/MissionPickerSheet.tsx
git commit -m "feat: add mission picker sheet for quick capture

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire Today chip, Mission chip, and tappable context pill into CaptureSheet

**Files:**
- Modify: `apps/mobile/src/components/item-composer/CaptureSheet.tsx`

**Interfaces:**
- Consumes: `MissionPickerSheet` from Task 1 (`{ visible, onClose, onSelect }`), existing `ItemDraft` type (`title`, `notes`, `status`, `metadata: Record<string, unknown>`, `projectId?`, `projectTitle?`), existing `onChange: (updates: Partial<ItemDraft>) => void` prop.
- Produces: no new exports; internal `missionPickerVisible` state and two handlers (`toggleToday`, `selectMission`) local to `CaptureSheet`.

- [ ] **Step 1: Add local state and helpers**

In `apps/mobile/src/components/item-composer/CaptureSheet.tsx`, add imports and helpers near the top:

```tsx
import { useEffect, useRef, useState } from 'react';
// ...existing imports...
import { MissionPickerSheet } from './MissionPickerSheet';

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function isPlannedToday(draft: ItemDraft): boolean {
  return draft.metadata.plannedDate === todayDateString();
}
```

Inside the `CaptureSheet` component body, add:

```tsx
const [missionPickerVisible, setMissionPickerVisible] = useState(false);

const toggleToday = () => {
  const metadata = { ...draft.metadata };
  if (isPlannedToday(draft)) {
    delete metadata.plannedDate;
  } else {
    metadata.plannedDate = todayDateString();
  }
  onChange({ metadata });
};

const selectMission = (mission: { id: string; title: string } | null) => {
  onChange({
    projectId: mission?.id,
    projectTitle: mission?.title,
  });
  setMissionPickerVisible(false);
};
```

- [ ] **Step 2: Make the context pill tappable**

Replace the existing context pill block:

```tsx
{context ? (
  <View style={[styles.contextChip, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}>
    <Text style={[styles.contextText, { color: material.accent }]} numberOfLines={1}>{context}</Text>
  </View>
) : null}
```

with:

```tsx
{context ? (
  <TouchableOpacity
    style={[styles.contextChip, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}
    onPress={() => setMissionPickerVisible(true)}
    disabled={busy}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel="Change destination"
  >
    <Text style={[styles.contextText, { color: material.accent }]} numberOfLines={1}>{context}</Text>
  </TouchableOpacity>
) : null}
```

- [ ] **Step 3: Add the quick-select chip row**

Insert between the note `TextInput` block and the `{error ? ... : null}` line:

```tsx
<View style={styles.quickRow}>
  <TouchableOpacity
    style={[
      styles.quickChip,
      { backgroundColor: isPlannedToday(draft) ? material.accentSoft : material.fill, borderColor: isPlannedToday(draft) ? material.rimStrong : 'transparent' },
    ]}
    onPress={toggleToday}
    disabled={busy}
    activeOpacity={0.7}
  >
    <Text style={[styles.quickChipText, { color: isPlannedToday(draft) ? material.accent : palette.textSecondary }]}>
      Today
    </Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[
      styles.quickChip,
      { backgroundColor: draft.projectTitle ? material.accentSoft : material.fill, borderColor: draft.projectTitle ? material.rimStrong : 'transparent' },
    ]}
    onPress={() => setMissionPickerVisible(true)}
    disabled={busy}
    activeOpacity={0.7}
  >
    <Text
      style={[styles.quickChipText, { color: draft.projectTitle ? material.accent : palette.textSecondary }]}
      numberOfLines={1}
    >
      {draft.projectTitle ?? 'Mission'}
    </Text>
  </TouchableOpacity>
</View>
```

- [ ] **Step 4: Mount the picker sheet**

Just before the closing `</BottomSheet>` tag, add (as a sibling, since it's a second stacked sheet, it can also be rendered as a sibling of `<BottomSheet>` — place it right after the outer `<BottomSheet>...</BottomSheet>` closes, inside the same `return (...)` fragment):

```tsx
return (
  <>
    <BottomSheet /* ...existing props... */>
      {/* ...existing children unchanged... */}
    </BottomSheet>
    <MissionPickerSheet
      visible={missionPickerVisible}
      onClose={() => setMissionPickerVisible(false)}
      onSelect={selectMission}
    />
  </>
);
```

(This requires wrapping the existing single-`BottomSheet` return in a fragment `<>...</>` — the rest of the JSX inside `<BottomSheet>` stays exactly as-is.)

- [ ] **Step 5: Add styles**

In the `StyleSheet.create({...})` block, add:

```ts
quickRow: {
  flexDirection: 'row',
  gap: 8,
  paddingTop: 8,
},
quickChip: {
  minHeight: 32,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
},
quickChipText: {
  fontSize: 13,
  fontWeight: '600',
  fontFamily: 'Inter_600SemiBold',
},
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors in `CaptureSheet.tsx` or `MissionPickerSheet.tsx`.

- [ ] **Step 7: Manual verification**

Run: `cd apps/mobile && npm start -- --clear` (or use the RKA Launcher per project convention), open the dev client, tap the Home FAB.
Expected:
- "New item" sheet shows a `Today` chip and a `Mission` chip below the note field.
- Tapping `Today` highlights it (accent color); tapping again un-highlights it.
- Tapping `Mission` (or the top pill, once a title-derived context is shown) opens "Move to" sheet with search + Domain-grouped Missions + pinned Inbox row.
- Selecting a Mission closes the picker, updates the `Mission` chip label to the Mission title, and updates the top context pill.
- Selecting "Inbox" clears the Mission chip back to "Mission" label.
- Saving the item and reopening it via Details/`ItemEditorSheet` shows the correct Mission assignment persisted, and the item appears in Home's Today bucket if `Today` was toggled on.

- [ ] **Step 8: Commit**

```bash
cd apps/mobile && git add src/components/item-composer/CaptureSheet.tsx
git commit -m "feat: add Today toggle and Mission picker to quick capture sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Today chip (Task 2 Step 3) ✓, Mission chip (Task 2 Step 3) ✓, tappable Inbox pill opening same picker (Task 2 Step 2) ✓, searchable Domain-grouped picker with pinned Inbox row (Task 1) ✓, no schema changes — uses existing `metadata.plannedDate`/`projectId`/`projectTitle` (Task 1 & 2 throughout) ✓.
- **Placeholder scan:** none found — all steps contain complete code.
- **Type consistency:** `MissionPickerSheetProps.onSelect` signature (`{ id: string; title: string } | null`) matches the `selectMission` handler in Task 2 exactly. `ItemDraft.metadata` is `Record<string, unknown>` (per `types.ts`) — `metadata.plannedDate` read/write matches existing usage in `itemComposerPersistence.ts:126`.
