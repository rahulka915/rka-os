# Supplements + Micronutrient Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `supplement` item type (no stock/timer/Live-Activity machinery) with a fixed-but-extensible nutrient profile, tap-to-log dosing, daily nutrient totals, and a merged "Medications & Supplements" screen on native + web.

**Architecture:** `supplement` is a new sibling `ItemType` to `medication`, following the exact same `items` table + `activityLogs` pattern medication already uses, but stripped to just title/dose/nutrients. A new `actionType = 'supplement-taken'` log row snapshots the nutrient profile at log time. `getTodayNutrientTotals()` sums those snapshots for "today". UI-wise, the existing Medications screens (native `src/screens/MedicationsScreen.tsx`, web `src/webApp/MedicationsScreen.web.tsx`) gain a second section for supplements, backed by new lightweight row/form components — the existing medication code paths are untouched.

**Tech Stack:** React Native + Expo (native), Expo Web (web), `expo-sqlite` (via `src/db/database.ts`), Jest for unit tests.

## Global Constraints

- No stock/refill/packaging, no dose timers, no Live Activities, no widgets for supplements (per spec Non-goals).
- Nutrient keys for v1: `sodium`, `potassium`, `magnesium`, `calcium`, `chloride` (mg) — object shape must stay easy to extend with new optional keys later (per spec).
- Nutrient values are snapshotted into the activity log at log time, not re-derived live, so historical daily totals don't change if a supplement's nutrient values are edited later.
- `apps/mobile/SCHEMA.md` and `apps/mobile/WEB_PARITY.md` must be updated in the same pass (repo convention, restated in spec Docs section).
- Follow existing code style: no comments except non-obvious WHY, reuse existing patterns (`getItemsByType`, `updateItemMetadata`, `logActivity`/direct `activityLogs` insert, `useDbRefresh`).

---

### Task 1: `supplement` item type + DB functions

**Files:**
- Modify: `apps/mobile/src/db/types.ts` — add `'supplement'` to `ItemType` union (line 1).
- Modify: `apps/mobile/src/db/database.ts` — add `SupplementMeta`/`NutrientProfile` types and CRUD/log functions, placed near the existing medication functions (~line 2712 for types, ~line 2950 for functions).
- Test: `apps/mobile/src/utils/supplementNutrients.test.ts` (new) — tests for the pure aggregation logic (Task 2 also touches this file; this task adds the DB-facing tests inline in `database`-adjacent test file if one exists, otherwise colocate as below).

**Interfaces:**
- Produces: `NutrientProfile` (`{ sodium?: number; potassium?: number; magnesium?: number; calcium?: number; chloride?: number }`), `SupplementMeta` (`{ dose?: string; nutrients?: NutrientProfile }`), `getSupplements(): Item[]`, `createSupplement(title: string, meta: SupplementMeta): string`, `updateSupplement(id: string, title: string, meta: SupplementMeta): void`, `logSupplementTaken(itemId: string, takenAt?: number): void`, `getSupplementLogs(itemId: string, limit?: number): ActivityLog[]`.

- [ ] **Step 1: Add `'supplement'` to `ItemType`**

In `apps/mobile/src/db/types.ts` line 1, change:
```ts
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session' | 'skill' | 'backward-plan' | 'potential-attribute';
```
to:
```ts
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'supplement' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session' | 'skill' | 'backward-plan' | 'potential-attribute';
```

- [ ] **Step 2: Add `NutrientProfile`/`SupplementMeta` types and DB functions**

In `apps/mobile/src/db/database.ts`, immediately after the `MedicationMeta` interface closes (after line 2737-ish, before `getMedications`), add:

```ts
export interface NutrientProfile {
  sodium?: number;
  potassium?: number;
  magnesium?: number;
  calcium?: number;
  chloride?: number;
}

export interface SupplementMeta {
  dose?: string;
  nutrients?: NutrientProfile;
}

export function getSupplements(): Item[] {
  return getItemsByType('supplement');
}

export function createSupplement(title: string, meta: SupplementMeta): string {
  const id = uuid();
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, metadata, createdAt, updatedAt)
     VALUES (?, 'supplement', ?, 'active', ?, ?, ?)`,
    [id, title, JSON.stringify(meta), now, now]
  );
  logActivity(id, 'created');
  syncItemToRemote(id);
  return id;
}

export function updateSupplement(id: string, title: string, meta: SupplementMeta): void {
  const item = getItemWithMetadata(id);
  const existing: SupplementMeta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItem(id, { title });
  updateItemMetadata(id, { ...existing, ...meta });
  logActivity(id, 'edited');
}

export function logSupplementTaken(itemId: string, takenAt: number = Date.now()): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: SupplementMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, 'supplement-taken', ?, ?, ?)`,
    [uuid(), itemId, takenAt, JSON.stringify({ nutrients: meta.nutrients ?? {} }), now]
  );
}

export function getSupplementLogs(itemId: string, limit = 10): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'supplement-taken' ORDER BY timestamp DESC LIMIT ?`,
    [itemId, limit]
  );
}

const NUTRIENT_KEYS: (keyof NutrientProfile)[] = ['sodium', 'potassium', 'magnesium', 'calcium', 'chloride'];

export function getTodayNutrientTotals(): NutrientProfile {
  const today = formatDate(new Date());
  const startOfDay = new Date(`${today}T00:00:00`).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const logs = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'supplement-taken' AND timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC`,
    [startOfDay, endOfDay]
  );
  const totals: NutrientProfile = {};
  for (const log of logs) {
    if (!log.details) continue;
    let parsed: { nutrients?: NutrientProfile };
    try {
      parsed = JSON.parse(log.details);
    } catch {
      continue;
    }
    const nutrients = parsed.nutrients ?? {};
    for (const key of NUTRIENT_KEYS) {
      const value = nutrients[key];
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }
  return totals;
}
```

Also add `'supplement'` as a valid case in the `GtdDestination` union and `processInboxItem` switch (~line 3531 and ~3585): add `'supplement'` to the `GtdDestination` type union, and a matching `case 'supplement':` block mirroring the `case 'medication':` block exactly (same shape, `type: 'supplement'`, `gtdContext: 'supplement'`).

- [ ] **Step 3: Write failing tests for `getTodayNutrientTotals` and `logSupplementTaken`**

Create `apps/mobile/src/utils/supplementNutrients.test.ts`:
```ts
import { getDb, resetDbForTests } from '../db/database';
import { createSupplement, logSupplementTaken, getTodayNutrientTotals, getSupplementLogs } from '../db/database';

describe('supplement nutrient tracking', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('sums nutrients across logs taken today', () => {
    const id1 = createSupplement('Electrolyte Mix', { dose: '1 sachet', nutrients: { sodium: 300, potassium: 200 } });
    const id2 = createSupplement('Magnesium', { dose: '1 capsule', nutrients: { magnesium: 60 } });
    logSupplementTaken(id1);
    logSupplementTaken(id2);
    logSupplementTaken(id1);

    const totals = getTodayNutrientTotals();
    expect(totals.sodium).toBe(600);
    expect(totals.potassium).toBe(400);
    expect(totals.magnesium).toBe(60);
    expect(totals.calcium).toBeUndefined();
  });

  it('ignores logs from before today', () => {
    const id = createSupplement('Electrolyte Mix', { nutrients: { sodium: 300 } });
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    logSupplementTaken(id, yesterday);

    const totals = getTodayNutrientTotals();
    expect(totals.sodium).toBeUndefined();
  });

  it('snapshots nutrients at log time, unaffected by later edits', () => {
    const id = createSupplement('Electrolyte Mix', { nutrients: { sodium: 300 } });
    logSupplementTaken(id);

    getDb().runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [
      JSON.stringify({ nutrients: { sodium: 999 } }),
      id,
    ]);

    const totals = getTodayNutrientTotals();
    expect(totals.sodium).toBe(300);
  });

  it('records a supplement log retrievable via getSupplementLogs', () => {
    const id = createSupplement('Electrolyte Mix', { nutrients: { sodium: 300 } });
    logSupplementTaken(id);
    const logs = getSupplementLogs(id);
    expect(logs).toHaveLength(1);
    expect(logs[0].entityId).toBe(id);
  });
});
```

Check whether a `resetDbForTests` (or equivalent in-memory reset helper) already exists — grep `apps/mobile/src/db/database.ts` and any existing medication test file (`apps/mobile/src/utils/medicationDoseHistory.test.ts`) for how it sets up a fresh DB per test, and match that exact setup/teardown pattern instead of inventing a new one (medication tests already solve this problem — copy their approach verbatim, including whatever mock/in-memory sqlite driver they use).

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest supplementNutrients.test.ts`
Expected: FAIL — `createSupplement`/`logSupplementTaken`/etc. not yet exported, or DB setup mismatch.

- [ ] **Step 5: Fix DB setup pattern to match existing test conventions, then re-run**

Adjust the test's setup/teardown to match whatever the medication tests actually use (do this by reading `medicationDoseHistory.test.ts` in full before writing Step 3 — if it differs from what's shown above, follow the real pattern, not this draft).

Run: `cd apps/mobile && npx jest supplementNutrients.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
cd apps/mobile
git add src/db/types.ts src/db/database.ts src/utils/supplementNutrients.test.ts
git commit -m "feat: add supplement item type with nutrient tracking

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `useSupplements` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts` — add `useSupplements()` mirroring `useMedications()` (line 149), minus the timer-related bits.

**Interfaces:**
- Consumes: `getSupplements()`, `logSupplementTaken()` from Task 1.
- Produces: `useSupplements(): { supplements: Item[]; refresh: () => void; logDose: (id: string) => void }`.

- [ ] **Step 1: Read `useMedications` in full**

Read `apps/mobile/src/hooks/useDb.ts` around line 149 end-to-end (not just the excerpt already seen) to see the full hook body, its return shape, and how `useDbRefresh` is wired, so the new hook matches the file's conventions exactly.

- [ ] **Step 2: Add `useSupplements`**

Add near `useMedications`:
```ts
export function useSupplements() {
  const [supplements, setSupplements] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setSupplements(getSupplements());
  }, []);

  useDbRefresh(refresh);

  const logDose = useCallback((id: string) => {
    logSupplementTaken(id);
    refresh();
  }, [refresh]);

  return { supplements, refresh, logDose };
}
```
Add `getSupplements, logSupplementTaken` to the existing `from '../db/database'` import at the top of the file.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add src/hooks/useDb.ts
git commit -m "feat: add useSupplements hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Native UI — merge Supplements into `MedicationsScreen.tsx`

**Files:**
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx` — add a "Supplements" section, nutrient summary strip, and a `SupplementRow` component; rename the screen's visible header text to "Medications & Supplements".
- Create: `apps/mobile/src/components/SupplementEditForm.tsx` — title/dose/5 nutrient inputs, modeled on the existing medication edit modal in the same file (read it first to match the exact modal/sheet component used).
- Modify: `apps/mobile/src/icons.tsx` — add a `Beaker` export (`react-native-heroicons/outline/BeakerIcon`) for use as the supplement icon.

**Interfaces:**
- Consumes: `useSupplements()` (Task 2), `getTodayNutrientTotals()` (Task 1), `createSupplement`/`updateSupplement`/`getSupplementLogs` (Task 1).

- [ ] **Step 1: Read the full existing `MedicationsScreen.tsx`**

It's ~400+ lines based on the excerpt already seen (rows, modal, header, FAB hold action). Read start to finish before editing, since the section list structure, header text, and modal pattern all need to be matched exactly rather than guessed.

- [ ] **Step 2: Add `Beaker` icon export**

In `apps/mobile/src/icons.tsx`, add:
```ts
export { default as Beaker } from 'react-native-heroicons/outline/BeakerIcon';
```

- [ ] **Step 3: Build `SupplementRow` and nutrient summary strip inline in `MedicationsScreen.tsx`**

Add a `SupplementRow` component (title, dose, nutrient chips built from non-empty `NutrientProfile` keys, single tap → `logDose(item.id)` with a success haptic, no confirmation dialog) and a `NutrientSummaryStrip` component rendering `getTodayNutrientTotals()` as e.g. `Na 680mg · K 400mg · Mg 120mg` (omit zero/absent keys), following the row-component style already used for `TodayRow`/`NeedsAttentionRow` in this file (props shape, `getThemeColors`, `RNView`/`RNText` usage).

- [ ] **Step 4: Wire into the screen body**

In the main `MedicationsScreen` component: call `useSupplements()`, add a second `SectionList` section titled "Supplements" (or a second `<SectionList>` segment if the existing one uses `sections` prop — match whatever's there), render `NutrientSummaryStrip` above the supplement rows, and update the screen header text from "Medications" to "Medications & Supplements". Wire a "+" add action for supplements to open `SupplementEditForm` in the same modal pattern medication editing uses.

- [ ] **Step 5: Create `SupplementEditForm.tsx`**

New file, modeled on however the medication create/edit modal in `MedicationsScreen.tsx` is structured (likely inline in that file — if so, extract a comparable standalone component here instead of inlining, since this plan calls it out as its own file per the design spec). Fields: title (`TextInput`), dose (`TextInput`), and 5 numeric `TextInput`s for Sodium/Potassium/Magnesium/Calcium/Chloride (mg), Save calling `createSupplement`/`updateSupplement`, Cancel closing the modal without saving.

- [ ] **Step 6: Manual verification (native has no browser preview)**

Since this is a native RN screen (no `preview_*` browser tooling applies), verify via typecheck and by reading through the wired logic once more; call out in the final summary that on-device/simulator testing is still needed from the user.

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd apps/mobile
git add src/screens/MedicationsScreen.tsx src/components/SupplementEditForm.tsx src/icons.tsx
git commit -m "feat: add supplements section to native Medications screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Web UI — merge Supplements into `MedicationsScreen.web.tsx`

**Files:**
- Modify: `apps/mobile/src/webApp/MedicationsScreen.web.tsx` — mirror Task 3's changes for the web layout (Sidebar+DetailPanel model, not SectionList).
- Create: `apps/mobile/src/webApp/SupplementEditForm.web.tsx` — mirrors `apps/mobile/src/webApp/MedicationEditForm.web.tsx`'s structure/props but with the trimmed supplement fields.

**Interfaces:**
- Consumes: same DB functions as Task 3, plus whatever `DetailPanel`/`MedicationLogPanel.web.tsx` patterns this screen already uses for selection/detail display.

- [ ] **Step 1: Read the full existing `MedicationsScreen.web.tsx` and `MedicationEditForm.web.tsx`**

Read both files in full (only the top of `MedicationsScreen.web.tsx` has been seen so far) to understand the selection/detail-panel flow, `webColors`/`webSpacing` usage, and the edit form's exact prop contract before writing new code that has to slot into the same patterns.

- [ ] **Step 2: Create `SupplementEditForm.web.tsx`**

Mirror `MedicationEditForm.web.tsx`'s component shape (same prop names: likely `item`, `onSave`, `onCancel` or similar — match exactly what's there) but with only title/dose/5 nutrient number inputs, calling `createSupplement`/`updateSupplement`.

- [ ] **Step 3: Add supplements section + nutrient summary strip to `MedicationsScreen.web.tsx`**

Add a "Supplements" list section below/alongside Medications (using the same list-row + `DetailPanel` selection pattern the medication list uses), a nutrient summary strip using `getTodayNutrientTotals()`, and a "+ Add supplement" affordance opening `SupplementEditForm`. Update any on-screen "Medications" heading text to "Medications & Supplements".

- [ ] **Step 4: Verify in the browser preview**

Start the web dev server if not running (`npm run web` from `apps/mobile/`, or via `preview_start`), navigate to the Medications & Supplements screen, and:
- Add a supplement with nutrient values via `preview_click`/`preview_fill`.
- Log a dose, confirm the nutrient summary strip updates.
- Take a `preview_screenshot` of the resulting screen.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile
git add src/webApp/MedicationsScreen.web.tsx src/webApp/SupplementEditForm.web.tsx
git commit -m "feat: add supplements section to web Medications screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Capture/classification wiring + docs

**Files:**
- Modify: wherever the inbox capture quick-select destinations list `medication` (grep `GtdDestination` usages and any capture-sheet quick-select UI, native + web) — add `supplement` as a sibling destination.
- Modify: `apps/mobile/SCHEMA.md` — document `supplement` type + `NutrientProfile` shape.
- Modify: `apps/mobile/WEB_PARITY.md` — add a Supplements row/note.

**Interfaces:**
- Consumes: `GtdDestination`/`processInboxItem` (Task 1).

- [ ] **Step 1: Find all capture-destination UI referencing `medication`**

Run: `cd apps/mobile && grep -rn "'medication'" src/screens src/webApp src/components src/utils | grep -vi "db/database\|test"`

Add `'supplement'` as a parallel option everywhere `'medication'` appears as a `GtdDestination`/quick-select choice (label "Supplement", same icon treatment idiom as the medication option — use the new `Beaker` icon from Task 3 on native, and whatever icon set the web version uses).

- [ ] **Step 2: Update `SCHEMA.md`**

In `apps/mobile/SCHEMA.md`, add a `supplement` row to the entity-type table (mirroring the existing `medication` row at line 180) documenting `dose`, `nutrients` (`NutrientProfile`: sodium/potassium/magnesium/calcium/chloride, mg). Add a short "Supplement nutrient tracking" subsection near the existing "Medication packaging & stock" section (~line 198) explaining the snapshot-at-log-time behavior and `getTodayNutrientTotals()`.

- [ ] **Step 3: Update `WEB_PARITY.md`**

Add a row (or extend the existing Medications row) noting Supplements ship at parity on both native and web in this pass, dated 2026-08-14.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add -A
git commit -m "docs: document supplement type and update capture destinations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run full test suite**

Run: `cd apps/mobile && npx jest`
Expected: all tests pass, including the new `supplementNutrients.test.ts` and all pre-existing medication tests unchanged.

- [ ] **Step 2: Typecheck the whole app**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Web smoke test**

Via `preview_*` tools: reload the Medications & Supplements screen, log an existing supplement dose, confirm the nutrient strip total updates correctly, screenshot the final state for the user.

- [ ] **Step 4: Summarize for user**

Report what was built, note that native (iOS) visual verification wasn't possible in this session (no simulator/preview tooling), and that the user should run it on-device before considering it fully done.
