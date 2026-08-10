# Home Medication Quick-Log Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-tap-to-pick, one-alert-to-confirm medication logging widget to `HomeScreen.tsx`, so logging a dose no longer requires navigating to the Medications screen.

**Architecture:** A new pure function `computeMedicationEligibility(item)` (extracted from the existing `useMedState` hook in `MedicationsScreen.tsx`) drives eligibility for a medication picked at tap-time. A new `MedicationQuickLogWidget` component uses it plus the existing `showActionSheet` utility and `useMedications()` hook to run the same take/take-half/take+timer flow `MedicationsScreen` already uses, without any new DB or service code.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, existing `useMedications()` hook, `showActionSheet` (ActionSheetIOS wrapper), `RiverStoneSurface` card styling.

## Global Constraints

- No new database or service functions — only `getMedications`, `takeMedication`, `takeHalfDose` (all already exported/used elsewhere) are called.
- `computeMedicationEligibility` must produce byte-identical output to the current inline `useMedState` body — this is a pure extraction, not a behavior change.
- Widget renders `null` when `getMedications().length === 0` (no active medications tracked).
- This is a mobile-only (`apps/mobile/`) change — no desktop web equivalent in this pass.
- Verify with `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` from `apps/mobile/`, filtering out expected `TS2307` (web-only file resolution) errors — this repo has no automated test suite for screens/components, so this plus a manual on-device/simulator check is the verification bar (matches how every prior feature in this session was verified).

---

### Task 1: Extract `computeMedicationEligibility` and refactor `useMedState`

**Files:**
- Create: `apps/mobile/src/utils/medicationState.ts`
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx:44-60`

**Interfaces:**
- Produces: `computeMedicationEligibility(item: Item): MedicationEligibility` where
  `MedicationEligibility = { meta: MedicationMeta; lastLog: ActivityLog | null; stock: number; isTrackingStock: boolean; isLowStock: boolean; canTake: boolean; hasPendingHalf: boolean }`.
  Task 2 imports this function directly.

- [ ] **Step 1: Create `src/utils/medicationState.ts`**

```typescript
import { getLastTakenLog, getTotalStock, type MedicationMeta } from '../db/database';
import type { Item, ActivityLog } from '../db/types';

export interface MedicationEligibility {
  meta: MedicationMeta;
  lastLog: ActivityLog | null;
  stock: number;
  isTrackingStock: boolean;
  isLowStock: boolean;
  canTake: boolean;
  hasPendingHalf: boolean;
}

// Pure — no hooks — so it can be called both from a render (MedicationsScreen's
// useMedState) and at tap-time for an item chosen from an action sheet
// (HomeScreen's MedicationQuickLogWidget), where there is no component render
// to hook into.
export function computeMedicationEligibility(item: Item): MedicationEligibility {
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const lastLog = getLastTakenLog(item.id);
  const isTrackingStock = meta.containers !== undefined || meta.stockRemaining !== undefined;
  const stock = getTotalStock(meta);
  const threshold = meta.refillThreshold ?? 5;
  const isLowStock = isTrackingStock && stock <= threshold;
  const hasPendingHalf = !!meta.pendingHalfDoseAt;
  const canTake = (() => {
    // Completing an already-started split dose is always allowed — that's the
    // whole point of splitting (no required gap between the two halves).
    if (hasPendingHalf) return true;
    if (!meta.minHoursBetweenDoses || !lastLog) return true;
    return (Date.now() - lastLog.timestamp) / 3600000 >= meta.minHoursBetweenDoses;
  })();
  return { meta, lastLog, stock, isTrackingStock, isLowStock, canTake, hasPendingHalf };
}
```

- [ ] **Step 2: Replace the inline body of `useMedState` in `MedicationsScreen.tsx`**

Replace lines 44-60 (the current `function useMedState(item: Item) { ... }` block) with:

```typescript
function useMedState(item: Item) {
  return computeMedicationEligibility(item);
}
```

Add the import near the top of `MedicationsScreen.tsx` (alongside the existing `../db/database` import):

```typescript
import { computeMedicationEligibility } from '../utils/medicationState';
```

- [ ] **Step 3: Typecheck**

Run: `cd "apps/mobile" && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit > /tmp/tsc_medstate.txt 2>&1; grep -v "TS2307" /tmp/tsc_medstate.txt`

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/utils/medicationState.ts apps/mobile/src/screens/MedicationsScreen.tsx
git commit -m "refactor(mobile): extract computeMedicationEligibility from useMedState

Pure eligibility logic (stock, canTake, hasPendingHalf) needs to run at
tap-time for a medication picked from an action sheet, not just inside a
component render — extracting it lets the upcoming Home quick-log widget
reuse the exact same rules MedicationsScreen already applies."
```

---

### Task 2: Build `MedicationQuickLogWidget` and wire into `HomeScreen`

**Files:**
- Create: `apps/mobile/src/components/home/MedicationQuickLogWidget.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `computeMedicationEligibility(item: Item): MedicationEligibility` (Task 1). `useMedications()` from `../../hooks/useDb` — existing, returns `{ medications: Item[]; refresh: () => void; takeMedication: (id: string, takenAt?: number, startTimer?: boolean) => void; takeHalfDose: (id: string, takenAt?: number, startTimer?: boolean) => boolean }`. `showActionSheet(title: string | undefined, actions: { label: string; onPress: () => void; destructive?: boolean }[]): void` from `../../utils/actionSheet`. `MedicationBottleIcon` from `../icons/MedicationBottleIcon`. `RiverStoneSurface` from `../riverstone`. `getThemeColors(isDark: boolean)` from `../../theme`.
- Produces: `MedicationQuickLogWidget()` — a self-contained component (no props; calls `useMedications()` itself), rendered once in `HomeScreen.tsx`.

- [ ] **Step 1: Create `src/components/home/MedicationQuickLogWidget.tsx`**

```typescript
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMedications } from '../../hooks/useDb';
import { computeMedicationEligibility } from '../../utils/medicationState';
import { showActionSheet } from '../../utils/actionSheet';
import { MedicationBottleIcon } from '../icons/MedicationBottleIcon';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';

interface MedicationQuickLogWidgetProps {
  isDark: boolean;
}

// Home-screen shortcut so logging a dose never requires navigating to the
// Medications screen: tap the card, pick a medication from an action sheet,
// confirm in the same Take / Take + Timer / Take Half alert
// MedicationsScreen's TodayRow already uses. Reuses useMedications()
// directly (not passed as props) so it's a true drop-in — HomeScreen doesn't
// need to know anything about medications to render it.
export function MedicationQuickLogWidget({ isDark }: MedicationQuickLogWidgetProps) {
  const { medications, takeMedication, takeHalfDose } = useMedications();
  const palette = getThemeColors(isDark);

  if (medications.length === 0) return null;

  const promptTake = (item: Item) => {
    const { meta, lastLog, stock, canTake, hasPendingHalf } = computeMedicationEligibility(item);

    if (meta.containers !== undefined || meta.stockRemaining !== undefined) {
      if (stock === 0) {
        Alert.alert('Out of stock', 'No doses remaining.', [{ text: 'OK' }]);
        return;
      }
    }

    if (!canTake) {
      const minsLeft = Math.ceil(meta.minHoursBetweenDoses! * 60 - (Date.now() - lastLog!.timestamp) / 60000);
      Alert.alert('Too soon', `Next dose in ${minsLeft < 60 ? `${minsLeft}m` : `${Math.ceil(minsLeft / 60)}h`}`, [{ text: 'OK' }]);
      return;
    }

    const canTakeHalf = !!meta.splitDoseEnabled && !hasPendingHalf;
    Alert.alert(`Take ${item.title}`, meta.dose ?? 'Record dose?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeMedication(item.id, undefined, false); } },
      { text: 'Take + Timer', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeMedication(item.id, undefined, true); } },
      ...(canTakeHalf ? [{ text: 'Take Half', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeHalfDose(item.id, undefined, false); } }] : []),
    ]);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showActionSheet(
      'Log Medication',
      medications.map((item) => {
        const meta = item.metadata ? JSON.parse(item.metadata) : {};
        return {
          label: `${item.title}${meta.dose ? ` ${meta.dose}` : ''}`,
          onPress: () => promptTake(item),
        };
      }),
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.touchWrap}>
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.content}>
          <MedicationBottleIcon size={40} />
          <Text style={[styles.primaryText, { color: palette.text }]}>Log Medication</Text>
          <Text style={[styles.secondaryText, { color: palette.textMuted }]}>Tap to record a dose</Text>
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    paddingVertical: 4,
  },
  fill: {
    flex: 1,
  },
  squareCard: {
    aspectRatio: 1.16,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Wire the widget into `HomeScreen.tsx`'s top row**

In `apps/mobile/src/screens/HomeScreen.tsx`, add the import:

```typescript
import { MedicationQuickLogWidget } from '../components/home/MedicationQuickLogWidget';
```

Replace the existing Inbox-preview block:

```tsx
        {/* Inbox preview */}
        <View style={{ width: '50%', marginHorizontal: 12, marginTop: 8 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>
```

with a two-up row:

```tsx
        {/* Quick actions: Inbox + Medication logging */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <InboxScrollCard
              inboxCount={inboxCount}
              onPress={onInboxPress}
              isDark={isDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MedicationQuickLogWidget isDark={isDark} />
          </View>
        </View>
```

- [ ] **Step 3: Typecheck**

Run: `cd "apps/mobile" && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit > /tmp/tsc_medwidget.txt 2>&1; grep -v "TS2307" /tmp/tsc_medwidget.txt`

Expected: no output (clean).

- [ ] **Step 4: Manual verification on device/simulator**

Start the dev client (`npm start -- --clear` from `apps/mobile/`), open Home:
- Confirm the new card renders next to the Inbox card (or is absent if there are zero medications).
- Tap it → action sheet lists every active medication with dose.
- Pick one with no stock tracked and eligible → confirm alert shows Take / Take + Timer (+ Take Half if `splitDoseEnabled`).
- Confirm "Take" logs the dose (check it now appears in `MedicationsScreen`'s history / stock decremented if tracked).
- If any medication is currently too-soon or out-of-stock, verify picking it shows the single-button warning alert instead of the take confirm.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/MedicationQuickLogWidget.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat(mobile): add Home medication quick-log widget

Logging a dose previously required navigating to the Medications screen and
finding the specific row. This adds a one-tap card on Home that opens an
action sheet of active medications, then the same Take / Take + Timer /
Take Half confirm flow MedicationsScreen already uses."
```
