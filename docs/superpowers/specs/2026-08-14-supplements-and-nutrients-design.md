# Supplements type + micronutrient tracking

## Problem

Medications and supplements are currently the same `medication` item type. Supplements (e.g. electrolytes) don't need stock/refill tracking, dose timers, or Live Activities — that machinery is medication-specific. Supplements also need a way to record micronutrient content (e.g. sodium/potassium/magnesium per dose) and see daily totals, as a stepping stone toward possible future calorie/macro tracking.

## Goals

- New `supplement` item type, separate from `medication`, with no stock/timer/Live-Activity machinery.
- Fixed-but-extensible nutrient profile (sodium, potassium, magnesium, calcium, chloride in mg) attached to a supplement.
- Simple tap-to-log dosing (no confirmation sheet, no stock gating).
- Daily nutrient totals aggregated from today's logged supplement doses.
- Medications and Supplements shown in one merged screen (native + web), grouped under separate section headers.
- Web/native parity maintained per `WEB_PARITY.md` convention.

## Non-goals

- No stock/refill/packaging tracking for supplements.
- No dose timers, Live Activities, or widgets for supplements.
- No calorie/macro fields yet (nutrient key set is designed to extend to this later, but v1 ships electrolytes only).
- No retroactive migration of existing `medication` items into `supplement` — this is additive only.

## Data model

### `ItemType`
Add `'supplement'` to the union in `src/db/types.ts`.

### `SupplementMeta`
```ts
interface NutrientProfile {
  sodium?: number;   // mg
  potassium?: number; // mg
  magnesium?: number; // mg
  calcium?: number;   // mg
  chloride?: number;  // mg
  // extend with new optional keys (vitamins, calories, macros) as needed
}

interface SupplementMeta {
  dose?: string;           // freeform, e.g. "1 sachet", "2 capsules"
  nutrients?: NutrientProfile;
}
```
Stored the same way medication meta is: JSON-serialized into `items.metadata`.

### Activity logging
`logSupplementTaken(itemId, takenAt = Date.now())`:
- Inserts an `activityLogs` row: `actionType = 'supplement-taken'`, `entityId = itemId`, `timestamp = takenAt`, `details = JSON.stringify({ nutrients: <snapshot of item's current nutrients> })`.
- Snapshotting nutrients at log time (not re-deriving from current item state on read) mirrors the existing medication dose log pattern (`amount` snapshotted at log time) — later edits to a supplement's nutrient values must not retroactively change historical daily totals.

### Daily nutrient totals
`getTodayNutrientTotals(): NutrientProfile`
- Queries `activityLogs` where `actionType = 'supplement-taken'` and `timestamp` falls within today (local day boundary, same convention used elsewhere for "today" queries e.g. Home's today buckets).
- Parses each row's `details.nutrients`, sums per key.
- Returns a single `NutrientProfile`-shaped object with summed values (missing keys omitted or zero).

## Functions (database.ts)

- `getSupplements(): Item[]` → `getItemsByType('supplement')`
- `createSupplement(title: string, meta: SupplementMeta): string`
- `updateSupplement(itemId: string, meta: Partial<SupplementMeta>): void`
- `logSupplementTaken(itemId: string, takenAt?: number): void`
- `getSupplementLogs(itemId: string, limit?: number)` — mirrors `getMedicationLogs`, for a supplement's dose history
- `getTodayNutrientTotals(): NutrientProfile`

`deleteItem` already works generically by id — no supplement-specific deletion needed. `processInboxItem` classification destinations gain `supplement` alongside `medication` where that switch is keyed by type (`src/db/database.ts` ~line 3585).

## UI

### Screen merge
`MedicationsScreen.tsx` (native) and `MedicationsScreen.web.tsx` are relabeled "Medications & Supplements". Both:
- Fetch `getMedications()` and `getSupplements()`.
- Render as two sections in the existing `SectionList` (native) / equivalent list (web): "Medications" (unchanged rows/logic — eligibility, stock meter, timers, restock) and "Supplements" (new lightweight rows).
- Sections are not interleaved — medication-eligibility logic (`computeMedicationEligibility`, stock warnings) stays scoped to medications; supplements never enter that computation.

### Supplement row
- Title, dose string, small nutrient chips (e.g. "Na 300mg · K 200mg") built from whichever nutrient keys are non-empty.
- Single tap action: log now (`logSupplementTaken`), success haptic, no confirmation dialog (nothing to gate on — no stock, no min-hours-between-doses).
- Long-press or overflow: edit / delete / view dose history (mirrors medication's existing affordances).

### Daily nutrient summary strip
At the top of the "Supplements" section: a compact strip built from `getTodayNutrientTotals()`, e.g. `Na 680mg · K 400mg · Mg 120mg`. Omit nutrients with a zero/absent total. Recomputed whenever a supplement is logged (same refresh path as the rest of the screen after a log action).

### Create/edit form
New `SupplementEditForm` (native component + `.web.tsx`), modeled on the medication edit form's shell (modal/sheet, title input, save/cancel) but with only:
- Title
- Dose (text)
- Five optional numeric inputs: Sodium, Potassium, Magnesium, Calcium, Chloride (mg)

No packaging/stock/timer fields.

### Capture / classification
Wherever `medication` appears as an inbox-classification destination (capture sheet quick-select, `processInboxItem`, `gtdContext` enum), add `supplement` as a sibling destination so items can be captured and classified directly as supplements, not just created from the merged screen.

## Icons

Reuse existing icon infrastructure. Supplements get a distinct icon from `MedicationBottleIcon` (e.g. reuse an existing capsule/leaf icon already in `src/icons` if one exists, otherwise a simple new icon component following `MedicationBottleIcon`'s pattern) so rows are visually distinguishable from medications at a glance.

## Testing

- Unit tests for `getTodayNutrientTotals` (sums correctly across multiple logs, ignores logs outside today, ignores non-`supplement-taken` actionTypes, handles missing/undefined nutrient keys).
- Unit tests for `logSupplementTaken` (snapshots current nutrients into `details`, independent of later item edits).
- Existing medication tests remain untouched/passing (no shared logic regressed).

## Docs

- `apps/mobile/SCHEMA.md`: add `supplement` type row + nutrient profile shape, alongside existing `medication` documentation.
- `apps/mobile/WEB_PARITY.md`: add Supplements screen/feature row for native vs web parity tracking.
