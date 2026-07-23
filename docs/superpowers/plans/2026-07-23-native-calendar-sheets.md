# Native iOS Chrome for Calendar Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Outcome (2026-07-23):** All 5 tasks executed and shipped. Tasks 1–2 (NativeBottomSheet,
> TimelinePreviewSheet chrome + Menu) are live and working. Task 4 (native `TextField`)
> was reverted; Task 3 (native shell) was tried, tested, and *also* reverted, but for a
> different reason — see below.
>
> Tasks 3–4 together caused the native sheet to expand to full screen the instant the
> autofocused title field's keyboard appeared, and stay that way. Three targeted fixes
> were tried (fixed `presentationDetents` instead of `fitToContents`, `ignoresSafeArea
> (.keyboard)` on the sheet's content `Group`, then on the TextField's own nested `Host`)
> — none resolved it. **Isolation test:** reverted just the `TextField` (back to plain
> `TextInput`) while *keeping* the native `BottomSheet` shell — this fixed it. Confirms
> the bug is specifically `@expo/ui`'s `TextField` (its own nested `Host`/
> `UIHostingController` becoming first responder), not the `BottomSheet` shell itself.
>
> Native shell + plain `TextInput` works, but `BottomSheet` has no `fitToContents`-safe
> way to size to actual content (that prop's own two-pass measure-then-resize was the
> very first bug fixed in this effort) — so it needs a hand-tuned fixed `heightFraction`
> instead of auto-sizing, and left visible empty space below the content until tuned.
> Rather than keep tuning that for a marginal chrome upgrade, CaptureSheet went back to
> the original custom Reanimated `BottomSheet` + plain `TextInput` entirely — a pragmatic
> call, not a dead end. If revisiting: native shell + plain `TextInput` is a known-working
> combination, just needs either a `heightFraction` tuned to content or a smarter sizing
> approach; avoid `@expo/ui`'s `TextField` inside `BottomSheet` until upstream fixes the
> keyboard-expand bug (check `@expo/ui`'s GitHub issues first).

**Goal:** Replace the custom Reanimated `BottomSheet` chrome and plain `TextInput` fields
in Calendar's Capture and Preview sheets with `@expo/ui`'s native SwiftUI equivalents, and
give the Preview sheet native Complete/Delete quick actions.

**Architecture:** A new `NativeBottomSheet` component (`Host` → `@expo/ui`'s `BottomSheet`
→ `Group` → `RNHostView`) replaces `BottomSheet` as the outer shell for
`TimelinePreviewSheet` and `CaptureSheet` only. Everything inside the shell stays regular
RN/Tamagui, except `CaptureSheet`'s title/notes fields, which become native `TextField`s
wired via `useNativeState`, isolated in a small subcomponent so they remount fresh on every
sheet open (mirroring the isolation the old `BottomSheet` got via its `openId` key).
`TimelinePreviewSheet`'s existing Edit button becomes a native `Menu` using the
primary-action pattern (tap = Edit, unchanged; long-press = Complete/Delete).

**Tech Stack:** React Native + Expo SDK 54, `@expo/ui` `~57.0.4` (already installed,
already used by `SchedulePickers.tsx`), TypeScript.

## Global Constraints

- `@expo/ui/swift-ui` is iOS-only — no Android branch is written (matches
  `SchedulePickers.tsx` precedent). Not guarded with `Platform.OS` checks in this plan
  because none of the touched files are reachable on Android today (Calendar screen has no
  Android testing in this project's current state) — if that changes later, guard then.
- `BottomSheet.tsx` (`apps/mobile/src/components/ui/BottomSheet.tsx`) is **not** deleted or
  modified. `QuickCreateSheet.tsx`, `LogDoseSheet.tsx`, and `MedicationTimerSheet.tsx` keep
  using it unchanged.
- `ItemEditorSheet.tsx` is untouched — out of scope (see spec).
- `npx tsc --noEmit` (run from `apps/mobile/`) must be clean after every task.
- No automated UI test coverage exists for React Native components in this project (only
  plain-Node tests for pure logic, via `npm test` → `node --test src/**/*.test.ts`) and
  native SwiftUI rendering cannot be exercised through the web Browser preview tools at
  all. Every task's verification is `tsc` (automated) plus a manual on-device checklist
  step — the plan executor should run `tsc`, then report the manual steps to the user
  rather than claiming them done.

---

### Task 1: `NativeBottomSheet` component

**Files:**
- Create: `apps/mobile/src/components/ui/NativeBottomSheet.tsx`

**Interfaces:**
- Produces: `NativeBottomSheet` component with props `{ visible: boolean; onClose: () =>
  void; isDark: boolean; children: React.ReactNode; title?: string; headerLeft?:
  React.ReactNode; headerRight?: React.ReactNode; scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>; sheetStyle?: StyleProp<ViewStyle>; }`.
  Later tasks import it as `import { NativeBottomSheet } from '../ui/NativeBottomSheet';`
  (from `item-composer/`) or `'../ui/NativeBottomSheet'` (from `calendar/`).

- [ ] **Step 1: Write the component**

```tsx
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Host, BottomSheet as SwiftUIBottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import { presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, fontSize, spacing } from '../../theme';

export type NativeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
};

// SwiftUI's own `.sheet()` presentation supplies the drag indicator, dismiss gesture,
// backdrop, and content-height detent — none of that is hand-rolled here, unlike the
// Reanimated `BottomSheet` this replaces for Capture/Preview.
export function NativeBottomSheet({
  visible,
  onClose,
  isDark,
  children,
  title,
  headerLeft,
  headerRight,
  scrollable = false,
  contentContainerStyle,
  sheetStyle,
}: NativeBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);

  const headerRegion = title || headerLeft || headerRight ? (
    <View style={styles.header}>
      <View style={styles.headerSide}>{headerLeft}</View>
      <View style={styles.headerCenter}>
        {title ? (
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]}>{headerRight}</View>
    </View>
  ) : null;

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="none">
      <SwiftUIBottomSheet
        isPresented={visible}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) onClose();
        }}
        fitToContents
      >
        <Group modifiers={[presentationDragIndicator('visible')]}>
          <RNHostView>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: palette.surface,
                  paddingBottom: Math.max(insets.bottom, spacing[4]),
                },
                sheetStyle,
              ]}
            >
              {headerRegion}
              {body}
            </View>
          </RNHostView>
        </Group>
      </SwiftUIBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing.sheetHeaderBottom,
  },
  headerSide: {
    width: 72,
    minHeight: 32,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  body: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    flexGrow: 1,
    paddingBottom: spacing[3],
  },
});
```

Note: the old `BottomSheet.tsx` drew its own hairline `borderWidth`/`borderColor` around
the sheet card (needed because it hand-rendered the entire card shape). The native
`.sheet()` presentation already renders its own edge/shadow at the OS level, so that
border is intentionally dropped here rather than carried over — confirm in Task 2/3's
manual verification that the sheet still reads as a distinct surface without it; add
`borderTopLeftRadius`/`borderTopRightRadius` back to `styles.sheet` in a follow-up if the
native sheet doesn't already clip RN content to its own rounded corners.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (this file has no consumers yet, so this only checks the file itself
is well-typed).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/NativeBottomSheet.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add NativeBottomSheet using @expo/ui's SwiftUI BottomSheet

Foundational component for the native-chrome push — no consumers yet.
Wraps @expo/ui's BottomSheet/Host/Group/RNHostView so RN content (the
existing Capture/Preview sheet bodies) can render inside a real native
.sheet() presentation instead of the hand-rolled Reanimated one.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migrate `TimelinePreviewSheet` to native chrome + native quick-actions Menu

**Files:**
- Modify: `apps/mobile/src/components/calendar/TimelinePreviewSheet.tsx`
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx:1474-1489` (the `<TimelinePreviewSheet
  .../>` call site, to pass the new `onDelete` prop)

**Interfaces:**
- Consumes: `NativeBottomSheet` from Task 1; `CalendarScreen`'s existing
  `handleDelete(entry: TimelineEntry, onDeleted?: () => void): void` (already defined at
  `CalendarScreen.tsx:1183`, already shows a native `Alert.alert` confirmation).
- Produces: `TimelinePreviewSheetProps` gains `onDelete: () => void`.

- [ ] **Step 1: Rewrite `TimelinePreviewSheet.tsx`**

Replace the full file contents:

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Host, Menu, Button } from '@expo/ui/swift-ui';
import { NativeBottomSheet } from '../ui/NativeBottomSheet';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { Clock } from '../../icons';
import { getThemeColors, radius, spacing } from '../../theme';

interface TimelinePreviewSheetProps {
  visible: boolean;
  isDark: boolean;
  title: string;
  notes?: string;
  timeRange: string;
  categoryLabel: string;
  accentColor: string;
  icon: ReactNode;
  completed: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function TimelinePreviewSheet({
  visible,
  isDark,
  title,
  notes,
  timeRange,
  categoryLabel,
  accentColor,
  icon,
  completed,
  onClose,
  onEdit,
  onComplete,
  onDelete,
}: TimelinePreviewSheetProps) {
  const palette = getThemeColors(isDark);

  return (
    <NativeBottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title="Timeline item"
      headerRight={(
        // A plain tap keeps today's exact behavior (opens Edit); a long-press reveals
        // Complete/Delete — same "tap does the obvious thing" pattern as iOS Mail's
        // reply button. Canvas timeline blocks have no drag gesture to collide with,
        // so this is the only place quick actions live (see design doc for why).
        <Host matchContents>
          <Menu label="Edit" systemImage="pencil" onPrimaryAction={onEdit}>
            {!completed ? (
              <Button label="Complete" systemImage="checkmark.circle" onPress={onComplete} />
            ) : null}
            <Button label="Delete" systemImage="trash" role="destructive" onPress={onDelete} />
          </Menu>
        </Host>
      )}
      contentContainerStyle={styles.content}
    >
      <View style={styles.identityRow}>
        <View style={[styles.iconDisc, { borderColor: accentColor, backgroundColor: `${accentColor}18` }]}>
          {icon}
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text>
          <View style={styles.timeRow}>
            <Clock size={13} color={palette.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.time, { color: palette.textSecondary }]}>{timeRange}</Text>
          </View>
        </View>
      </View>

      {notes ? (
        <Text style={[styles.notes, { color: palette.textSecondary }]}>{notes}</Text>
      ) : null}

      <View style={[styles.metaRow, { borderTopColor: palette.separator }]}>
        <View style={[styles.categoryChip, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}12` }]}>
          <Text style={[styles.categoryLabel, { color: accentColor }]}>{categoryLabel}</Text>
        </View>
        <View style={styles.completeAction}>
          <Text style={[styles.completeLabel, { color: palette.textSecondary }]}>
            {completed ? 'Completed' : 'Complete'}
          </Text>
          <LacquerDiscControl
            size={24}
            isCompleted={completed}
            isEnabled={!completed}
            accessibilityLabel={completed ? `${title} is completed` : `Complete ${title}`}
            onToggle={onComplete}
          />
        </View>
      </View>
    </NativeBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: spacing[4],
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontVariant: ['tabular-nums'],
  },
  notes: {
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  categoryChip: {
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  completeAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  completeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
```

This drops the old `headerEdit`/`headerEditLabel` styles and the `Pencil`/`TouchableOpacity`
imports (no longer used — the header trigger is now the native `Menu`).

- [ ] **Step 2: Wire `onDelete` in `CalendarScreen.tsx`**

Find the `<TimelinePreviewSheet` call (around line 1474):

```tsx
          onEdit={() => openEdit(preview.entry, preview.dateStr)}
          onComplete={() => {
            handleComplete(preview.entry);
            setPreview(null);
          }}
        />
```

Replace with:

```tsx
          onEdit={() => openEdit(preview.entry, preview.dateStr)}
          onComplete={() => {
            handleComplete(preview.entry);
            setPreview(null);
          }}
          onDelete={() => handleDelete(preview.entry, () => setPreview(null))}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification checklist (report to user, do not claim done yourself)**

Requires the EAS dev client on a physical iPhone or the iOS Simulator — not reachable from
this session's tools. Ask the user to confirm:
1. Tap any scheduled timeline block → Preview sheet opens, native sheet drag-to-dismiss
   works (drag down, or tap the backdrop).
2. Tap the "Edit" trigger in the Preview sheet header → Edit sheet opens exactly as
   before.
3. Long-press the same "Edit" trigger → native dropdown appears showing Complete (hidden
   if already completed) and Delete.
4. Tap Delete → native `Alert.alert` confirmation appears; confirming removes the item and
   closes the Preview sheet.
5. Both light and dark mode render the sheet and menu correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/calendar/TimelinePreviewSheet.tsx apps/mobile/src/screens/CalendarScreen.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): native chrome + quick-actions Menu for Preview sheet

TimelinePreviewSheet moves off the hand-rolled BottomSheet onto
NativeBottomSheet, and its single Edit button becomes a native Menu
(tap=Edit as before, long-press=Complete/Delete) — no canvas timeline
changes, since blocks have no gesture to collide with.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate `CaptureSheet`'s shell to native chrome

**Files:**
- Modify: `apps/mobile/src/components/item-composer/CaptureSheet.tsx`

**Interfaces:**
- Consumes: `NativeBottomSheet` from Task 1.

- [ ] **Step 1: Swap the import and the sheet tag**

In `CaptureSheet.tsx`, replace:

```tsx
import { BottomSheet } from '../ui/BottomSheet';
```

with:

```tsx
import { NativeBottomSheet } from '../ui/NativeBottomSheet';
```

Replace the JSX return's opening/closing tags and the `topAnchored` prop (native
`BottomSheet` only presents from the bottom — see design doc for why this is accepted):

```tsx
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      isDark={isDark}
      title="New task"
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
```

becomes:

```tsx
    <NativeBottomSheet
      visible={visible}
      onClose={onCancel}
      isDark={isDark}
      title="New task"
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
```

And the closing tag:

```tsx
    </BottomSheet>
```

becomes:

```tsx
    </NativeBottomSheet>
```

(The `<TouchableOpacity>` header buttons, `contextChip`, `TextInput` fields, `separator`,
`error`, and `Details` row inside stay exactly as they are for this task — Task 4 handles
the `TextInput` → `TextField` swap.)

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification checklist (report to user, do not claim done yourself)**

1. Open the Capture sheet (long-press-drag to create a block, or the "Block now" /
   "Add" actions) — confirms it now rises from the bottom (no longer top-anchored) with
   native sheet chrome and drag-to-dismiss.
2. Type a title, confirm Save enables/disables correctly, confirm Cancel and Save both
   still work.
3. Confirm dark/light mode both render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/item-composer/CaptureSheet.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): native chrome for CaptureSheet

Moves CaptureSheet off the hand-rolled BottomSheet onto
NativeBottomSheet. Accepts becoming a standard bottom sheet (native
BottomSheet has no top-anchored equivalent) — this also brings it in
line with apps/mobile/CLAUDE.md's own Capture Sheet description, which
the previous topAnchored behavior had drifted from.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Native `TextField` for CaptureSheet's title/notes

**Files:**
- Modify: `apps/mobile/src/components/item-composer/CaptureSheet.tsx`

**Interfaces:**
- Produces: new internal `CaptureSheetFields` subcomponent (not exported) holding the
  `useNativeState` calls, so they get a fresh native-state instance every time the sheet
  opens (mirrors what the old `openId`-keyed remount gave the plain `TextInput`s).

- [ ] **Step 1: Rewrite `CaptureSheet.tsx`**

Replace the full file contents:

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Host, TextField, useNativeState } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { NativeBottomSheet } from '../ui/NativeBottomSheet';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../../theme';
import type { ItemDraft } from './types';

type CaptureSheetProps = {
  visible: boolean;
  draft: ItemDraft | null;
  busy: boolean;
  error?: string;
  onChange: (updates: Partial<ItemDraft>) => void;
  onSave: () => void;
  onDetails: () => void;
  onCancel: () => void;
};

type Palette = ReturnType<typeof getThemeColors>;
type Material = ReturnType<typeof getItemComposerMaterial>;

function contextLabel(draft: ItemDraft): string | null {
  const parts: string[] = [];
  if (draft.scheduledDate) {
    const date = new Date(`${draft.scheduledDate}T12:00:00`);
    parts.push(date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  if (draft.scheduledTime) parts.push(draft.scheduledTime);
  if (draft.projectTitle) parts.push(draft.projectTitle);
  if (!parts.length && draft.status === 'inbox') parts.push('Inbox');
  return parts.length ? parts.join(' · ') : null;
}

type CaptureSheetFieldsProps = {
  draft: ItemDraft;
  busy: boolean;
  error?: string;
  palette: Palette;
  material: Material;
  onChange: (updates: Partial<ItemDraft>) => void;
  onDetails: () => void;
};

// Rendered only while the native sheet is actually presented (NativeBottomSheet fully
// unmounts its children between opens), so useNativeState's "captured once on first
// render" initial value is always this specific open's draft — no separate resync needed.
function CaptureSheetFields({
  draft,
  busy,
  error,
  palette,
  material,
  onChange,
  onDetails,
}: CaptureSheetFieldsProps) {
  const titleState = useNativeState(draft.title);
  const notesState = useNativeState(draft.notes);
  const context = contextLabel(draft);

  return (
    <>
      {context ? (
        <View style={[styles.contextChip, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}>
          <Text style={[styles.contextText, { color: material.accent }]} numberOfLines={1}>{context}</Text>
        </View>
      ) : null}

      <Host matchContents>
        <TextField
          text={titleState}
          placeholder="What needs doing?"
          autoFocus
          onTextChange={(title) => onChange({ title })}
          modifiers={[font({ size: 22, weight: 'medium' })]}
        />
      </Host>

      <View style={[styles.separator, { backgroundColor: material.rim }]} />

      <Host matchContents>
        <TextField
          text={notesState}
          placeholder="Add a note (optional)"
          onTextChange={(notes) => onChange({ notes })}
          modifiers={[font({ size: 15 })]}
        />
      </Host>

      {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.detailsButton, { borderTopColor: material.rim }]}
        onPress={onDetails}
        disabled={busy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show task details"
      >
        <Text style={[styles.detailsText, { color: palette.textSecondary }]}>Details</Text>
        <Text style={[styles.detailsChevron, { color: material.accent }]}>›</Text>
      </TouchableOpacity>
    </>
  );
}

export function CaptureSheet({
  visible,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onDetails,
  onCancel,
}: CaptureSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);

  if (!draft) return null;
  const canSave = Boolean(draft.title.trim()) && !busy;

  return (
    <NativeBottomSheet
      visible={visible}
      onClose={onCancel}
      isDark={isDark}
      title="New task"
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={onCancel} hitSlop={12} disabled={busy}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={onSave} hitSlop={12} disabled={!canSave}>
          <Text style={[styles.saveText, { color: material.accent, opacity: canSave ? 1 : 0.28 }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      <CaptureSheetFields
        draft={draft}
        busy={busy}
        error={error}
        palette={palette}
        material={material}
        onChange={onChange}
        onDetails={onDetails}
      />
    </NativeBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 16,
  },
  content: {
    paddingBottom: spacing[3],
  },
  actionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  contextChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  contextText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: 8,
  },
  detailsButton: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  detailsChevron: {
    fontSize: 23,
    lineHeight: 23,
  },
});
```

This drops `onSave`'s wiring to a text-field return key (`@expo/ui`'s `TextField` doesn't
expose a submit-on-return callback the way RN `TextInput.onSubmitEditing` did — the header
Save button is still always available, so this is a minor capability gap, not a lost
action) and drops the explicit `autoCorrect={false}` override (native `TextField`'s default
autocorrect is the whole point of this phase — see design doc goal). Also drops the now-
unused `titleInput`/`noteInput` style entries and the `useEffect`-based `titleRef.current
?.focus()` (replaced by `TextField`'s own `autoFocus` prop).

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification checklist (report to user, do not claim done yourself)**

This is the actual repro case for the bug that started this whole effort — test it
directly:
1. Long-press-drag on the timeline canvas to open the Capture sheet with a prefilled
   time/duration.
2. Immediately start typing a title fast, right as the sheet's entrance animation plays.
   Confirm no corruption, no unexpected close/reopen flash.
3. Confirm native autocorrect/selection behave like Notes/Messages (this is expected new
   behavior, not a bug, since `autoCorrect={false}` no longer applies).
4. Type a note, confirm Save persists both title and notes correctly (check the created
   block's preview afterward).
5. Confirm dark/light mode both render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/item-composer/CaptureSheet.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): native TextField for CaptureSheet title/notes

Replaces the plain TextInputs with @expo/ui's native TextField,
isolated in a CaptureSheetFields subcomponent so useNativeState gets a
fresh instance every sheet open. This is the field directly in the
blast radius of the text-corruption bug that started this effort —
native text handling has no controlled-value-vs-native-buffer race to
have that bug in.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Final integration pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Confirm no stray references**

Run: `cd apps/mobile && grep -rn "topAnchored" src/components/item-composer/CaptureSheet.tsx; grep -rn "from '../ui/BottomSheet'" src/components/calendar/TimelinePreviewSheet.tsx src/components/item-composer/CaptureSheet.tsx`
Expected: both commands print nothing (no matches) — confirms the old prop and import are
fully gone from the two migrated files, and confirms `git grep -l "ui/BottomSheet'" apps/mobile/src` still lists `QuickCreateSheet.tsx`, `LogDoseSheet.tsx`, `MedicationTimerSheet.tsx`
(expected — those are untouched, per the Global Constraints).

- [ ] **Step 3: Run the pure-logic test suite (sanity check nothing else broke)**

Run: `cd apps/mobile && npm test`
Expected: all existing tests pass (this plan doesn't touch any file `npm test` covers, so
this is a regression guard, not new coverage).

- [ ] **Step 4: Report full manual verification checklist to the user**

Consolidate Task 2/3/4's manual checklists into one message to the user, since they'll
likely test all three sheets in one device session. Do not mark this plan complete until
the user confirms.
