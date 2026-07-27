# Firestore Core Items Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Firestore-backed replacement for the "core items" subsystem (item CRUD, relations/manual-order, today-planning, activity logs) as new, independently-tested code that does not yet touch the running app — establishing the pattern (store, converters, emulator test harness) that Plans 2 (medications) and 3 (calendar/triage/instances + final cutover) will reuse.

**Architecture:** One `onSnapshot` listener per collection (`items`, `activityLogs`, `itemRelations`, `itemOrder`) mirrors each user's Firestore data into an in-memory array held by `db/firestore/store.ts`. Every ported function is a plain JS `.filter()`/`.sort()`/`.find()` over these arrays — a mechanical translation of the existing SQL predicates in `db/database.ts`, not a redesign. Writes go straight to Firestore via `setDoc`/`updateDoc`/`writeBatch`; the listener flows the result back into the in-memory array automatically, so no function needs to manually update local state after a write.

**Tech Stack:** `firebase/firestore` (already a dependency, v12.16.0), `firebase-tools` + `@firebase/rules-unit-testing` (new, for emulator-backed tests), existing `node --test` runner.

## Global Constraints

- `metadata` (and `details`/`instanceMetadata` elsewhere) stay JSON **strings** in Firestore documents, exactly as in SQLite today — every existing call site already does `JSON.parse`/`JSON.stringify` explicitly, so keeping the wire format as a string means zero changes to that logic anywhere in the app. (This is a deliberate deviation from the original design doc's "native map" suggestion, made after discovering the in-memory-filter query strategy removes any benefit of native Firestore field types — see chat history 2026-07-27.)
- Item IDs are Firestore document IDs (`setDoc(doc(collection, item.id), ...)`), not auto-generated — matches SQLite's `id TEXT PRIMARY KEY` and keeps writes idempotent.
- `itemRelations` doc ID is `${sourceId}__${relationType}`; `itemOrder` doc ID is `${listKey}__${itemId}` — replaces SQL's `UNIQUE`/composite-primary-key constraints with deterministic Firestore doc IDs (upsert via `setDoc` instead of `INSERT ... ON CONFLICT`).
- No composite Firestore indexes are needed in this plan — every read is "fetch the whole collection, filter in JS," not a targeted `where`/`orderBy` query.
- This plan does **not** wire any of this into `db/database.ts`, `hooks/useDb.ts`, or any screen. The new code lives entirely under `apps/mobile/src/db/firestore/` and is verified via its own test suite against the Firestore emulator. Cutover happens in a later plan once medications, calendar/triage, and instances are also ported.
- Follow existing code style: no comments unless the WHY is non-obvious (see `apps/mobile/CLAUDE.md`).

---

## File Structure

**Create:**
- `apps/mobile/src/db/firestore/types.ts` — `ItemRelationRow`, `ItemOrderRow` interfaces (kept separate from `store.ts`/`converters.ts` to avoid circular imports between them)
- `apps/mobile/src/db/firestore/converters.ts` — `FirestoreDataConverter` for `Item`, `ActivityLog`, `ItemRelationRow`, `ItemOrderRow`
- `apps/mobile/src/db/firestore/store.ts` — the live in-memory mirror: `startFirestoreStore(uid)`, `stopFirestoreStore()`, snapshot getters, `subscribeToStoreChanges(listener)`, and the low-level write helpers (`putItem`, `patchItem`, `putActivityLog`, `putItemRelation`, `deleteItemRelation`, `replaceItemOrder`)
- `apps/mobile/src/db/firestore/itemsCore.ts` — ported item read queries + mutations (mirrors `db/database.ts`'s `── Items ──` section)
- `apps/mobile/src/db/firestore/relations.ts` — ported relations/manual-order functions
- `apps/mobile/src/db/firestore/todayPlanning.ts` — ported today-planning functions
- `apps/mobile/src/db/firestore/activityLog.ts` — `logActivity`, `getTodayLogs`
- `apps/mobile/src/db/firestore/testEnv.ts` — shared emulator connection helper for tests
- Test files (one per module above, e.g. `itemsCore.test.ts`), all under `apps/mobile/src/db/firestore/`

**Modify:**
- `apps/mobile/src/lib/firebase.ts` — switch to `initializeFirestore` with persistent local cache
- `firebase/firestore.rules` — add rules for `items`, `activityLogs`, `itemRelations`, `itemOrder` under `users/{uid}/...`
- `firebase.json` — add a `firestore` emulator block (fixed port)
- `apps/mobile/package.json` — add `firebase-tools`, `@firebase/rules-unit-testing` devDependencies; add a `test:firestore` script

---

## Task 1: Firestore emulator test harness

**Files:**
- Create: `apps/mobile/src/db/firestore/testEnv.ts`
- Modify: `firebase.json`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Produces: `connectToEmulator(): void` — idempotent, connects the shared `firestore` singleton from `lib/firebase.ts` to the local emulator. Every test file in this plan calls this once at the top before any Firestore call.

- [ ] **Step 1: Add the Firestore emulator to `firebase.json`**

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "port": 8090
    }
  }
}
```

- [ ] **Step 2: Add emulator devDependencies and a test script**

In `apps/mobile/package.json`, add to `devDependencies`:

```json
"@firebase/rules-unit-testing": "^4.0.1",
"firebase-tools": "^13.29.1"
```

Add to `scripts`:

```json
"test:firestore": "EXPO_PUBLIC_FIREBASE_API_KEY=demo-key EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-rka-os EXPO_PUBLIC_FIREBASE_APP_ID=demo-app-id firebase emulators:exec --project demo-rka-os --only firestore \"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/db/firestore/**/*.test.ts\""
```

Run: `cd apps/mobile && npm install`
Expected: `firebase-tools` and `@firebase/rules-unit-testing` install cleanly.

- [ ] **Step 3: Write the emulator connection helper**

```typescript
// apps/mobile/src/db/firestore/testEnv.ts
import { connectFirestoreEmulator } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

let connected = false;

export function connectToEmulator(): void {
  if (connected) return;
  if (!firestore) throw new Error('Firestore not configured — set EXPO_PUBLIC_FIREBASE_* env vars');
  connectFirestoreEmulator(firestore, '127.0.0.1', 8090);
  connected = true;
}
```

- [ ] **Step 4: Verify the emulator boots and the helper connects without throwing**

Create a throwaway smoke test to confirm the harness works before building real modules on top of it:

```typescript
// apps/mobile/src/db/firestore/testEnv.smoke.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { connectToEmulator } from './testEnv';

connectToEmulator();

test('emulator round-trips a write', async () => {
  const ref = doc(firestore!, 'smoke/ping');
  await setDoc(ref, { value: 1 });
  const snap = await getDoc(ref);
  assert.equal(snap.data()?.value, 1);
});
```

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 1`

- [ ] **Step 5: Delete the smoke test and commit the harness**

```bash
rm apps/mobile/src/db/firestore/testEnv.smoke.test.ts
git add apps/mobile/package.json apps/mobile/package-lock.json firebase.json apps/mobile/src/db/firestore/testEnv.ts
git commit -m "chore(mobile): add Firestore emulator test harness"
```

---

## Task 2: Persistent local cache config

**Files:**
- Modify: `apps/mobile/src/lib/firebase.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: same exports as today (`app`, `auth`, `firestore`, `hasFirebaseConfig`) — no signature change, only how `firestore` is constructed.

- [ ] **Step 1: Switch `getFirestore` to `initializeFirestore` with persistent cache**

Replace the current `firestore` initialization:

```typescript
import { getFirestore, type Firestore } from 'firebase/firestore';
...
firestore = getFirestore(app);
```

with:

```typescript
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
...
firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  ignoreUndefinedProperties: true,
});
```

`ignoreUndefinedProperties` matters here: `createItem` (Task 7) writes items with optional fields like `scheduledDate`/`notes` left as `undefined` when not provided, matching how the SQLite version leaves those columns unset — without this setting, `setDoc`/`updateDoc` throw on any `undefined` field value.

- [ ] **Step 2: Verify the app still boots**

Run: `cd apps/mobile && npx expo start --dev-client --port 8082`, open the app on device, confirm no crash on launch and existing screens (which still read SQLite at this point) render normally.
Expected: app boots exactly as before — this task only changes how the Firestore client initializes, nothing reads through it yet.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/firebase.ts
git commit -m "feat(mobile): enable Firestore persistent local cache"
```

---

## Task 3: Firestore security rules for the core-items collections

**Files:**
- Modify: `firebase/firestore.rules`

**Interfaces:**
- Produces: read/write access scoped to `users/{uid}/items/*`, `users/{uid}/activityLogs/*`, `users/{uid}/itemRelations/*`, `users/{uid}/itemOrder/*`, restricted to the signed-in owner.

- [ ] **Step 1: Add the new rules alongside the existing `backups` rule**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /backups/{backupId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    match /users/{userId}/{collection}/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId
        && collection in ['items', 'activityLogs', 'itemRelations', 'itemOrder'];
    }
  }
}
```

- [ ] **Step 2: Write a rules test confirming isolation**

```typescript
// apps/mobile/src/db/firestore/rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-rka-os',
  firestore: {
    rules: fs.readFileSync(path.resolve(process.cwd(), '../../firebase/firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8090,
  },
});

test('a user can write their own item', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(alice.doc('users/alice/items/item-1').set({ title: 'Test' }));
});

test('a user cannot write another user\'s item', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertFails(alice.doc('users/bob/items/item-1').set({ title: 'Test' }));
});

test('a signed-out client cannot write', async () => {
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(anon.doc('users/alice/items/item-1').set({ title: 'Test' }));
});
```

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 3`

- [ ] **Step 3: Commit**

```bash
git add firebase/firestore.rules apps/mobile/src/db/firestore/rules.test.ts
git commit -m "feat: scope Firestore rules to core-items collections"
```

---

## Task 4: Types and converters

**Files:**
- Create: `apps/mobile/src/db/firestore/types.ts`
- Create: `apps/mobile/src/db/firestore/converters.ts`

**Interfaces:**
- Produces: `ItemRelationRow`, `ItemOrderRow` (types.ts); `itemConverter`, `activityLogConverter`, `itemRelationConverter`, `itemOrderConverter` — each a `FirestoreDataConverter<T>` (converters.ts). Consumed by `store.ts` in Task 5.

- [ ] **Step 1: Write the row types**

```typescript
// apps/mobile/src/db/firestore/types.ts
export interface ItemRelationRow {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: number;
}

export interface ItemOrderRow {
  listKey: string;
  itemId: string;
  position: number;
}
```

- [ ] **Step 2: Write the converters**

Each converter's `toFirestore` strips the `id` field (it's already the document ID) and `fromFirestore` re-attaches it from `snapshot.id`, matching how SQLite rows carry `id` as a column but Firestore treats it as document identity.

```typescript
// apps/mobile/src/db/firestore/converters.ts
import type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import type { Item, ActivityLog } from '../types';
import type { ItemRelationRow, ItemOrderRow } from './types';

export const itemConverter: FirestoreDataConverter<Item> = {
  toFirestore(item: Item) {
    const { id, ...rest } = item;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
    const data = snapshot.data(options);
    return { id: snapshot.id, ...data } as Item;
  },
};

export const activityLogConverter: FirestoreDataConverter<ActivityLog> = {
  toFirestore(log: ActivityLog) {
    const { id, ...rest } = log;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
    const data = snapshot.data(options);
    return { id: snapshot.id, ...data } as ActivityLog;
  },
};

export const itemRelationConverter: FirestoreDataConverter<ItemRelationRow> = {
  toFirestore(row: ItemRelationRow) {
    const { id, ...rest } = row;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
    const data = snapshot.data(options);
    return { id: snapshot.id, ...data } as ItemRelationRow;
  },
};

export const itemOrderConverter: FirestoreDataConverter<ItemOrderRow> = {
  toFirestore(row: ItemOrderRow) {
    return { listKey: row.listKey, itemId: row.itemId, position: row.position };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
    const data = snapshot.data(options);
    return { listKey: data.listKey, itemId: data.itemId, position: data.position } as ItemOrderRow;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/db/firestore/types.ts apps/mobile/src/db/firestore/converters.ts
git commit -m "feat(mobile): add Firestore converters for core-items collections"
```

(No standalone test for this task — converters are exercised end-to-end by Task 5's store tests.)

---

## Task 5: The reactive store

**Files:**
- Create: `apps/mobile/src/db/firestore/store.ts`
- Test: `apps/mobile/src/db/firestore/store.test.ts`

**Interfaces:**
- Consumes: `itemConverter`, `activityLogConverter`, `itemRelationConverter`, `itemOrderConverter` from `./converters`; `ItemRelationRow`, `ItemOrderRow` from `./types`; `firestore` from `../../lib/firebase`.
- Produces:
  - `startFirestoreStore(uid: string): void`
  - `stopFirestoreStore(): void`
  - `subscribeToStoreChanges(listener: () => void): () => void`
  - `getItemsSnapshot(): Item[]`
  - `getActivityLogsSnapshot(): ActivityLog[]`
  - `getItemRelationsSnapshot(): ItemRelationRow[]`
  - `getItemOrderSnapshot(): ItemOrderRow[]`
  - `putItem(item: Item): Promise<void>`
  - `patchItem(id: string, patch: Partial<Omit<Item, 'id'>>): Promise<void>`
  - `putActivityLog(log: ActivityLog): Promise<void>`
  - `putItemRelation(row: ItemRelationRow): Promise<void>`
  - `deleteItemRelation(sourceId: string, relationType: string): Promise<void>`
  - `replaceItemOrder(listKey: string, orderedIds: string[]): Promise<void>`

  All consumed by Tasks 6–8's ported functions.

- [ ] **Step 1: Write the failing test for start/stop + snapshot getters**

```typescript
// apps/mobile/src/db/firestore/store.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import {
  startFirestoreStore,
  stopFirestoreStore,
  getItemsSnapshot,
  putItem,
} from './store';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('putItem flows through the listener into getItemsSnapshot', async () => {
  startFirestoreStore('store-test-user');
  await putItem({
    id: 'item-1',
    type: 'task',
    title: 'Buy milk',
    status: 'inbox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await waitFor(() => getItemsSnapshot().some((i) => i.id === 'item-1'));
  assert.equal(getItemsSnapshot().find((i) => i.id === 'item-1')?.title, 'Buy milk');
  stopFirestoreStore();
});

test('stopFirestoreStore clears the in-memory mirror', async () => {
  startFirestoreStore('store-test-user-2');
  await putItem({
    id: 'item-2',
    type: 'task',
    title: 'Walk dog',
    status: 'inbox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await waitFor(() => getItemsSnapshot().length > 0);
  stopFirestoreStore();
  assert.deepEqual(getItemsSnapshot(), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `store.ts` does not exist yet (module not found).

- [ ] **Step 3: Implement the store**

```typescript
// apps/mobile/src/db/firestore/store.ts
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import type { Item, ActivityLog } from '../types';
import type { ItemRelationRow, ItemOrderRow } from './types';
import {
  itemConverter,
  activityLogConverter,
  itemRelationConverter,
  itemOrderConverter,
} from './converters';

interface StoreState {
  items: Item[];
  activityLogs: ActivityLog[];
  itemRelations: ItemRelationRow[];
  itemOrder: ItemOrderRow[];
}

let uid: string | null = null;
let state: StoreState = { items: [], activityLogs: [], itemRelations: [], itemOrder: [] };
let unsubscribers: Unsubscribe[] = [];
const listeners = new Set<() => void>();

function requireFirestore() {
  if (!firestore) throw new Error('Firestore is not configured — check EXPO_PUBLIC_FIREBASE_* env vars');
  return firestore;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToStoreChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startFirestoreStore(userId: string): void {
  if (uid === userId) return;
  stopFirestoreStore();
  uid = userId;
  const db = requireFirestore();

  unsubscribers.push(
    onSnapshot(collection(db, `users/${userId}/items`).withConverter(itemConverter), (snap) => {
      state = { ...state, items: snap.docs.map((d) => d.data()) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, `users/${userId}/activityLogs`).withConverter(activityLogConverter), (snap) => {
      state = { ...state, activityLogs: snap.docs.map((d) => d.data()) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, `users/${userId}/itemRelations`).withConverter(itemRelationConverter), (snap) => {
      state = { ...state, itemRelations: snap.docs.map((d) => d.data()) };
      notify();
    })
  );
  unsubscribers.push(
    onSnapshot(collection(db, `users/${userId}/itemOrder`).withConverter(itemOrderConverter), (snap) => {
      state = { ...state, itemOrder: snap.docs.map((d) => d.data()) };
      notify();
    })
  );
}

export function stopFirestoreStore(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  uid = null;
  state = { items: [], activityLogs: [], itemRelations: [], itemOrder: [] };
}

function requireUid(): string {
  if (!uid) throw new Error('Firestore store not started — call startFirestoreStore(userId) after sign-in');
  return uid;
}

export function getItemsSnapshot(): Item[] {
  return state.items;
}
export function getActivityLogsSnapshot(): ActivityLog[] {
  return state.activityLogs;
}
export function getItemRelationsSnapshot(): ItemRelationRow[] {
  return state.itemRelations;
}
export function getItemOrderSnapshot(): ItemOrderRow[] {
  return state.itemOrder;
}

export async function putItem(item: Item): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, `users/${requireUid()}/items/${item.id}`).withConverter(itemConverter), item);
}

export async function patchItem(id: string, patch: Partial<Omit<Item, 'id'>>): Promise<void> {
  const db = requireFirestore();
  await updateDoc(doc(db, `users/${requireUid()}/items/${id}`), patch as Record<string, unknown>);
}

export async function putActivityLog(log: ActivityLog): Promise<void> {
  const db = requireFirestore();
  await setDoc(
    doc(db, `users/${requireUid()}/activityLogs/${log.id}`).withConverter(activityLogConverter),
    log
  );
}

export async function putItemRelation(row: ItemRelationRow): Promise<void> {
  const db = requireFirestore();
  const docId = `${row.sourceId}__${row.relationType}`;
  await setDoc(
    doc(db, `users/${requireUid()}/itemRelations/${docId}`).withConverter(itemRelationConverter),
    row
  );
}

export async function deleteItemRelation(sourceId: string, relationType: string): Promise<void> {
  const db = requireFirestore();
  const docId = `${sourceId}__${relationType}`;
  await deleteDoc(doc(db, `users/${requireUid()}/itemRelations/${docId}`));
}

export async function replaceItemOrder(listKey: string, orderedIds: string[]): Promise<void> {
  const db = requireFirestore();
  const uidVal = requireUid();
  const batch = writeBatch(db);
  for (const row of state.itemOrder.filter((r) => r.listKey === listKey)) {
    batch.delete(doc(db, `users/${uidVal}/itemOrder/${row.listKey}__${row.itemId}`));
  }
  orderedIds.forEach((itemId, position) => {
    batch.set(
      doc(db, `users/${uidVal}/itemOrder/${listKey}__${itemId}`).withConverter(itemOrderConverter),
      { listKey, itemId, position }
    );
  });
  await batch.commit();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 2`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/store.ts apps/mobile/src/db/firestore/store.test.ts
git commit -m "feat(mobile): add Firestore reactive store for core items"
```

---

## Task 6: Item read queries

**Files:**
- Create: `apps/mobile/src/db/firestore/itemsCore.ts`
- Test: `apps/mobile/src/db/firestore/itemsCore.test.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot`, `putItem` from `./store`; `formatDate` (copy the existing pure helper, see Step 1).
- Produces: `getInboxItems()`, `getTodayItems()`, `getUpcomingItems(fromDate)`, `getItemsByStatus(status)`, `getCompletedItems()`, `getItemsByType(type)`, `getItemWithMetadata(id)` — all synchronous, same signatures as `db/database.ts` today. Consumed by Task 7 (mutations) and later plans.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/db/firestore/itemsCore.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import { startFirestoreStore, stopFirestoreStore, putItem } from './store';
import {
  getInboxItems,
  getTodayItems,
  getUpcomingItems,
  getItemsByStatus,
  getCompletedItems,
  getItemsByType,
  getItemWithMetadata,
  formatDate,
} from './itemsCore';
import type { Item } from '../types';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

function baseItem(overrides: Partial<Item>): Item {
  const now = Date.now();
  return {
    id: overrides.id ?? 'item',
    type: 'task',
    title: 'Untitled',
    status: 'inbox',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('getInboxItems returns only inbox, non-deleted items, newest first', async () => {
  startFirestoreStore('items-core-test-1');
  await putItem(baseItem({ id: 'a', status: 'inbox', createdAt: 1 }));
  await putItem(baseItem({ id: 'b', status: 'inbox', createdAt: 2 }));
  await putItem(baseItem({ id: 'c', status: 'active' }));
  await putItem(baseItem({ id: 'd', status: 'inbox', deletedAt: Date.now() }));
  await waitFor(() => getInboxItems().length === 2);
  assert.deepEqual(getInboxItems().map((i) => i.id), ['b', 'a']);
  stopFirestoreStore();
});

test('getTodayItems matches scheduledDate=today or due-today/overdue', async () => {
  startFirestoreStore('items-core-test-2');
  const today = formatDate(new Date());
  await putItem(baseItem({ id: 'a', scheduledDate: today }));
  await putItem(baseItem({ id: 'b', status: 'overdue' }));
  await putItem(baseItem({ id: 'c', scheduledDate: '2000-01-01' }));
  await waitFor(() => getItemsSnapshotLength(3));
  const ids = getTodayItems().map((i) => i.id).sort();
  assert.deepEqual(ids, ['a', 'b']);
  stopFirestoreStore();

  function getItemsSnapshotLength(n: number): boolean {
    return getInboxItems().length + getTodayItems().length + getItemsByType('task').length >= 0 && true && n >= 0;
  }
});

test('getUpcomingItems excludes completed and sorts by date then createdAt', async () => {
  startFirestoreStore('items-core-test-3');
  await putItem(baseItem({ id: 'a', scheduledDate: '2030-01-02', createdAt: 1 }));
  await putItem(baseItem({ id: 'b', scheduledDate: '2030-01-01', createdAt: 2 }));
  await putItem(baseItem({ id: 'c', scheduledDate: '2030-01-02', status: 'completed' }));
  await waitFor(() => getUpcomingItems('2020-01-01').length === 2);
  assert.deepEqual(getUpcomingItems('2020-01-01').map((i) => i.id), ['b', 'a']);
  stopFirestoreStore();
});

test('getItemsByStatus filters by exact status', async () => {
  startFirestoreStore('items-core-test-4');
  await putItem(baseItem({ id: 'a', status: 'active' }));
  await putItem(baseItem({ id: 'b', status: 'someday' }));
  await waitFor(() => getItemsByStatus('active').length === 1);
  assert.equal(getItemsByStatus('active')[0].id, 'a');
  stopFirestoreStore();
});

test('getCompletedItems sorts by completedAt falling back to updatedAt', async () => {
  startFirestoreStore('items-core-test-5');
  await putItem(baseItem({ id: 'a', status: 'completed', completedAt: 100, updatedAt: 999 }));
  await putItem(baseItem({ id: 'b', status: 'completed', updatedAt: 200 }));
  await waitFor(() => getCompletedItems().length === 2);
  assert.deepEqual(getCompletedItems().map((i) => i.id), ['b', 'a']);
  stopFirestoreStore();
});

test('getItemsByType excludes archived and deleted', async () => {
  startFirestoreStore('items-core-test-6');
  await putItem(baseItem({ id: 'a', type: 'project' }));
  await putItem(baseItem({ id: 'b', type: 'project', status: 'archived' }));
  await waitFor(() => getItemsByType('project').length === 1);
  assert.equal(getItemsByType('project')[0].id, 'a');
  stopFirestoreStore();
});

test('getItemWithMetadata finds by id or returns null', async () => {
  startFirestoreStore('items-core-test-7');
  await putItem(baseItem({ id: 'a' }));
  await waitFor(() => getItemWithMetadata('a') !== null);
  assert.equal(getItemWithMetadata('a')?.id, 'a');
  assert.equal(getItemWithMetadata('missing'), null);
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `itemsCore.ts` does not exist yet.

- [ ] **Step 3: Implement the read queries**

```typescript
// apps/mobile/src/db/firestore/itemsCore.ts
import type { Item } from '../types';
import { getItemsSnapshot } from './store';

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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
```

- [ ] **Step 4: Fix the flawed `getTodayItems` test helper and rerun**

The `getItemsSnapshotLength` helper in Step 1's second test is a placeholder that doesn't actually wait for the right condition — replace it with a direct wait on the query under test:

```typescript
test('getTodayItems matches scheduledDate=today or due-today/overdue', async () => {
  startFirestoreStore('items-core-test-2');
  const today = formatDate(new Date());
  await putItem(baseItem({ id: 'a', scheduledDate: today }));
  await putItem(baseItem({ id: 'b', status: 'overdue' }));
  await putItem(baseItem({ id: 'c', scheduledDate: '2000-01-01' }));
  await waitFor(() => getTodayItems().length === 2);
  const ids = getTodayItems().map((i) => i.id).sort();
  assert.deepEqual(ids, ['a', 'b']);
  stopFirestoreStore();
});
```

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 7`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/itemsCore.ts apps/mobile/src/db/firestore/itemsCore.test.ts
git commit -m "feat(mobile): port item read queries to Firestore store"
```

---

## Task 7: Item mutations

**Files:**
- Modify: `apps/mobile/src/db/firestore/itemsCore.ts`
- Modify: `apps/mobile/src/db/firestore/itemsCore.test.ts`

**Interfaces:**
- Consumes: `putItem`, `patchItem`, `getItemsSnapshot` from `./store`; `putActivityLog` from `./store` (via Task 8's `logActivity`, imported here); `nextOccurrenceDate` from `../../utils/repeat` (existing, unchanged).
- Produces: `createItem(type, title, status?, scheduledDate?, notes?, voice_transcript?): Promise<string>`, `updateItem(id, updates): Promise<void>`, `updateItemMetadata(id, metadata): Promise<void>`, `updateItemTitle(id, title): Promise<void>`, `updateItemStatus(id, status): Promise<void>`, `deleteItem(id): Promise<void>`.

  **Note the signature change from `db/database.ts`:** every mutation here returns a `Promise` (Firestore writes are async), where the SQLite originals were synchronous `void`/`string`. This is intentional and expected — callers are updated when this module is wired in during the cutover plan, not here.

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/src/db/firestore/itemsCore.test.ts`:

```typescript
import { createItem, updateItem, updateItemMetadata, updateItemTitle, updateItemStatus, deleteItem } from './itemsCore';
import { getActivityLogsSnapshot } from './store';

test('createItem writes the item and logs a "created" activity', async () => {
  startFirestoreStore('items-core-test-8');
  const id = await createItem('task', 'New task', 'inbox');
  await waitFor(() => getItemWithMetadata(id) !== null);
  assert.equal(getItemWithMetadata(id)?.title, 'New task');
  await waitFor(() => getActivityLogsSnapshot().some((l) => l.entityId === id && l.actionType === 'created'));
  stopFirestoreStore();
});

test('updateItem only touches fields that are not undefined, and clears fields set to null', async () => {
  startFirestoreStore('items-core-test-9');
  const id = await createItem('task', 'Task', 'inbox', '2030-01-01', 'note');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItem(id, { title: 'Renamed', scheduledDate: null });
  await waitFor(() => getItemWithMetadata(id)?.title === 'Renamed');
  const updated = getItemWithMetadata(id)!;
  assert.equal(updated.title, 'Renamed');
  assert.equal(updated.scheduledDate, null);
  assert.equal(updated.notes, 'note');
  stopFirestoreStore();
});

test('updateItemMetadata stores a JSON string', async () => {
  startFirestoreStore('items-core-test-10');
  const id = await createItem('task', 'Task');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItemMetadata(id, { plannedDate: '2030-01-01' });
  await waitFor(() => getItemWithMetadata(id)?.metadata != null);
  assert.equal(getItemWithMetadata(id)?.metadata, JSON.stringify({ plannedDate: '2030-01-01' }));
  stopFirestoreStore();
});

test('updateItemTitle updates the title only', async () => {
  startFirestoreStore('items-core-test-11');
  const id = await createItem('task', 'Old title');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItemTitle(id, 'New title');
  await waitFor(() => getItemWithMetadata(id)?.title === 'New title');
  stopFirestoreStore();
});

test('updateItemStatus rolls a repeating task forward instead of completing it', async () => {
  startFirestoreStore('items-core-test-12');
  const id = await createItem('task', 'Daily task', 'active', '2030-01-01');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItem(id, { rrule: 'FREQ=DAILY' });
  await waitFor(() => getItemWithMetadata(id)?.rrule === 'FREQ=DAILY');
  await updateItemStatus(id, 'completed');
  await waitFor(() => getItemWithMetadata(id)?.status === 'active');
  const rolled = getItemWithMetadata(id)!;
  assert.equal(rolled.status, 'active');
  assert.equal(rolled.scheduledDate, '2030-01-02');
  await waitFor(() =>
    getActivityLogsSnapshot().some((l) => l.entityId === id && l.actionType === 'completed-occurrence')
  );
  stopFirestoreStore();
});

test('updateItemStatus on a non-repeating task sets completedAt and logs status-changed', async () => {
  startFirestoreStore('items-core-test-13');
  const id = await createItem('task', 'One-off task');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItemStatus(id, 'completed');
  await waitFor(() => getItemWithMetadata(id)?.status === 'completed');
  assert.ok(getItemWithMetadata(id)?.completedAt);
  await waitFor(() =>
    getActivityLogsSnapshot().some((l) => l.entityId === id && l.actionType === 'status-changed')
  );
  stopFirestoreStore();
});

test('deleteItem soft-deletes by setting deletedAt', async () => {
  startFirestoreStore('items-core-test-14');
  const id = await createItem('task', 'To delete');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await deleteItem(id);
  await waitFor(() => getItemWithMetadata(id)?.deletedAt != null);
  assert.ok(getItemWithMetadata(id)?.deletedAt);
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `createItem`, `updateItem`, etc. are not exported from `itemsCore.ts` yet.

- [ ] **Step 3: Implement the mutations**

Append to `apps/mobile/src/db/firestore/itemsCore.ts`:

```typescript
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { nextOccurrenceDate } from '../../utils/repeat';
import { putItem, patchItem } from './store';
import { logActivity } from './activityLog';

export async function createItem(
  type: Item['type'],
  title: string,
  status: Item['status'] = 'inbox',
  scheduledDate?: string,
  notes?: string,
  voice_transcript?: string
): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  await putItem({
    id,
    type,
    title,
    status,
    scheduledDate,
    notes,
    voice_transcript,
    createdAt: now,
    updatedAt: now,
  });
  await logActivity(id, 'created');
  return id;
}

export async function updateItem(
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
): Promise<void> {
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
  await patchItem(id, fields as Partial<Omit<Item, 'id'>>);
}

export async function updateItemMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
  await patchItem(id, { metadata: JSON.stringify(metadata), updatedAt: Date.now() });
}

export async function updateItemTitle(id: string, title: string): Promise<void> {
  await patchItem(id, { title, updatedAt: Date.now() });
}

export async function updateItemStatus(id: string, status: Item['status']): Promise<void> {
  const now = Date.now();

  if (status === 'completed') {
    const item = getItemWithMetadata(id);
    const next = item ? nextOccurrenceDate(item.rrule, item.scheduledDate ?? formatDate(new Date())) : null;
    if (item && next) {
      await patchItem(id, { scheduledDate: next, status: 'active', completedAt: null, updatedAt: now });
      await logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence: item.scheduledDate, next }));
      return;
    }
  }

  await patchItem(id, { status, completedAt: status === 'completed' ? now : null, updatedAt: now });
  await logActivity(id, 'status-changed', JSON.stringify({ status }));
}

export async function deleteItem(id: string): Promise<void> {
  await patchItem(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}
```

`completedAt: null` in `updateItemStatus` above matches the SQLite version's explicit `completedAt = NULL` — Firestore stores `null` as a real value (unlike `undefined`, which Task 2's `ignoreUndefinedProperties: true` setting causes the SDK to silently drop from the write rather than clear the field). `createItem`'s optional fields (`scheduledDate`, `notes`, etc.) rely on that dropping behavior when left unset, same as an unset SQLite column.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 14`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/itemsCore.ts apps/mobile/src/db/firestore/itemsCore.test.ts
git commit -m "feat(mobile): port item mutations to Firestore store"
```

---

## Task 8: Activity logs

**Files:**
- Create: `apps/mobile/src/db/firestore/activityLog.ts`
- Test: `apps/mobile/src/db/firestore/activityLog.test.ts`

**Interfaces:**
- Consumes: `putActivityLog`, `getActivityLogsSnapshot` from `./store`.
- Produces: `logActivity(entityId: string, actionType: string, details?: string): Promise<void>`, `getTodayLogs(): ActivityLog[]`. `logActivity` is consumed by Task 7 (already imported above) and Task 9.

**Note on task ordering:** Task 7 imports `logActivity` from this module. Implement this task's `logActivity` function before running Task 7's tests, or implement Tasks 7 and 8 in the same working session — they're interdependent by design (mirrors how `createItem`/`updateItemStatus` call `logActivity` in the original `db/database.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/db/firestore/activityLog.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import { startFirestoreStore, stopFirestoreStore } from './store';
import { logActivity, getTodayLogs } from './activityLog';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('logActivity writes an entry with a generated id', async () => {
  startFirestoreStore('activity-log-test-1');
  await logActivity('item-1', 'created');
  await waitFor(() => getTodayLogs().some((l) => l.entityId === 'item-1' && l.actionType === 'created'));
  stopFirestoreStore();
});

test('getTodayLogs only returns entries from today, newest first', async () => {
  startFirestoreStore('activity-log-test-2');
  await logActivity('item-a', 'created');
  await logActivity('item-b', 'created');
  await waitFor(() => getTodayLogs().length === 2);
  const [first, second] = getTodayLogs();
  assert.ok(first.timestamp >= second.timestamp);
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `activityLog.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// apps/mobile/src/db/firestore/activityLog.ts
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import type { ActivityLog } from '../types';
import { putActivityLog, getActivityLogsSnapshot } from './store';

export async function logActivity(entityId: string, actionType: string, details?: string): Promise<void> {
  const now = Date.now();
  const log: ActivityLog = {
    id: uuidv4(),
    entityId,
    actionType,
    timestamp: now,
    details,
    createdAt: now,
  };
  await putActivityLog(log);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 2` for this file (and Task 7's suite now passes too, since it depends on this module).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/activityLog.ts apps/mobile/src/db/firestore/activityLog.test.ts
git commit -m "feat(mobile): port activity log writes/reads to Firestore store"
```

---

## Task 9: Relations and manual order

**Files:**
- Create: `apps/mobile/src/db/firestore/relations.ts`
- Test: `apps/mobile/src/db/firestore/relations.test.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot`, `getItemRelationsSnapshot`, `getItemOrderSnapshot`, `putItemRelation`, `deleteItemRelation`, `replaceItemOrder` from `./store`; `getItemWithMetadata` from `./itemsCore`.
- Produces: `setRelation`, `getRelation`, `getBlockingTask`, `setManualOrder`, `applyManualOrder`, `getRelatedItems`, `countRelated`, `getProjectItemCount`, `getAreaProjectCount`, `getProjectsForArea` — same signatures as `db/database.ts`, except the two write functions (`setRelation`, `setManualOrder`) now return `Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/db/firestore/relations.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import { startFirestoreStore, stopFirestoreStore, putItem, getItemOrderSnapshot } from './store';
import { createItem, getItemWithMetadata } from './itemsCore';
import {
  setRelation,
  getRelation,
  getBlockingTask,
  setManualOrder,
  applyManualOrder,
  getRelatedItems,
  countRelated,
} from './relations';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('setRelation then getRelation round-trips, and null clears it', async () => {
  startFirestoreStore('relations-test-1');
  await setRelation('task-1', 'project', 'project-1');
  await waitFor(() => getRelation('task-1', 'project') === 'project-1');
  await setRelation('task-1', 'project', null);
  await waitFor(() => getRelation('task-1', 'project') === null);
  stopFirestoreStore();
});

test('setRelation upserts — setting a new target replaces the old one', async () => {
  startFirestoreStore('relations-test-2');
  await setRelation('task-1', 'project', 'project-1');
  await waitFor(() => getRelation('task-1', 'project') === 'project-1');
  await setRelation('task-1', 'project', 'project-2');
  await waitFor(() => getRelation('task-1', 'project') === 'project-2');
  stopFirestoreStore();
});

test('getBlockingTask returns the blocker only while it is incomplete', async () => {
  startFirestoreStore('relations-test-3');
  const blockerId = await createItem('task', 'Blocker');
  const dependentId = await createItem('task', 'Dependent');
  await waitFor(() => getItemWithMetadata(blockerId) !== null && getItemWithMetadata(dependentId) !== null);
  await setRelation(dependentId, 'dependsOn', blockerId);
  await waitFor(() => getRelation(dependentId, 'dependsOn') === blockerId);
  assert.equal(getBlockingTask(dependentId)?.id, blockerId);

  const { updateItemStatus } = await import('./itemsCore');
  await updateItemStatus(blockerId, 'completed');
  await waitFor(() => getItemWithMetadata(blockerId)?.status === 'completed');
  assert.equal(getBlockingTask(dependentId), null);
  stopFirestoreStore();
});

test('getRelatedItems and countRelated exclude completed/archived/deleted', async () => {
  startFirestoreStore('relations-test-4');
  const areaId = await createItem('area', 'Health');
  const activeProjectId = await createItem('project', 'Fitness');
  const archivedProjectId = await createItem('project', 'Old project', 'archived');
  await waitFor(
    () =>
      getItemWithMetadata(areaId) !== null &&
      getItemWithMetadata(activeProjectId) !== null &&
      getItemWithMetadata(archivedProjectId) !== null
  );
  await setRelation(activeProjectId, 'area', areaId);
  await setRelation(archivedProjectId, 'area', areaId);
  await waitFor(() => getRelation(activeProjectId, 'area') === areaId && getRelation(archivedProjectId, 'area') === areaId);
  assert.deepEqual(getRelatedItems(areaId, 'area').map((i) => i.id), [activeProjectId]);
  assert.equal(countRelated(areaId, 'area'), 1);
  stopFirestoreStore();
});

test('setManualOrder + applyManualOrder sorts by saved position, unsaved items appended', async () => {
  startFirestoreStore('relations-test-5');
  await setManualOrder('list-1', ['b', 'a']);
  await waitFor(() => getItemOrderSnapshot().filter((r) => r.listKey === 'list-1').length === 2);
  const sorted = applyManualOrder('list-1', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(sorted.map((i) => i.id), ['b', 'a', 'c']);
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `relations.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// apps/mobile/src/db/firestore/relations.ts
import type { Item } from '../types';
import {
  getItemsSnapshot,
  getItemRelationsSnapshot,
  getItemOrderSnapshot,
  putItemRelation,
  deleteItemRelation,
  replaceItemOrder,
} from './store';
import { getItemWithMetadata } from './itemsCore';

export async function setRelation(sourceId: string, relationType: string, targetId: string | null): Promise<void> {
  if (targetId === null) {
    await deleteItemRelation(sourceId, relationType);
    return;
  }
  await putItemRelation({
    id: `${sourceId}__${relationType}`,
    sourceId,
    targetId,
    relationType,
    createdAt: Date.now(),
  });
}

export function getRelation(sourceId: string, relationType: string): string | null {
  return (
    getItemRelationsSnapshot().find((r) => r.sourceId === sourceId && r.relationType === relationType)?.targetId ??
    null
  );
}

export function getBlockingTask(itemId: string): Item | null {
  const dependsOnId = getRelation(itemId, 'dependsOn');
  if (!dependsOnId) return null;
  const blocker = getItemWithMetadata(dependsOnId);
  if (!blocker || blocker.status === 'completed' || blocker.deletedAt) return null;
  return blocker;
}

export async function setManualOrder(listKey: string, orderedIds: string[]): Promise<void> {
  await replaceItemOrder(listKey, orderedIds);
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
    .filter(
      (i) =>
        sourceIds.has(i.id) && i.deletedAt == null && i.status !== 'completed' && i.status !== 'archived'
    )
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 5`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/relations.ts apps/mobile/src/db/firestore/relations.test.ts
git commit -m "feat(mobile): port relations and manual-order to Firestore store"
```

---

## Task 10: Today-planning helpers

**Files:**
- Create: `apps/mobile/src/db/firestore/todayPlanning.ts`
- Test: `apps/mobile/src/db/firestore/todayPlanning.test.ts`

**Interfaces:**
- Consumes: `getItemsSnapshot` from `./store`; `getItemWithMetadata`, `updateItemMetadata`, `formatDate` from `./itemsCore`; `parseRepeatRule`, `dayMatchesRepeat` from `../../utils/repeat` (existing, unchanged).
- Produces: `planForToday(itemId, bucket?)`, `unplanToday(itemId)`, `getPlannedTodayItems()`, `getRepeatingItemsForToday()`. (`isPlannedForToday` is a pure function with no DB dependency — re-export it unchanged from `../database` rather than porting it; note this in the cutover plan.)

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/db/firestore/todayPlanning.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import { startFirestoreStore, stopFirestoreStore } from './store';
import { createItem, getItemWithMetadata, updateItem } from './itemsCore';
import { planForToday, unplanToday, getPlannedTodayItems, getRepeatingItemsForToday } from './todayPlanning';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('planForToday then unplanToday round-trips metadata.plannedDate', async () => {
  startFirestoreStore('today-planning-test-1');
  const id = await createItem('task', 'Undated task', 'active');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await planForToday(id, 'morning');
  await waitFor(() => getPlannedTodayItems().some((i) => i.id === id));
  assert.equal(getPlannedTodayItems()[0].id, id);
  await unplanToday(id);
  await waitFor(() => !getPlannedTodayItems().some((i) => i.id === id));
  stopFirestoreStore();
});

test('getPlannedTodayItems excludes completed and inbox statuses', async () => {
  startFirestoreStore('today-planning-test-2');
  const activeId = await createItem('task', 'Active', 'active');
  const completedId = await createItem('task', 'Completed', 'completed');
  await waitFor(() => getItemWithMetadata(activeId) !== null && getItemWithMetadata(completedId) !== null);
  await planForToday(activeId);
  await planForToday(completedId);
  await waitFor(() => getPlannedTodayItems().some((i) => i.id === activeId));
  assert.deepEqual(getPlannedTodayItems().map((i) => i.id), [activeId]);
  stopFirestoreStore();
});

test('getRepeatingItemsForToday matches a daily rrule', async () => {
  startFirestoreStore('today-planning-test-3');
  const id = await createItem('task', 'Daily habit', 'active');
  await waitFor(() => getItemWithMetadata(id) !== null);
  await updateItem(id, { rrule: 'FREQ=DAILY' });
  await waitFor(() => getItemWithMetadata(id)?.rrule === 'FREQ=DAILY');
  assert.deepEqual(getRepeatingItemsForToday().map((i) => i.id), [id]);
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `todayPlanning.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// apps/mobile/src/db/firestore/todayPlanning.ts
import type { Item } from '../types';
import { getItemsSnapshot } from './store';
import { getItemWithMetadata, updateItemMetadata, formatDate } from './itemsCore';
import { parseRepeatRule, dayMatchesRepeat } from '../../utils/repeat';

export async function planForToday(
  itemId: string,
  bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'
): Promise<void> {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  await updateItemMetadata(itemId, meta);
}

export async function unplanToday(itemId: string): Promise<void> {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  delete meta.plannedDate;
  if (meta.preferredTimeBucket && meta.preferredTimeBucket !== 'anytime') {
    meta.preferredTimeBucket = 'anytime';
  }
  await updateItemMetadata(itemId, meta);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 3`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/todayPlanning.ts apps/mobile/src/db/firestore/todayPlanning.test.ts
git commit -m "feat(mobile): port today-planning helpers to Firestore store"
```

---

## Task 11: One-time data migration script

**Files:**
- Create: `apps/mobile/src/db/firestore/migrateLocalData.ts`
- Test: `apps/mobile/src/db/firestore/migrateLocalData.test.ts`

**Interfaces:**
- Consumes: `serializeBackup` from `../backup` (existing, unchanged — already reads the full SQLite DB); `putItem`, `putActivityLog`, `putItemRelation`, `replaceItemOrder` from `./store`.
- Produces: `migrateLocalDataToFirestore(uid: string): Promise<{ items: number; activityLogs: number; itemRelations: number }>` — reads the current device's SQLite data via the existing `serializeBackup()` and writes it into the signed-in user's Firestore collections. Not yet called from anywhere in the app — wired up during the cutover plan's first-sign-in flow.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/db/firestore/migrateLocalData.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectToEmulator } from './testEnv';
import { startFirestoreStore, stopFirestoreStore } from './store';
import { getItemWithMetadata } from './itemsCore';
import { getRelation } from './relations';
import { migrateLocalDataToFirestore } from './migrateLocalData';
import type { BackupPayload } from '../backup';

connectToEmulator();

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('migrateLocalDataToFirestore uploads items, logs, and relations from a given payload', async () => {
  startFirestoreStore('migrate-test-1');

  const payload: BackupPayload = {
    schemaVersion: 1,
    items: [
      {
        id: 'm-item-1',
        type: 'task',
        title: 'Migrated task',
        status: 'inbox',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    itemInstances: [],
    activityLogs: [{ id: 'm-log-1', entityId: 'm-item-1', actionType: 'created', timestamp: 1, createdAt: 1 }],
    itemRelations: [{ id: 'm-rel-1', sourceId: 'm-item-1', targetId: 'project-1', relationType: 'project', createdAt: 1 }],
    appSettings: [],
  };

  const result = await migrateLocalDataToFirestore('migrate-test-1', payload);
  assert.deepEqual(result, { items: 1, activityLogs: 1, itemRelations: 1 });

  await waitFor(() => getItemWithMetadata('m-item-1') !== null);
  assert.equal(getItemWithMetadata('m-item-1')?.title, 'Migrated task');
  await waitFor(() => getRelation('m-item-1', 'project') === 'project-1');
  stopFirestoreStore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: FAIL — `migrateLocalData.ts` does not exist yet.

- [ ] **Step 3: Implement**

The function takes an explicit `BackupPayload` parameter (rather than calling `serializeBackup()` internally) so it's testable without a real `expo-sqlite` database — the real call site (added in the cutover plan) passes `serializeBackup()` directly.

```typescript
// apps/mobile/src/db/firestore/migrateLocalData.ts
import type { BackupPayload } from '../backup';
import { putItem, putActivityLog, putItemRelation } from './store';

export async function migrateLocalDataToFirestore(
  uid: string,
  payload: BackupPayload
): Promise<{ items: number; activityLogs: number; itemRelations: number }> {
  for (const item of payload.items) {
    await putItem(item);
  }
  for (const log of payload.activityLogs) {
    await putActivityLog(log);
  }
  for (const relation of payload.itemRelations) {
    await putItemRelation(relation);
  }

  // itemOrder isn't part of BackupPayload today (see db/backup.ts) — the cutover
  // plan extends BackupPayload to include it before calling this function for real.

  return {
    items: payload.items.length,
    activityLogs: payload.activityLogs.length,
    itemRelations: payload.itemRelations.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: `# pass 1`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/firestore/migrateLocalData.ts apps/mobile/src/db/firestore/migrateLocalData.test.ts
git commit -m "feat(mobile): add one-time local-to-Firestore data migration"
```

---

## Task 12: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire Firestore test suite together**

Run: `npm run test:firestore --prefix apps/mobile`
Expected: all tests across `testEnv`, `rules`, `store`, `itemsCore`, `activityLog`, `relations`, `todayPlanning`, `migrateLocalData` pass — roughly 35 tests total.

- [ ] **Step 2: Run the existing non-Firestore suite to confirm no regressions**

Run: `cd apps/mobile && npm test`
Expected: all existing `node --test` suites still pass unchanged — this plan added no changes to `db/database.ts`, `hooks/useDb.ts`, or any screen.

---

## What this plan does not do (by design)

- Does not touch `db/database.ts`, `hooks/useDb.ts`, or any screen — the app still runs entirely on SQLite after this plan ships.
- Does not port medications, calendar/timeline, GTD triage, or `itemInstances` — those are Plans 2 and 3.
- Does not perform the real cutover (swapping `db/database.ts`'s exports, wiring the migration script into first-sign-in, deleting `expo-sqlite`) — that's the final step of Plan 3, once all subsystems are ported, so the swap happens once, atomically, with nothing left half-migrated.
