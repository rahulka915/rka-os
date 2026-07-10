# Mobile: One-Way Supabase Backup & Restore

## Context

`apps/mobile` stores all data locally in SQLite (`expo-sqlite`), with no cloud copy. The
web app (`src/`) already has a fully-built bidirectional, realtime Supabase sync
(`src/data/sync.ts`) — but its schema doesn't match mobile's:

- Web (Dexie): `items`, `itemInstances`, `tags`, `itemTags`, `entityLinks`, `activityLogs`,
  `workoutSessions`, `exerciseSessions`, `setEntries`, `exerciseMedia`
- Mobile (SQLite): `items`, `itemInstances`, `activityLogs`, `appSettings`, `itemRelations`

Building true bidirectional sync for mobile would mean reconciling these schemas and
replicating the web app's queue + realtime + hydration architecture — a much larger,
separate project. This spec scopes a smaller, near-term goal instead: a **one-way backup
push** from mobile to Supabase, with a manual restore path, so local data survives device
loss/corruption and gives peace of mind before risky changes (e.g. rebuilding the app to
test a Metro-independent release build).

Mobile currently has **no auth at all** — the `userId` column on `items` is unused. This
is the first time mobile will talk to Supabase auth.

## Goals

- Automatic-ish backup of all local mobile data to the same Supabase project the web app
  uses, tied to the user's real account (not anonymous).
- A restore path so a backup is actually recoverable, not just stored.
- Small, low-risk footprint — no queue, no realtime, no schema reconciliation with web.

## Non-goals

- Bidirectional sync between mobile and web.
- Real-time updates / live collaboration.
- Reconciling mobile's schema with web's (tags, workouts, entityLinks).
- Automatic restore (always manual/explicit).

## Architecture

### Supabase table

```sql
create table mobile_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  device_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table mobile_backups enable row level security;

create policy "Users can manage their own backups"
  on mobile_backups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- Only the **last 5 snapshots per user** are kept; older ones are pruned after each
  successful push (cheap safety margin without unbounded growth).
- `device_id` is informational only (helps distinguish backups if you ever have 2+
  devices) — restore always uses the most recent row for the signed-in user regardless
  of device.

### Mobile Supabase client

New `apps/mobile/src/lib/supabase.ts`:

- Same Supabase project as web, via `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  env vars (Expo's public env var convention, mirroring web's `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` — same underlying project/values, different var name prefix).
- `createClient` configured with an AsyncStorage-backed `storage` option for session
  persistence (mobile has no `window.localStorage`).
- Exports `supabase: SupabaseClient | null` and `hasSupabaseConfig: boolean`, mirroring the
  web app's pattern of degrading gracefully when env vars are absent.

## Auth & Profile UI

- New "Backup" section in `ProfileScreen.tsx`:
  - Signed out: email + password fields, "Sign in" button. Reuses the same account as the
    web app (`supabase.auth.signInWithPassword`).
  - Signed in: status line — `Signed in as <email> · Last backup: <relative time>` (or
    "No backup yet"), a **"Back up now"** button, a **"Restore latest backup"** button, and
    "Sign out".
- Signing in triggers an immediate backup push.
- Signed-out state is fully supported — the app works offline exactly as it does today;
  backup is strictly opt-in.

## Backup push logic

New `apps/mobile/src/db/backup.ts`:

- `serializeBackup()` — reads all rows from `items`, `itemInstances`, `activityLogs`,
  `itemRelations`, `appSettings` (via existing `getDb()`), returns one JSON object:
  ```ts
  { items: Item[], itemInstances: ItemInstance[], activityLogs: ActivityLog[],
    itemRelations: ItemRelation[], appSettings: AppSetting[], schemaVersion: 1 }
  ```
- `pushBackup()` — no-ops if not signed in or `!hasSupabaseConfig`; otherwise inserts a new
  `mobile_backups` row with the serialized payload, then deletes any rows beyond the 5
  most recent for that user.
- `getLatestBackup()` — fetches the most recent `mobile_backups` row for the signed-in
  user (used by both the Profile status line and restore).

### Trigger points

- **App backgrounding**: an `AppState` listener in `App.tsx` calls `pushBackup()` when the
  app transitions to `background`/`inactive` (only if signed in).
- **Manual**: the "Back up now" button in Profile.
- **On sign-in**: one immediate push, so a fresh sign-in isn't left with "no backup yet"
  until the next backgrounding.
- No `expo-background-task` involvement — known unreliable on iOS per existing project
  notes, and app-lifecycle + manual coverage is sufficient for a safety-net feature.

### Failure handling

- Failures (offline, network error, Supabase error) are caught, logged via `console.warn`,
  and otherwise silent — no user-facing error, no retry queue. The next backgrounding or
  manual tap naturally retries with current state.

## Restore

- "Restore latest backup" button in Profile, enabled only when signed in and
  `getLatestBackup()` returns a row.
- Tapping it shows a confirmation dialog: *"This replaces all data currently on this
  device with your last backup from `<timestamp>`. Continue?"* — Cancel / Replace.
- On confirm: `restoreBackup(payload)` in `backup.ts` wipes the 5 local tables (`items`,
  `itemInstances`, `activityLogs`, `itemRelations`, `appSettings`) inside a transaction and
  bulk-inserts the payload's rows. Existing `useLiveQuery`-based hooks (`useDb.ts`) pick up
  the change automatically — no manual cache invalidation needed.
- Restore is always explicit and manual — never triggered automatically (e.g. never
  "restore on fresh install"), so it can't clobber data the user is actively creating.

## Testing

- Manual test plan (no automated test suite exists for `apps/mobile` currently):
  1. Sign in with existing web-app credentials from Profile → confirms immediate backup
     push (verify row appears in Supabase dashboard).
  2. Add/edit/delete a few items, background the app → confirms a new backup row appears
     and older rows beyond 5 are pruned.
  3. Tap "Back up now" → confirms an on-demand push works.
  4. Sign out and back in on the same device → "Last backup" status reflects the prior
     push correctly.
  5. Make local changes, tap "Restore latest backup", confirm the dialog, confirm →
     verify local data reverts to the backed-up state and all screens (Home, Inbox, Tasks,
     etc.) reflect it via live queries.
  6. Airplane mode → "Back up now" fails silently (no crash, no error toast) → toggle
     network back on, background the app → next automatic push succeeds.

## Open questions / follow-ups (not blocking this spec)

- Full bidirectional mobile↔web sync (schema reconciliation, real-time, conflict
  resolution) remains a separate, larger future project — tracked as "Supabase sync wired
  to backgroundSync.ts" in `docs/migration/REACT_NATIVE_SETUP.md`.
- Whether to eventually let mobile browse/select from older snapshots (not just latest) —
  deferred; the 5-snapshot retention makes this possible later without a schema change.
