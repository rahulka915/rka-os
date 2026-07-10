# Mobile Supabase Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile app (`apps/mobile`) a one-way backup of its local SQLite data to Supabase, tied to a real user account, with a manual restore path.

**Architecture:** Mobile signs in to the same Supabase project the web app already uses (email/password, reusing the web account). On app backgrounding or a manual button tap, it serializes the entire local SQLite DB into one JSON blob and inserts it as a new row in a new `mobile_backups` table (keeping the last 5 per user). Restore fetches the latest snapshot and replaces all local data with it, on an explicit user action only.

**Tech Stack:** Expo SDK 54, expo-sqlite, @supabase/supabase-js (already a dependency), @react-native-async-storage/async-storage (already a dependency), react-native-url-polyfill (new).

**Spec:** `docs/superpowers/specs/2026-07-10-mobile-supabase-backup-design.md`

## Global Constraints

- One-way backup only — no bidirectional sync, no realtime, no conflict resolution (spec's explicit non-goal).
- Reuses the existing Supabase project — same values as web's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, exposed to mobile as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Keep only the last 5 snapshots per user in `mobile_backups`.
- No `expo-background-task` involvement (known unreliable on iOS per project notes) — triggers are app-lifecycle (background/inactive) and manual only.
- Backup push failures are caught, logged via `console.warn`, and otherwise silent — no user-facing error, no retry queue.
- Restore is always a manual, explicit, confirmed action — never automatic.
- **No automated test suite exists for `apps/mobile`** (no Jest/RNTL configured). Setting one up is out of scope for this feature. Every task below is verified manually (via the running app, `console.log` inspection, and the Supabase dashboard/CLI) instead of automated tests — this is a deliberate deviation from the usual write-a-failing-test flow, matching the project's actual state.
- Follow `npm install --legacy-peer-deps` for any new package in `apps/mobile` (SDK 54 requirement per `apps/mobile/CLAUDE.md`).

---

### Task 1: Supabase migration — `mobile_backups` table

**Files:**
- Create: `supabase/migrations/20260710120000_mobile_backups.sql`

**Interfaces:**
- Produces: Postgres table `public.mobile_backups(id uuid, user_id uuid, device_id text, payload jsonb, created_at timestamptz)`, with RLS restricting all access to `user_id = auth.uid()`. Later tasks (`backupSync.ts`) read/write this table by name.

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.mobile_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mobile_backups_user_created_idx
  on public.mobile_backups (user_id, created_at desc);

alter table public.mobile_backups enable row level security;

create policy "mobile_backups_select_own" on public.mobile_backups
  for select using (user_id = auth.uid());

create policy "mobile_backups_write_own" on public.mobile_backups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply the migration to the live project**

Run (from repo root, not `apps/mobile`):
```bash
npx supabase db push
```
Expected: CLI reports the new migration `20260710120000_mobile_backups.sql` applied successfully.

- [ ] **Step 3: Verify the table and policies exist**

Run:
```bash
npx supabase migration list
```
Expected: `20260710120000_mobile_backups` shows as applied both locally and remotely.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710120000_mobile_backups.sql
git commit -m "feat: add mobile_backups table for mobile app backups"
```

---

### Task 2: Mobile Supabase client + env config

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/.env.local` (gitignored — already covered by `apps/mobile/.gitignore`'s `.env*.local` pattern)
- Create: `apps/mobile/.env.example`
- Modify: `apps/mobile/package.json` (add `react-native-url-polyfill`)

**Interfaces:**
- Produces: `supabase: SupabaseClient | null`, `hasSupabaseConfig: boolean` — exported from `src/lib/supabase.ts`, consumed by every later task that talks to Supabase.

- [ ] **Step 1: Install the URL polyfill Supabase's JS client needs under Hermes/React Native**

Run:
```bash
cd apps/mobile && npm install react-native-url-polyfill --legacy-peer-deps
```
Expected: `react-native-url-polyfill` appears in `apps/mobile/package.json` dependencies.

- [ ] **Step 2: Create the env template (committed)**

Create `apps/mobile/.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Create the real local env file (not committed)**

Create `apps/mobile/.env.local` and copy the values from the repo root's `.env.local` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) into the `EXPO_PUBLIC_` equivalents:
```
EXPO_PUBLIC_SUPABASE_URL=<same value as root .env.local's VITE_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same value as root .env.local's VITE_SUPABASE_ANON_KEY>
```

- [ ] **Step 4: Create the Supabase client module**

Create `apps/mobile/src/lib/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
```

- [ ] **Step 5: Verify it loads with no crash**

Add a temporary line at the top of `apps/mobile/App.tsx` (after existing imports, before `getDb()`):
```ts
import { hasSupabaseConfig } from './src/lib/supabase';
console.log('[backup] hasSupabaseConfig:', hasSupabaseConfig);
```
Run `cd apps/mobile && npm start -- --clear`, open the app on the dev-client, and check the Metro log output.
Expected: `[backup] hasSupabaseConfig: true` with no red-screen error. Remove the temporary `console.log` line afterward (keep the import only if a later task needs it — it doesn't, so remove the import too).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/supabase.ts apps/mobile/.env.example apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "feat: add mobile Supabase client for backup feature"
```

---

### Task 3: Local backup serialize/restore functions

**Files:**
- Create: `apps/mobile/src/db/backup.ts`

**Interfaces:**
- Consumes: `getDb()` and `uuid()` from `apps/mobile/src/db/database.ts`; `Item`, `ItemInstance`, `ActivityLog` from `apps/mobile/src/db/types.ts`.
- Produces: `BackupPayload` type, `serializeBackup(): BackupPayload`, `restoreBackup(payload: BackupPayload): void`, `getOrCreateDeviceId(): string` — consumed by Task 4 (`backupSync.ts`).

- [ ] **Step 1: Write the module**

Create `apps/mobile/src/db/backup.ts`:
```ts
import { getDb, uuid } from './database';
import type { Item, ItemInstance, ActivityLog } from './types';

export interface BackupItemRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: number;
}

export interface BackupAppSetting {
  key: string;
  value: string;
  updatedAt: number;
}

export interface BackupPayload {
  schemaVersion: 1;
  items: Item[];
  itemInstances: ItemInstance[];
  activityLogs: ActivityLog[];
  itemRelations: BackupItemRelation[];
  appSettings: BackupAppSetting[];
}

export function serializeBackup(): BackupPayload {
  const db = getDb();
  return {
    schemaVersion: 1,
    items: db.getAllSync<Item>(`SELECT * FROM items`),
    itemInstances: db.getAllSync<ItemInstance>(`SELECT * FROM itemInstances`),
    activityLogs: db.getAllSync<ActivityLog>(`SELECT * FROM activityLogs`),
    itemRelations: db.getAllSync<BackupItemRelation>(`SELECT * FROM itemRelations`),
    appSettings: db.getAllSync<BackupAppSetting>(`SELECT * FROM appSettings`),
  };
}

export function restoreBackup(payload: BackupPayload): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM items`);
    db.runSync(`DELETE FROM itemInstances`);
    db.runSync(`DELETE FROM activityLogs`);
    db.runSync(`DELETE FROM itemRelations`);
    db.runSync(`DELETE FROM appSettings`);

    for (const item of payload.items) {
      db.runSync(
        `INSERT INTO items (id, type, title, status, notes, voice_transcript, scheduledDate, dueDate, rrule, metadata, createdAt, updatedAt, userId, archivedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.type, item.title, item.status,
          item.notes ?? null, item.voice_transcript ?? null,
          item.scheduledDate ?? null, item.dueDate ?? null, item.rrule ?? null,
          item.metadata ?? null, item.createdAt, item.updatedAt,
          item.userId ?? null, item.archivedAt ?? null, item.deletedAt ?? null,
        ]
      );
    }

    for (const inst of payload.itemInstances) {
      db.runSync(
        `INSERT INTO itemInstances (id, itemId, scheduledDate, completedAt, status, instanceMetadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.id, inst.itemId, inst.scheduledDate, inst.completedAt ?? null,
          inst.status, inst.instanceMetadata ?? null, inst.createdAt, inst.updatedAt,
        ]
      );
    }

    for (const log of payload.activityLogs) {
      db.runSync(
        `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [log.id, log.entityId, log.actionType, log.timestamp, log.details ?? null, log.createdAt]
      );
    }

    for (const rel of payload.itemRelations) {
      db.runSync(
        `INSERT INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [rel.id, rel.sourceId, rel.targetId, rel.relationType, rel.createdAt]
      );
    }

    for (const setting of payload.appSettings) {
      db.runSync(
        `INSERT INTO appSettings (key, value, updatedAt) VALUES (?, ?, ?)`,
        [setting.key, setting.value, setting.updatedAt]
      );
    }
  });
}

export function getOrCreateDeviceId(): string {
  const db = getDb();
  const existing = db.getAllSync<{ value: string }>(
    `SELECT value FROM appSettings WHERE key = 'backupDeviceId' LIMIT 1`
  )[0];
  if (existing) return existing.value;

  const id = uuid();
  db.runSync(
    `INSERT INTO appSettings (key, value, updatedAt) VALUES ('backupDeviceId', ?, ?)`,
    [id, Date.now()]
  );
  return id;
}
```

- [ ] **Step 2: Verify manually via a temporary debug call**

Temporarily add to `apps/mobile/App.tsx`, right after `getDb();`:
```ts
import { serializeBackup, getOrCreateDeviceId } from './src/db/backup';
console.log('[backup] deviceId:', getOrCreateDeviceId());
console.log('[backup] snapshot item count:', serializeBackup().items.length);
```
Run `cd apps/mobile && npm start -- --clear`, open the app.
Expected: Metro logs show a stable UUID for `deviceId` (same value across reloads) and an `items.length` matching what's visible in the Inbox/Tasks screens. Remove these temporary lines and the import afterward.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/backup.ts
git commit -m "feat: add local backup serialize/restore functions"
```

---

### Task 4: Remote backup push/fetch service

**Files:**
- Create: `apps/mobile/src/services/backupSync.ts`

**Interfaces:**
- Consumes: `supabase`, `hasSupabaseConfig` from `src/lib/supabase.ts`; `serializeBackup`, `getOrCreateDeviceId`, `BackupPayload` from `src/db/backup.ts`.
- Produces: `pushBackup(userId: string): Promise<void>`, `getLatestBackupMeta(userId: string): Promise<{ id: string; createdAt: string } | null>`, `fetchLatestBackupPayload(userId: string): Promise<BackupPayload | null>` — consumed by Task 5 (`useBackup.ts`) and Task 7 (`App.tsx`).

- [ ] **Step 1: Write the module**

Create `apps/mobile/src/services/backupSync.ts`:
```ts
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { serializeBackup, getOrCreateDeviceId, type BackupPayload } from '../db/backup';

const MAX_SNAPSHOTS_PER_USER = 5;

export interface BackupMeta {
  id: string;
  createdAt: string;
}

export async function pushBackup(userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const payload = serializeBackup();
  const deviceId = getOrCreateDeviceId();

  const { error } = await supabase.from('mobile_backups').insert({
    user_id: userId,
    device_id: deviceId,
    payload,
  });
  if (error) throw error;

  await pruneOldBackups(userId);
}

async function pruneOldBackups(userId: string): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('mobile_backups')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return;

  const idsToDelete = data.slice(MAX_SNAPSHOTS_PER_USER).map((row) => row.id);
  if (idsToDelete.length === 0) return;

  await supabase.from('mobile_backups').delete().in('id', idsToDelete);
}

export async function getLatestBackupMeta(userId: string): Promise<BackupMeta | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('mobile_backups')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;

  return { id: data[0].id, createdAt: data[0].created_at };
}

export async function fetchLatestBackupPayload(userId: string): Promise<BackupPayload | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('mobile_backups')
    .select('payload')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;

  return data[0].payload as BackupPayload;
}
```

- [ ] **Step 2: Verify against the live Supabase project**

Temporarily add to `apps/mobile/App.tsx` inside the existing `init()` function in the `useEffect` (after `await requestLocationPermission().catch(() => {});`):
```ts
const { supabase } = await import('./src/lib/supabase');
const { pushBackup, getLatestBackupMeta } = await import('./src/services/backupSync');
const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
if (data.session) {
  await pushBackup(data.session.user.id);
  console.log('[backup] latest meta:', await getLatestBackupMeta(data.session.user.id));
} else {
  console.log('[backup] no session yet — sign-in wired in Task 5/6');
}
```
Run the app. Since there's no sign-in UI yet, expected output is `[backup] no session yet — sign-in wired in Task 5/6` (this step only confirms the module imports and runs without a crash). Remove this temporary block afterward — real verification of an actual push happens in Task 6's manual test.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/backupSync.ts
git commit -m "feat: add remote backup push/fetch service"
```

---

### Task 5: `useBackup` hook

**Files:**
- Create: `apps/mobile/src/hooks/useBackup.ts`

**Interfaces:**
- Consumes: `supabase`, `hasSupabaseConfig` from `src/lib/supabase.ts`; `pushBackup`, `getLatestBackupMeta`, `fetchLatestBackupPayload` from `src/services/backupSync.ts`; `restoreBackup` from `src/db/backup.ts`.
- Produces: `useBackup()` hook returning `{ isSignedIn: boolean, email: string | null, lastBackupAt: string | null, busy: boolean, signIn(email, password): Promise<void>, signOut(): Promise<void>, backUpNow(): Promise<void>, restoreLatest(): Promise<boolean> }` — consumed by Task 6 (`ProfileScreen.tsx`).

- [ ] **Step 1: Write the hook**

Create `apps/mobile/src/hooks/useBackup.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { pushBackup, getLatestBackupMeta, fetchLatestBackupPayload } from '../services/backupSync';
import { restoreBackup } from '../db/backup';

export function useBackup() {
  const [session, setSession] = useState<Session | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshLastBackup = useCallback(async (userId: string) => {
    const meta = await getLatestBackupMeta(userId);
    setLastBackupAt(meta?.createdAt ?? null);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) refreshLastBackup(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        refreshLastBackup(nextSession.user.id);
      } else {
        setLastBackupAt(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshLastBackup]);

  const backUpNow = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await pushBackup(session.user.id);
      await refreshLastBackup(session.user.id);
    } catch (err) {
      console.warn('[backup] push failed', err);
    } finally {
      setBusy(false);
    }
  }, [session, refreshLastBackup]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        await pushBackup(data.session.user.id).catch((err) =>
          console.warn('[backup] initial push after sign-in failed', err)
        );
        await refreshLastBackup(data.session.user.id);
      }
    } finally {
      setBusy(false);
    }
  }, [refreshLastBackup]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const restoreLatest = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    setBusy(true);
    try {
      const payload = await fetchLatestBackupPayload(session.user.id);
      if (!payload) return false;
      restoreBackup(payload);
      return true;
    } finally {
      setBusy(false);
    }
  }, [session]);

  return {
    isSignedIn: !!session,
    email: session?.user.email ?? null,
    lastBackupAt,
    busy,
    signIn,
    signOut,
    backUpNow,
    restoreLatest,
  };
}
```

- [ ] **Step 2: Verify manually**

This hook has no UI yet — it's fully exercised in Task 6's manual test plan. As a quick sanity check now, run:
```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: no new type errors introduced by `useBackup.ts` (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useBackup.ts
git commit -m "feat: add useBackup hook for auth + backup/restore state"
```

---

### Task 6: Profile screen Backup UI

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useBackup()` from `src/hooks/useBackup.ts`.

- [ ] **Step 1: Add the Backup section component**

In `apps/mobile/src/screens/ProfileScreen.tsx`, add these imports alongside the existing ones (after the `RoninPreview` import at line 11):
```ts
import { Alert, TextInput } from 'react-native';
import { useBackup } from '../hooks/useBackup';
```
Note: `Pressable`, `ScrollView`, `StyleSheet`, `Text`, `View` are already imported from `react-native` at line 2 — add `Alert` and `TextInput` to that existing import instead of a new line:
```ts
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
```

Add this component after `Ronin3DBench` (after line 92, before `export function ProfileScreen()`):
```tsx
function BackupSection() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to sign in.');
      return;
    }
    try {
      await backup.signIn(email.trim(), password);
      setPassword('');
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore latest backup',
      'This replaces all data currently on this device with your last backup. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            const restored = await backup.restoreLatest();
            if (restored) {
              Alert.alert('Restore complete', 'Close and reopen the app to see the restored data.');
            } else {
              Alert.alert('No backup found', 'There is no backup to restore yet.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.backupSection}>
      <Text style={[styles.backupTitle, { color: palette.text }]}>Backup</Text>
      {backup.isSignedIn ? (
        <>
          <Text style={[styles.backupStatus, { color: palette.textSecondary }]}>
            Signed in as {backup.email}
          </Text>
          <Text style={[styles.backupStatus, { color: palette.textSecondary }]}>
            {backup.lastBackupAt
              ? `Last backup: ${new Date(backup.lastBackupAt).toLocaleString()}`
              : 'No backup yet'}
          </Text>
          <Pressable
            onPress={backup.backUpNow}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>
              {backup.busy ? 'Working…' : 'Back up now'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleRestore}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>Restore latest backup</Text>
          </Pressable>
          <Pressable onPress={backup.signOut} disabled={backup.busy}>
            <Text style={[styles.backupStatus, { color: palette.textMuted, textAlign: 'center' }]}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.backupInput, { color: palette.text, borderColor: palette.fill }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            style={[styles.backupInput, { color: palette.text, borderColor: palette.fill }]}
          />
          <Pressable
            onPress={handleSignIn}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>
              {backup.busy ? 'Signing in…' : 'Sign in to enable backups'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
```

Note: `useState` is already imported at line 1 (`import { useMemo, useState } from 'react';`) — no change needed there.

- [ ] **Step 2: Mount the section in `ProfileScreen`**

Modify the `ProfileScreen` function (starting at what is currently line 94) to render `<BackupSection />` — add it right after the `<Text style={[styles.title, ...]}>Me</Text>` line, outside the `{__DEV__ && (...)}` block so it's visible in all builds:
```tsx
export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [mood, setMood] = useState<RoninMood>('normal');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 24) + 96 },
      ]}
    >
      <Text style={[styles.title, { color: palette.text }]}>Me</Text>
      <BackupSection />
      {__DEV__ && (
        <>
          <Ronin3DBench mood={mood} onMoodChange={setMood} />
          <View style={styles.previewSection}>
            <RoninPreview mood={mood} style={styles.preview} />
          </View>
        </>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Add styles**

Add these entries to the `StyleSheet.create({...})` call at the bottom of the file (alongside the existing `title`, `bench`, etc. keys):
```ts
  backupSection: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 8,
  },
  backupTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  backupStatus: {
    fontSize: 13,
  },
  backupInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  backupButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
```

- [ ] **Step 4: Manual verification on device**

Run `cd apps/mobile && npm start -- --clear`, open the dev-client app, go to the "Me" tab.

Test the full loop:
1. Enter your web-app email/password, tap "Sign in to enable backups". Expected: status changes to "Signed in as `<email>`" and "Last backup: `<just now>`" within a few seconds (confirms the sign-in-triggers-a-push behavior).
2. Check the Supabase dashboard's `mobile_backups` table (Table Editor) — expected: one new row with your `user_id`, a `payload` JSON blob, and a recent `created_at`.
3. Add a task via Quick Add, then tap "Back up now". Expected: "Last backup" timestamp updates; a second row appears in the dashboard.
4. Tap "Restore latest backup" → confirm "Replace" → expected: "Restore complete" alert appears. Force-close and reopen the app — expected: local data matches what was in the restored snapshot.
5. Turn on Airplane Mode, tap "Back up now" — expected: no crash, no error alert (silent failure per spec), "Last backup" stays at its prior value. Turn network back on, tap "Back up now" again — expected: succeeds normally.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/ProfileScreen.tsx
git commit -m "feat: add backup sign-in/backup/restore UI to Profile screen"
```

---

### Task 7: Automatic backup on app backgrounding

**Files:**
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `hasSupabaseConfig` from `src/lib/supabase.ts`; `pushBackup` from `src/services/backupSync.ts`.

- [ ] **Step 1: Add the AppState listener**

In `apps/mobile/App.tsx`, add `AppState` to the existing `react-native` import (line 3):
```ts
import { useColorScheme, TouchableOpacity, View, Text, StyleSheet, AppState } from 'react-native';
```

Add these imports after the existing `requestLocationPermission` import (after line 28):
```ts
import { supabase, hasSupabaseConfig } from './src/lib/supabase';
import { pushBackup } from './src/services/backupSync';
```

Add a new `useEffect` inside the `App` function, after the existing `inboxOpen` effect (after line 177, before the `return (`):
```ts
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'background' && nextState !== 'inactive') return;
      if (!hasSupabaseConfig || !supabase) return;

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await pushBackup(data.session.user.id);
        }
      } catch (err) {
        console.warn('[backup] background push failed', err);
      }
    });

    return () => subscription.remove();
  }, []);
```

- [ ] **Step 2: Manual verification on device**

With the app already signed in to backup (from Task 6's test), note the current "Last backup" time on the Profile screen, then:
1. Add a new task via Quick Add.
2. Press the physical Home button / swipe to background the app (don't force-quit — just background it).
3. Wait ~5 seconds, then reopen the app and go to the Profile tab.

Expected: "Last backup" timestamp is more recent than before backgrounding, and the Supabase dashboard's `mobile_backups` table shows a new row (and no more than 5 total rows for your user — confirms pruning works).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat: trigger backup push on app backgrounding"
```

---

## Follow-ups (not part of this plan)

- If the mobile build ever moves from `eas build --local` to cloud EAS builds, `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` will need to be added as EAS environment variables (`eas env:create`) since cloud builds only see committed files, not `.env.local`.
- Full bidirectional mobile↔web sync remains a separate, larger future project (tracked in `docs/migration/REACT_NATIVE_SETUP.md`).
