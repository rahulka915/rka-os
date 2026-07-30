# Web Companion Core GTD — Plan 1: Foundation + Item/Relations/Today-Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the app booting in a browser via `expo start --web`, and build the first slice of `db/database.web.ts` — item CRUD, relations/manual-order, and today-planning — so Inbox, Tasks, Areas, and Projects screens work end-to-end against Firestore in a browser, with zero changes to those screens' own code.

**Architecture:** `db/database.web.ts` mirrors `db/database.ts`'s full exported surface (required so the whole app typechecks, since out-of-scope screens are still bundled) — the in-scope third of it gets real Firestore-backed implementations using an in-memory store fed by `onSnapshot` listeners (mechanical port of each SQL predicate to a JS filter, same technique as the mobile sync work); everything else is a clearly-marked throwing stub for a later sub-project. Metro resolves `.web.ts` automatically for the web build, so no screen or hook changes are needed.

**Tech Stack:** `expo start --web` (React Native Web, already a dependency), `firebase/firestore` (already a dependency), existing `node --test` runner for pure-logic checks, browser preview tools for on-device verification (this is browser-observable work, unlike the native-only mobile work earlier).

## Global Constraints

- `db/database.web.ts` must export every name `db/database.ts` exports — pure types are type-only re-exported (`import type {...} from './database'`, erased at compile time, zero runtime cost, safe even though `database.ts` itself imports `expo-sqlite`); everything else not in this plan's scope is a throwing stub, explicitly `// TODO(web-companion): not yet ported — <feature area>`.
- Metadata (and `details`/`instanceMetadata`) stay JSON **strings**, matching what's actually in production Firestore data today (confirmed by inspecting live documents this session) — no format conversion needed.
- No new Firestore security rules or indexes needed — the web client reads collections mobile already writes to (`items`, `itemInstances`, `itemRelations`, `itemOrder`), under rules already deployed this session.
- No automated tests for `database.web.ts` (matches the existing project-wide convention — mobile's `firestoreSync.ts` and `database.ts` have none either); verification is `tsc --noEmit` + browser preview checks, per the approved design spec.
- In scope for real implementation this plan: item CRUD, relations/manual-order, today-planning. Calendar/timeline and GTD triage are Plan 2 (per the design spec's stated 2-3 plan expectation) — their stub placeholders from this plan get replaced there, not here.

---

## File Structure

**Create:**
- `apps/mobile/src/db/firestoreWebStore.ts` — the reactive in-memory mirror (items, itemInstances, itemRelations, itemOrder collections) + write helpers
- `apps/mobile/src/db/database.web.ts` — the platform-specific data layer Metro resolves for web builds

**Modify:** none required for this plan's scope (screens/hooks need zero changes — that's the point of the `.web.ts` split). If Task 1 uncovers boot-blocking issues elsewhere (e.g. `lib/firebase.ts`), those get fixed in place as part of Task 1.

---

## Task 1: Get the app booting in a browser

**Files:** none known ahead of time — this task is investigative; whatever breaks gets fixed in place.

- [ ] **Step 1: Start the web dev server**

Run: `cd apps/mobile && npm run web`
Expected: Metro bundles for web and prints a local URL (typically `http://localhost:8081` or similar — Expo will report the actual port).

- [ ] **Step 2: Open it in a browser and check for boot-blocking errors**

Use the browser preview tools (`preview_start` pointed at the printed URL, then `preview_console_logs` / `preview_snapshot`) to see what actually renders. Expect at least one of:
- A crash from `lib/firebase.ts`'s `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` — `getReactNativePersistence` is RN-specific and may not have a web-safe path. If it crashes, gate it: use `getReactNativePersistence` only when `Platform.OS !== 'web'`, and fall back to `initializeAuth(app)` (browser default persistence) on web. Import `Platform` from `react-native`.
- A crash from a native-only module imported eagerly at the top of `App.tsx` or a screen it renders unconditionally (e.g. `expo-calendar`, `expo-speech-recognition`, Live Activity modules). Fix each by checking whether the import is actually reachable on the core-GTD navigation path; if it's only used by an out-of-scope screen/feature, defer fixing it deeply — a version that renders a visible error boundary or blank screen for that one screen is acceptable for this plan, as long as it doesn't crash the whole app on boot.

- [ ] **Step 3: Confirm the app boots to some screen without a white-screen crash**

Run: `preview_screenshot` (or `preview_snapshot` for text content)
Expected: some UI renders — full correctness of every screen is not required yet, this step only confirms the bundler/runtime itself works.

- [ ] **Step 4: Commit whatever fixes were needed**

```bash
git add apps/mobile/src/lib/firebase.ts  # and any other files touched
git commit -m "fix(mobile): unblock web build boot"
```

(If Step 2 required no fixes, skip this step — nothing to commit.)

---

## Task 2: Stub scaffold + type re-exports

**Files:**
- Create: `apps/mobile/src/db/database.web.ts` (initial version — stubs only; Tasks 4-6 replace the in-scope ones with real implementations)

**Interfaces:**
- Produces: every exported name from `db/database.ts`, either as a type-only re-export or a throwing stub with the same runtime signature.

- [ ] **Step 1: Write the type-only re-exports**

```typescript
// apps/mobile/src/db/database.web.ts
import type {
  TimerWidgetPresentation,
  VisibleTimerWidgetPresentation,
  MedicationContainer,
  MedicationMeta,
  StockBreakdownSheet,
  StockBreakdownContainer,
  StockBreakdown,
  MedicationTimerDetails,
  TimerWidgetPreferences,
  TimelineEntry,
  GtdDestination,
} from './database';

export type {
  TimerWidgetPresentation,
  VisibleTimerWidgetPresentation,
  MedicationContainer,
  MedicationMeta,
  StockBreakdownSheet,
  StockBreakdownContainer,
  StockBreakdown,
  MedicationTimerDetails,
  TimerWidgetPreferences,
  TimelineEntry,
  GtdDestination,
};
```

- [ ] **Step 2: Write the throwing-stub helper and stubs for every not-yet-ported function**

```typescript
import type { Item, ItemInstance, ActivityLog } from './types';

function notImplementedOnWeb(name: string): never {
  throw new Error(`${name} is not implemented on web yet`);
}

// TODO(web-companion): not yet ported — raw SQLite handle, meaningless on web
export function getDb(): never {
  return notImplementedOnWeb('getDb');
}

// TODO(web-companion): not yet ported — mobile-only dual-write helper, meaningless on web (Firestore is already the source of truth here)
export function syncItemToRemote(_id: string): void {
  notImplementedOnWeb('syncItemToRemote');
}

// TODO(web-companion): not yet ported — medication tracking (future sub-project)
export function getTotalStock(_meta: MedicationMeta): number {
  return notImplementedOnWeb('getTotalStock');
}
export function getStockBreakdown(_meta: MedicationMeta): StockBreakdown | null {
  return notImplementedOnWeb('getStockBreakdown');
}
export function getContainerSummary(_meta: MedicationMeta): string | null {
  return notImplementedOnWeb('getContainerSummary');
}
export function restockMedication(_itemId: string, _containerCount?: number): void {
  notImplementedOnWeb('restockMedication');
}
export function parseMedicationTimerDetails(_details?: string | null): MedicationTimerDetails {
  return notImplementedOnWeb('parseMedicationTimerDetails');
}
export function getMedications(): Item[] {
  return notImplementedOnWeb('getMedications');
}
export function createMedication(_title: string, _meta: MedicationMeta): string {
  return notImplementedOnWeb('createMedication');
}
export function updateMedication(_id: string, _title: string, _meta: MedicationMeta): void {
  notImplementedOnWeb('updateMedication');
}
export function logMedicationTaken(_itemId: string, _takenAt?: number, _startTimer?: boolean, _amount?: number): void {
  notImplementedOnWeb('logMedicationTaken');
}
export function logHalfDoseTaken(_itemId: string, _takenAt?: number, _startTimer?: boolean): boolean {
  return notImplementedOnWeb('logHalfDoseTaken');
}
export function getMedicationLogs(_itemId: string, _limit?: number): ActivityLog[] {
  return notImplementedOnWeb('getMedicationLogs');
}
export function getMedicationDoseHistory(_itemId: string, _days?: number): Array<{ date: string; count: number }> {
  return notImplementedOnWeb('getMedicationDoseHistory');
}
export function deleteMedicationLog(_logId: string, _itemId: string): void {
  notImplementedOnWeb('deleteMedicationLog');
}
export function editMedicationLog(_logId: string, _itemId: string, _newTimestamp: number): void {
  notImplementedOnWeb('editMedicationLog');
}
export function stopMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('stopMedicationTimer');
}
export function completeMedicationTimer(_logId: string, _itemId: string, _completedElapsedMs: number, _reason: 'manual' | 'automatic'): void {
  notImplementedOnWeb('completeMedicationTimer');
}
export function setMedicationTimerNotificationId(_logId: string, _notificationId?: string): void {
  notImplementedOnWeb('setMedicationTimerNotificationId');
}
export function pauseMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('pauseMedicationTimer');
}
export function markMedicationTimerNotified(_logId: string): void {
  notImplementedOnWeb('markMedicationTimerNotified');
}
export function resumeMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('resumeMedicationTimer');
}
export function resetMedicationTimer(_logId: string, _itemId: string): void {
  notImplementedOnWeb('resetMedicationTimer');
}
export function startTimerFromLoggedDose(_logId: string, _itemId: string): void {
  notImplementedOnWeb('startTimerFromLoggedDose');
}
export function getActiveMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return notImplementedOnWeb('getActiveMedicationTimers');
}
export function getPersistentMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  return notImplementedOnWeb('getPersistentMedicationTimers');
}
export function getTimerWidgetPreferences(): TimerWidgetPreferences {
  return notImplementedOnWeb('getTimerWidgetPreferences');
}
export function setTimerWidgetPreferences(_preferences: Partial<TimerWidgetPreferences>): TimerWidgetPreferences {
  return notImplementedOnWeb('setTimerWidgetPreferences');
}
export function getLastTakenLog(_itemId: string): ActivityLog | null {
  return notImplementedOnWeb('getLastTakenLog');
}

// TODO(web-companion): not yet ported — calendar/timeline, Plan 2
export function getItemsForDate(_date: string): Item[] {
  return notImplementedOnWeb('getItemsForDate');
}
export function getInstancesForDate(_date: string): ItemInstance[] {
  return notImplementedOnWeb('getInstancesForDate');
}
export function getTimelineEntriesForDate(_date: string): TimelineEntry[] {
  return notImplementedOnWeb('getTimelineEntriesForDate');
}
export function createTimedItem(
  _type: Item['type'],
  _title: string,
  _scheduledDate: string,
  _time: string,
  _notes?: string,
): { itemId: string; instanceId: string } {
  return notImplementedOnWeb('createTimedItem');
}
export function updateTimelineItemTime(_id: string, _time: string): void {
  notImplementedOnWeb('updateTimelineItemTime');
}
export function updateTimelineItemSchedule(_id: string, _scheduledDate?: string, _time?: string): void {
  notImplementedOnWeb('updateTimelineItemSchedule');
}
export function updateInstanceMetadata(_instanceId: string, _metadata: Record<string, any>): void {
  notImplementedOnWeb('updateInstanceMetadata');
}
export function getTodayInstances(): ItemInstance[] {
  return notImplementedOnWeb('getTodayInstances');
}
export function completeInstance(_instanceId: string): void {
  notImplementedOnWeb('completeInstance');
}

// TODO(web-companion): not yet ported — GTD triage, Plan 2
export function processInboxItem(_id: string, _destination: GtdDestination): void {
  notImplementedOnWeb('processInboxItem');
}
export function applyTaskTriage(
  _id: string,
  _decision: { priority: 'low' | 'medium' | 'high'; when: 'today' | 'tomorrow' | 'week' | 'someday'; projectId: string | null },
): void {
  notImplementedOnWeb('applyTaskTriage');
}
```

- [ ] **Step 2: Run the whole-app typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `database.web.ts` missing exports. (Errors in unrelated files pre-existing from other concurrent work in this repo are not this task's concern — only confirm nothing *new* traces back to this file.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): scaffold database.web.ts with stubs for out-of-scope functions"
```

---

## Task 3: Firestore reactive store for web

**Files:**
- Create: `apps/mobile/src/db/firestoreWebStore.ts`

**Interfaces:**
- Consumes: `firestore`, `hasFirebaseConfig` from `../lib/firebase`; `auth` from `../lib/firebase` (to get the signed-in user's uid).
- Produces:
  - `startWebStore(uid: string): void`
  - `stopWebStore(): void`
  - `subscribeToWebStoreChanges(listener: () => void): () => void`
  - `getItemsSnapshot(): Item[]`
  - `getItemInstancesSnapshot(): ItemInstance[]`
  - `getItemRelationsSnapshot(): ItemRelationRow[]`
  - `getItemOrderSnapshot(): ItemOrderRow[]`
  - `getActivityLogsSnapshot(): ActivityLog[]`
  - `putItem(item: Item): Promise<void>`
  - `patchItem(id: string, patch: Partial<Omit<Item, 'id'>>): Promise<void>`
  - `putItemInstance(instance: ItemInstance): Promise<void>`
  - `deleteItemInstanceDoc(id: string): Promise<void>`
  - `putItemRelation(row: ItemRelationRow): Promise<void>`
  - `deleteItemRelationDoc(sourceId: string, relationType: string): Promise<void>`
  - `replaceItemOrder(listKey: string, orderedIds: string[]): Promise<void>`
  - `putActivityLogDoc(log: ActivityLog): Promise<void>`

  `ItemRelationRow`/`ItemOrderRow` types are the same shapes already defined in `apps/mobile/src/db/types.ts` (added earlier this session for the mobile sync-coverage work) — reused here, not redefined.

- [ ] **Step 1: Write the store**

```typescript
// apps/mobile/src/db/firestoreWebStore.ts
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import type { Item, ItemInstance, ActivityLog } from './types';
import type { ItemRelationRow, ItemOrderRow } from './types';

interface StoreState {
  items: Item[];
  itemInstances: ItemInstance[];
  itemRelations: ItemRelationRow[];
  itemOrder: ItemOrderRow[];
  activityLogs: ActivityLog[];
}

let uid: string | null = null;
let state: StoreState = { items: [], itemInstances: [], itemRelations: [], itemOrder: [], activityLogs: [] };
let unsubscribers: Unsubscribe[] = [];
const listeners = new Set<() => void>();

function requireFirestore() {
  if (!firestore) throw new Error('Firestore is not configured — check EXPO_PUBLIC_FIREBASE_* env vars');
  return firestore;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToWebStoreChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startWebStore(userId: string): void {
  if (uid === userId) return;
  stopWebStore();
  uid = userId;
  const db = requireFirestore();

  unsubscribers.push(
    onSnapshot(collection(db, 'users', userId, 'items'), (snap) => {
      state = { ...state, items: snap.docs.map((d) => d.data() as Item) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, 'users', userId, 'itemInstances'), (snap) => {
      state = { ...state, itemInstances: snap.docs.map((d) => d.data() as ItemInstance) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, 'users', userId, 'itemRelations'), (snap) => {
      state = { ...state, itemRelations: snap.docs.map((d) => d.data() as ItemRelationRow) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, 'users', userId, 'itemOrder'), (snap) => {
      state = { ...state, itemOrder: snap.docs.map((d) => d.data() as ItemOrderRow) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, 'users', userId, 'activityLogs'), (snap) => {
      state = { ...state, activityLogs: snap.docs.map((d) => d.data() as ActivityLog) };
      notify();
    })
  );
}

export function stopWebStore(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  uid = null;
  state = { items: [], itemInstances: [], itemRelations: [], itemOrder: [], activityLogs: [] };
}

function requireUid(): string {
  if (!uid) throw new Error('Web store not started — call startWebStore(userId) after sign-in');
  return uid;
}

export function getItemsSnapshot(): Item[] {
  return state.items;
}
export function getItemInstancesSnapshot(): ItemInstance[] {
  return state.itemInstances;
}
export function getItemRelationsSnapshot(): ItemRelationRow[] {
  return state.itemRelations;
}
export function getItemOrderSnapshot(): ItemOrderRow[] {
  return state.itemOrder;
}
export function getActivityLogsSnapshot(): ActivityLog[] {
  return state.activityLogs;
}

export async function putItem(item: Item): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'items', item.id), item);
}

export async function patchItem(id: string, patch: Partial<Omit<Item, 'id'>>): Promise<void> {
  const db = requireFirestore();
  await updateDoc(doc(db, 'users', requireUid(), 'items', id), patch as Record<string, unknown>);
}

export async function putItemInstance(instance: ItemInstance): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'itemInstances', instance.id), instance);
}

export async function deleteItemInstanceDoc(id: string): Promise<void> {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'users', requireUid(), 'itemInstances', id));
}

export async function putItemRelation(row: ItemRelationRow): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'itemRelations', row.id), row);
}

export async function deleteItemRelationDoc(sourceId: string, relationType: string): Promise<void> {
  const db = requireFirestore();
  const existing = state.itemRelations.find((r) => r.sourceId === sourceId && r.relationType === relationType);
  if (!existing) return;
  await deleteDoc(doc(db, 'users', requireUid(), 'itemRelations', existing.id));
}

export async function replaceItemOrder(listKey: string, orderedIds: string[]): Promise<void> {
  const db = requireFirestore();
  const uidVal = requireUid();
  const batch = writeBatch(db);
  const existingSnapshot = await getDocs(
    query(collection(db, 'users', uidVal, 'itemOrder'), where('listKey', '==', listKey))
  );
  existingSnapshot.docs.forEach((d) => batch.delete(d.ref));
  orderedIds.forEach((itemId, position) => {
    const docId = `${listKey}__${itemId}`;
    batch.set(doc(db, 'users', uidVal, 'itemOrder', docId), { listKey, itemId, position });
  });
  await batch.commit();
}

export async function putActivityLogDoc(log: ActivityLog): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'activityLogs', log.id), log);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors in `firestoreWebStore.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/firestoreWebStore.ts
git commit -m "feat(mobile): add Firestore reactive store for the web build"
```

---

## Task 4: Item CRUD (real implementation)

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot`, `getActivityLogsSnapshot`, `putItem`, `patchItem`, `putActivityLogDoc` from `./firestoreWebStore` (all already implemented in Task 3, including the `activityLogs` collection added there).
- Produces: `getInboxItems`, `getTodayItems`, `getUpcomingItems`, `getItemsByStatus`, `getItemsByType`, `getCompletedItems`, `getItemWithMetadata`, `getItemById`, `createItem`, `updateItem`, `updateItemMetadata`, `updateItemTitle`, `updateItemStatus`, `deleteItem`, `formatDate`, `uuid`, `logActivity`, `getTodayLogs` — none of these were stubbed in Task 2 (which only covered out-of-scope functions), so this task adds them fresh.

- [ ] **Step 1: Add `formatDate`, `uuid`, and the read queries**

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getItemsSnapshot, getActivityLogsSnapshot, putItem, patchItem, putActivityLogDoc } from './firestoreWebStore';
```

```typescript
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function uuid(): string {
  return uuidv4();
}

export function getInboxItems(): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === 'inbox' && i.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot().filter(
    (i) =>
      (i.scheduledDate === today || i.status === 'due-today' || i.status === 'overdue') &&
      i.deletedAt == null
  );
}

export function getUpcomingItems(fromDate: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => (i.scheduledDate ?? '') > fromDate && i.status !== 'completed' && i.deletedAt == null)
    .sort((a, b) => {
      const dateDiff = (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt - b.createdAt;
    });
}

export function getItemsByStatus(status: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === status && i.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getCompletedItems(): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.status === 'completed' && i.deletedAt == null)
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
}

export function getItemsByType(type: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.type === type && i.deletedAt == null && i.status !== 'archived')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getItemWithMetadata(id: string): Item | null {
  return getItemsSnapshot().find((i) => i.id === id) ?? null;
}

export const getItemById = getItemWithMetadata;
```

- [ ] **Step 2: Add the mutations**

```typescript
import { nextOccurrenceDate } from '../utils/repeat';

export function createItem(
  type: Item['type'],
  title: string,
  status: Item['status'] = 'inbox',
  scheduledDate?: string,
  notes?: string,
  voice_transcript?: string
): string {
  const id = uuidv4();
  const now = Date.now();
  putItem({ id, type, title, status, scheduledDate, notes, voice_transcript, createdAt: now, updatedAt: now }).catch(() => {});
  logActivity(id, 'created');
  return id;
}

export function updateItem(
  id: string,
  updates: Partial<{
    type: Item['type'];
    title: string;
    status: Item['status'];
    notes: string | null;
    scheduledDate: string | null;
    dueDate: string | null;
    rrule: string | null;
  }>
): void {
  const fields: Record<string, unknown> = {};
  if (updates.type !== undefined) fields.type = updates.type;
  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.status !== undefined) fields.status = updates.status;
  if (updates.notes !== undefined) fields.notes = updates.notes;
  if (updates.scheduledDate !== undefined) fields.scheduledDate = updates.scheduledDate;
  if (updates.dueDate !== undefined) fields.dueDate = updates.dueDate;
  if (updates.rrule !== undefined) fields.rrule = updates.rrule;
  if (Object.keys(fields).length === 0) return;
  fields.updatedAt = Date.now();
  patchItem(id, fields as Partial<Omit<Item, 'id'>>).catch(() => {});
}

export function updateItemMetadata(id: string, metadata: Record<string, any>): void {
  patchItem(id, { metadata: JSON.stringify(metadata), updatedAt: Date.now() }).catch(() => {});
}

export function updateItemTitle(id: string, title: string): void {
  patchItem(id, { title, updatedAt: Date.now() }).catch(() => {});
}

export function updateItemStatus(id: string, status: Item['status']): void {
  const now = Date.now();
  if (status === 'completed') {
    const item = getItemWithMetadata(id);
    const next = item ? nextOccurrenceDate(item.rrule, item.scheduledDate ?? formatDate(new Date())) : null;
    if (item && next) {
      patchItem(id, { scheduledDate: next, status: 'active', completedAt: null, updatedAt: now }).catch(() => {});
      logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence: item.scheduledDate, next }));
      return;
    }
  }
  patchItem(id, { status, completedAt: status === 'completed' ? now : null, updatedAt: now }).catch(() => {});
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}

export function deleteItem(id: string): void {
  patchItem(id, { deletedAt: Date.now(), updatedAt: Date.now() }).catch(() => {});
}
```

Note: unlike mobile's `db/database.ts`, these mutation functions here are `void`-returning even though the underlying Firestore write is async (`.catch(() => {})` fire-and-forget) — this matches the existing synchronous call-site convention every screen already uses (`onChange`, `refresh()` right after a call), since the in-memory store updates via the `onSnapshot` listener shortly after, triggering a re-render through `subscribeToWebStoreChanges` (wired up in Task 7).

- [ ] **Step 3: Add activity log functions**

```typescript
export function logActivity(entityId: string, actionType: string, details?: string): string {
  const id = uuidv4();
  const now = Date.now();
  putActivityLogDoc({ id, entityId, actionType, timestamp: now, details, createdAt: now }).catch(() => {});
  return id;
}

export function getTodayLogs(): ActivityLog[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getActivityLogsSnapshot()
    .filter((l) => l.timestamp >= start.getTime() && l.timestamp <= end.getTime())
    .sort((a, b) => b.timestamp - a.timestamp);
}
```

- [ ] **Step 4: Remove the now-superseded stubs for these functions if Task 2 accidentally included any**

Task 2's stub list deliberately excluded all of these names — confirm none of them appear twice in the file (would be a duplicate-export TypeScript error, easy to catch via the typecheck in the next step).

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/database.web.ts apps/mobile/src/db/firestoreWebStore.ts
git commit -m "feat(mobile): implement item CRUD in database.web.ts"
```

---

## Task 5: Relations & manual order (real implementation)

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot`, `getItemRelationsSnapshot`, `getItemOrderSnapshot`, `putItemRelation`, `deleteItemRelationDoc`, `replaceItemOrder` from `./firestoreWebStore`.
- Produces: replaces the (not-yet-existing) `setRelation`, `getRelation`, `getBlockingTask`, `setManualOrder`, `applyManualOrder`, `getRelatedItems`, `countRelated`, `getProjectItemCount`, `getAreaProjectCount`, `getProjectsForArea`.

- [ ] **Step 1: Implement**

```typescript
import type { ItemRelationRow } from './types';
import { getItemRelationsSnapshot, getItemOrderSnapshot, putItemRelation, deleteItemRelationDoc, replaceItemOrder } from './firestoreWebStore';

export function setRelation(sourceId: string, relationType: string, targetId: string | null): void {
  if (targetId === null) {
    deleteItemRelationDoc(sourceId, relationType).catch(() => {});
    return;
  }
  const existing = getItemRelationsSnapshot().find((r) => r.sourceId === sourceId && r.relationType === relationType);
  const row: ItemRelationRow = {
    id: existing?.id ?? uuidv4(),
    sourceId,
    targetId,
    relationType,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  putItemRelation(row).catch(() => {});
}

export function getRelation(sourceId: string, relationType: string): string | null {
  return getItemRelationsSnapshot().find((r) => r.sourceId === sourceId && r.relationType === relationType)?.targetId ?? null;
}

export function getBlockingTask(itemId: string): Item | null {
  const dependsOnId = getRelation(itemId, 'dependsOn');
  if (!dependsOnId) return null;
  const blocker = getItemWithMetadata(dependsOnId);
  if (!blocker || blocker.status === 'completed' || blocker.deletedAt) return null;
  return blocker;
}

export function setManualOrder(listKey: string, orderedIds: string[]): void {
  replaceItemOrder(listKey, orderedIds).catch(() => {});
}

export function applyManualOrder<T extends { id: string }>(listKey: string, items: T[]): T[] {
  const rows = getItemOrderSnapshot().filter((r) => r.listKey === listKey);
  if (rows.length === 0) return items;
  const positions = new Map(rows.map((r) => [r.itemId, r.position]));
  return [...items].sort((a, b) => {
    const posA = positions.get(a.id);
    const posB = positions.get(b.id);
    if (posA === undefined && posB === undefined) return 0;
    if (posA === undefined) return 1;
    if (posB === undefined) return -1;
    return posA - posB;
  });
}

export function getRelatedItems(targetId: string, relationType: string): Item[] {
  const sourceIds = new Set(
    getItemRelationsSnapshot()
      .filter((r) => r.targetId === targetId && r.relationType === relationType)
      .map((r) => r.sourceId)
  );
  return getItemsSnapshot()
    .filter((i) => sourceIds.has(i.id) && i.deletedAt == null && i.status !== 'completed' && i.status !== 'archived')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function countRelated(targetId: string, relationType: string): number {
  return getRelatedItems(targetId, relationType).length;
}

export function getProjectItemCount(projectId: string): number {
  return countRelated(projectId, 'project');
}

export function getAreaProjectCount(areaId: string): number {
  return countRelated(areaId, 'area');
}

export function getProjectsForArea(areaId: string): Item[] {
  return getRelatedItems(areaId, 'area');
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement relations and manual order in database.web.ts"
```

---

## Task 6: Today-planning (real implementation)

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot` from `./firestoreWebStore`; `parseRepeatRule`, `dayMatchesRepeat` from `../utils/repeat` (existing, unchanged, already imported for `nextOccurrenceDate` in Task 4 — add these two names to that same import).
- Produces: `planForToday`, `unplanToday`, `getPlannedTodayItems`, `getRepeatingItemsForToday`, `isPlannedForToday`.

- [ ] **Step 1: Implement**

```typescript
import { nextOccurrenceDate, parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';

export function planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  updateItemMetadata(itemId, meta);
}

export function unplanToday(itemId: string): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  delete meta.plannedDate;
  if (meta.preferredTimeBucket && meta.preferredTimeBucket !== 'anytime') {
    meta.preferredTimeBucket = 'anytime';
  }
  updateItemMetadata(itemId, meta);
}

export function getPlannedTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot().filter(
    (i) =>
      i.type === 'task' &&
      i.status !== 'completed' &&
      i.status !== 'inbox' &&
      i.deletedAt == null &&
      (i.metadata ?? '').includes(`"plannedDate":"${today}"`)
  );
}

export function getRepeatingItemsForToday(): Item[] {
  const today = formatDate(new Date());
  return getItemsSnapshot()
    .filter(
      (i) =>
        i.rrule != null &&
        i.rrule !== '' &&
        i.type === 'task' &&
        i.status !== 'completed' &&
        i.status !== 'inbox' &&
        i.deletedAt == null
    )
    .filter((item) => {
      const rule = parseRepeatRule(item.rrule);
      return rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false;
    });
}

export function isPlannedForToday(item: Item): boolean {
  if (!item.metadata) return false;
  try {
    return (JSON.parse(item.metadata) as { plannedDate?: string }).plannedDate === formatDate(new Date());
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement today-planning helpers in database.web.ts"
```

---

## Task 7: Wire sign-in to start the store, and verify screens in the browser

**Files:**
- Modify: wherever the app currently signs the user in / gates on auth state (`apps/mobile/src/hooks/useBackup.ts` or equivalent — check `onAuthStateChanged` usage) to also call `startWebStore(uid)` on web when the user signs in, and `stopWebStore()` on sign-out.
- Modify: `apps/mobile/src/hooks/useDb.ts` — each hook's `refresh()` should also run when the web store notifies a change, so screens update live without manual navigation. Add `useEffect(() => subscribeToWebStoreChanges(refresh), [refresh])` alongside each hook's existing mount-time `useEffect`. Guard this so it's a no-op on native (the mobile app's own `firestoreSync.ts` listener already triggers `onLocalChange` differently — check how that's currently wired to hooks, if at all, and match the same pattern rather than inventing a second one).

**Interfaces:**
- Consumes: `startWebStore`, `stopWebStore`, `subscribeToWebStoreChanges` from `../db/firestoreWebStore` (this import itself should be conditional/platform-safe — since `firestoreWebStore.ts` has no `.web.ts` suffix, it's bundled on both platforms; either give it a `.web.ts`-suffixed counterpart that's a no-op, or gate the call sites with `Platform.OS === 'web'`. Simplest: rename `firestoreWebStore.ts`'s call sites in `useBackup.ts`/`useDb.ts` behind `if (Platform.OS === 'web') { ... }` checks rather than restructuring the module itself, since it's only ever meaningfully imported by `database.web.ts` otherwise.)

- [ ] **Step 1: Find and inspect the current sign-in wiring**

Run: `grep -n "onAuthStateChanged\|startRealtimeSync" apps/mobile/src/hooks/useBackup.ts`

- [ ] **Step 2: Wire `startWebStore`/`stopWebStore` alongside the existing mobile sync start/stop, gated by platform**

Exact code depends on Step 1's findings — add `import { Platform } from 'react-native';` and `import { startWebStore, stopWebStore } from '../db/firestoreWebStore';`, then call `if (Platform.OS === 'web') startWebStore(nextUser.uid); else startRealtimeSync(nextUser.uid);` (and the equivalent stop pairing) in place of the current unconditional `startRealtimeSync`/`stopRealtimeSync` calls.

- [ ] **Step 3: Wire hook refresh to store changes on web**

In `apps/mobile/src/hooks/useDb.ts`, for `useInbox`, `useHomeData`, `useItems`, `useTasks`, `useProjects`, `useAreas`, `useCompletedItems` (the hooks Core GTD screens use), add:

```typescript
import { Platform } from 'react-native';
import { subscribeToWebStoreChanges } from '../db/firestoreWebStore';

// inside each hook, alongside the existing `useEffect(() => { refresh(); }, [refresh]);`
useEffect(() => {
  if (Platform.OS !== 'web') return;
  return subscribeToWebStoreChanges(refresh);
}, [refresh]);
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification in a browser**

Start the dev server (`npm run web`) and use the browser preview tools to check, signed in as the same account used earlier this session:

- Inbox screen loads and shows the same items visible on mobile.
- Create a new item from the web Inbox — confirm it appears (check Firestore directly via the Firebase CLI token technique used earlier this session, or just check it shows up on the mobile app too).
- Complete a task — confirm status updates live in the UI.
- Assign a task to a Project on the Areas/Projects screens — confirm the relation shows correctly.
- Drag-reorder a list (if reachable/functional in the web build — react-native-draggable-flatlist's web support is unverified; note this as a known risk rather than blocking on it).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/useBackup.ts apps/mobile/src/hooks/useDb.ts
git commit -m "feat(mobile): start the web Firestore store on sign-in and wire live refresh"
```

---

## What this plan does not do (by design)

- Calendar/timeline screens and GTD triage (`processInboxItem`, `applyTaskTriage`) stay stubbed — Plan 2.
- Medications, workouts, voice capture, and other out-of-scope features stay stubbed indefinitely (no committed plan yet).
- Tauri/Mac wrapping — separate sub-project once the web build works end-to-end.
- Deep native-dependency auditing of out-of-scope screens (Task 1 only fixes what blocks *booting*, not every screen rendering correctly).
