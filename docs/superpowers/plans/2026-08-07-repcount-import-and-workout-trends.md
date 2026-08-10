# RepCount CSV Import + Workout Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) A Mac-side Node script that imports a RepCount CSV workout export into Firestore via the app's own Firebase client SDK, so existing on-device sync pulls it into SQLite automatically. (2) A new in-app "Workout Trends" screen inside Workouts with four visualizations built from real workout-session/activityLog data (imported + future).

**Architecture:** Part 1 is a standalone Node toolchain under `scripts/repcount-import/` — pure CSV-parsing/record-building logic with zero Firebase imports (independently testable with Node's built-in test runner), plus a thin CLI entry point that authenticates, dry-runs, and optionally commits via `firebase/firestore`'s `BulkWriter`. Part 2 adds three new capped SQL queries to `database.ts`, a pure aggregation module (`workoutTrends.ts`), three new SVG chart components following the app's existing `RiverStoneProgress`/`FocusTimelineCard` conventions, and one new screen wired into the existing `MenuStack`/`WorkoutsScreen`.

**Tech Stack:** Node 24 (native `--experimental-strip-types --test`, no ts-node/jest), `firebase` v12 (modular SDK, works identically in Node), `uuid` v14, React Native + Expo (existing app stack), `react-native-svg` + Reanimated (existing chart conventions).

## Global Constraints

- Weight unit is CLI-flag-driven (`--unit=kg|lb`, default `kg`), never assumed or asked per-row.
- The import script is a **dry run by default**; writes only happen with an explicit `--commit` flag, and the same summary prints in both modes before any write.
- Password for the Firestore sign-in is prompted interactively at runtime — never a CLI arg, never written to a file.
- Re-running the import must be idempotent: sessions already tagged with a given `sourceStartAt` are skipped, not duplicated.
- Existing `exercise` items are never modified on a title match (no overwriting muscle group/metadata).
- No on-device CSV import UI, no Kcal/Distance/Duration/Bodyweight mapping, no estimated-1RM metric — all explicitly out of scope per the spec.
- Muscle-group balance reuses the existing `RiverStoneProgress` component — no new radial/donut widget.
- New screen registers in the existing `MenuStack` alongside `WorkoutsScreen`/`WorkoutTemplateDetailScreen`, not a new top-level nav item.

---

## File Structure

**Part 1 — Mac-side import (new directory, isolated from the RN app):**
- `scripts/repcount-import/musclegroups.mjs` — `Category` → `MuscleGroup` mapping table + `mapCategoryToMuscleGroup(category)`.
- `scripts/repcount-import/movementFamily.mjs` — ported copy of `inferMovementFamily` from `apps/mobile/src/utils/exerciseLibrary.ts` (can't cross the module boundary from a plain Node script).
- `scripts/repcount-import/parse.mjs` — CSV line parsing, session grouping, record building. Zero Firebase imports; pure functions only.
- `scripts/repcount-import/parse.test.mjs` — Node test-runner tests for the above.
- `scripts/import-repcount.mjs` — CLI entry point: env loading, Firebase auth, Firestore read (existing exercises + already-imported `sourceStartAt`s), dry-run summary, `--commit` write via `BulkWriter`.

**Part 2 — in-app Trends screen:**
- `apps/mobile/src/db/database.ts` — add three new query functions (see Task 6).
- `apps/mobile/src/utils/workoutTrends.ts` — pure aggregation functions over the query results.
- `apps/mobile/src/utils/workoutTrends.test.ts` — Node test-runner tests (matches `workoutSet.test.ts`'s pattern).
- `apps/mobile/src/components/workouts/WorkoutFrequencyHeatmap.tsx` — new.
- `apps/mobile/src/components/workouts/ExerciseProgressionChart.tsx` — new.
- `apps/mobile/src/components/workouts/VolumeBarChart.tsx` — new.
- `apps/mobile/src/components/workouts/MuscleBalanceList.tsx` — new (thin wrapper around existing `RiverStoneProgress`, per spec — not a new indicator shape).
- `apps/mobile/src/screens/WorkoutTrendsScreen.tsx` — new, composes the four visualizations.
- `apps/mobile/src/screens/WorkoutsScreen.tsx` — add a "Trends" entry row.
- `apps/mobile/src/navigation/MenuStack.tsx` — register `WorkoutTrends` screen.

---

## Part 1: Mac-side import script

### Task 1: Muscle group mapping + movement family inference (pure modules)

**Files:**
- Create: `scripts/repcount-import/musclegroups.mjs`
- Create: `scripts/repcount-import/movementFamily.mjs`
- Test: `scripts/repcount-import/parse.test.mjs` (covers all three modules in this file group — see Task 2, tests land together since `parse.mjs` composes them)

**Interfaces:**
- Produces: `mapCategoryToMuscleGroup(category: string | undefined): MuscleGroup` from `musclegroups.mjs`.
- Produces: `inferMovementFamily(title: string): string` from `movementFamily.mjs` (returns `'other'` on no match, mirrors the app's own function).

- [ ] **Step 1: Write `musclegroups.mjs`**

```javascript
// scripts/repcount-import/musclegroups.mjs
// Mirrors apps/mobile/src/utils/exerciseLibrary.ts's MuscleGroup union so
// imported exercises are classified the same way the app classifies its own.
// Kept as a manual copy (see movementFamily.mjs) since this script can't
// import across the apps/mobile module boundary.

const CATEGORY_TO_MUSCLE_GROUP = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  arms: 'arms',
  forearms: 'arms',
  legs: 'legs',
  quads: 'legs',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abs: 'core',
  core: 'core',
  cardio: 'cardio',
  'full body': 'full-body',
  'full-body': 'full-body',
};

export function mapCategoryToMuscleGroup(category) {
  if (!category) return 'full-body';
  const key = category.trim().toLowerCase();
  return CATEGORY_TO_MUSCLE_GROUP[key] ?? 'full-body';
}
```

- [ ] **Step 2: Write `movementFamily.mjs`**

```javascript
// scripts/repcount-import/movementFamily.mjs
// Ported copy of apps/mobile/src/utils/exerciseLibrary.ts's
// MOVEMENT_FAMILY_RULES/inferMovementFamily. Any future change to the app's
// classifier won't automatically propagate here — acceptable since this
// script is a one-time-use import tool, not a long-lived shared surface.

const MOVEMENT_FAMILY_RULES = [
  ['chest-stretch', /chest stretch/i],
  ['triceps-stretch', /triceps stretch/i],
  ['forearm-stretch', /forearm stretch/i],
  ['arm-bar', /arm bar/i],
  ['mobility', /childs pose|arm swings/i],
  ['renegade-row', /renegade row/i],
  ['inverted-row', /inverted row/i],
  ['face-pull', /face pull|reverse fly|rear delt fly/i],
  ['lat-pulldown', /lat pulldown/i],
  ['pull-up', /pull up|pull ups|chin up/i],
  ['triceps-pushdown', /tricep pushdown|triceps pushdown/i],
  ['triceps-kickback', /tricep kickback/i],
  ['wrist-curl', /wrist curl|finger curl/i],
  ['wrist-mobility', /^wrist$|wrist twist|wrist adduction/i],
  ['lunge', /lunge/i],
  ['biceps-curl', /curl/i],
  ['triceps-extension', /tricep|triceps|skull crusher|seated cable extension/i],
  ['push-up', /push up|push ups/i],
  ['chest-press', /bench press|chest press|incline machine press|close grip press|floor press|svend press|tate press/i],
  ['chest-fly', /fly|crossover/i],
  ['dip', /\bdip\b|\bdips\b/i],
  ['pullover', /pullover/i],
  ['row', /\brow\b|\brows\b/i],
  ['shrug', /shrug/i],
  ['deadlift', /deadlift|rack pull/i],
  ['squat', /squat/i],
  ['good-morning', /good morning/i],
  ['back-extension', /hyper extension/i],
  ['plank', /plank/i],
  ['bird-dog', /bird dog/i],
  ['burpee', /burpees?/i],
  ['crab-walk', /crab walk/i],
];

export function inferMovementFamily(title) {
  return MOVEMENT_FAMILY_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'other';
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/repcount-import/musclegroups.mjs scripts/repcount-import/movementFamily.mjs
git commit -m "feat: add RepCount import muscle-group and movement-family classifiers"
```

---

### Task 2: CSV parsing and session/record building (`parse.mjs`)

**Files:**
- Create: `scripts/repcount-import/parse.mjs`
- Create: `scripts/repcount-import/parse.test.mjs`

**Interfaces:**
- Consumes: `mapCategoryToMuscleGroup` from `musclegroups.mjs`, `inferMovementFamily` from `movementFamily.mjs` (Task 1).
- Produces:
  - `parseCsv(text: string): string[][]` — quote-aware line/field split, header row included as `rows[0]`.
  - `groupRowsIntoSessions(rows: string[][]): RawSession[]` where `RawSession = { workoutStart: string, workoutEnd: string, name: string, rows: Record<string,string>[] }` (rows already have blank Weight+Reps rows dropped, `Record<string,string>` keyed by header).
  - `buildImportRecords(sessions: RawSession[], unit: 'kg'|'lb'): ImportSession[]` where:
    ```
    ImportSession = {
      sourceStartAtMs: number,
      workoutStartLocal: string,   // 'YYYY-MM-DD HH:mm'
      scheduledDate: string,        // 'YYYY-MM-DD'
      title: string,                // CSV Name
      sets: ImportSet[],
    }
    ImportSet = {
      exerciseTitle: string,
      muscleGroup: string,
      movementFamily: string,
      setNumber: number,
      reps: number,
      weight: number,
      weightUnit: 'kg' | 'lb',
    }
    ```

- [ ] **Step 1: Write the failing tests**

```javascript
// scripts/repcount-import/parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, groupRowsIntoSessions, buildImportRecords } from './parse.mjs';

const SAMPLE_CSV = [
  'Workout Start,Workout End,Exercise,Weight,Reps,Notes,Kcal,Distance,Duration,Category,Name,Bodyweight',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",10,12,"easy",,,,Chest,"Energym Push",',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",14,12,"easy but not SUPER easy",,,,Chest,"Energym Push",',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",,,"",,,,Chest,"Energym Push",',
  '2025-10-15 06:12,2025-10-15 06:45,"Albany Tricep Pushdown",17.5,12,"",,,,Triceps,"Make Shift Full Body",',
].join('\n');

test('parseCsv splits quoted fields with embedded commas correctly', () => {
  const rows = parseCsv('a,"b, c",d\n1,2,3');
  assert.deepEqual(rows, [
    ['a', 'b, c', 'd'],
    ['1', '2', '3'],
  ]);
});

test('groupRowsIntoSessions groups by (Workout Start, Workout End, Name) and drops blank Weight+Reps rows', () => {
  const rows = parseCsv(SAMPLE_CSV);
  const sessions = groupRowsIntoSessions(rows);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].name, 'Energym Push');
  assert.equal(sessions[0].rows.length, 2); // third row (blank Weight+Reps) dropped
  assert.equal(sessions[1].name, 'Make Shift Full Body');
  assert.equal(sessions[1].rows.length, 1);
});

test('buildImportRecords assigns per-exercise set numbers, maps muscle group, and computes sourceStartAtMs/scheduledDate', () => {
  const rows = parseCsv(SAMPLE_CSV);
  const sessions = groupRowsIntoSessions(rows);
  const records = buildImportRecords(sessions, 'kg');

  assert.equal(records.length, 2);
  const [pushSession, fullBodySession] = records;

  assert.equal(pushSession.title, 'Energym Push');
  assert.equal(pushSession.scheduledDate, '2025-10-17');
  assert.equal(pushSession.sourceStartAtMs, new Date('2025-10-17T03:34:00').getTime());
  assert.equal(pushSession.sets.length, 2);
  assert.equal(pushSession.sets[0].setNumber, 1);
  assert.equal(pushSession.sets[0].weight, 10);
  assert.equal(pushSession.sets[0].reps, 12);
  assert.equal(pushSession.sets[0].muscleGroup, 'chest');
  assert.equal(pushSession.sets[0].weightUnit, 'kg');
  assert.equal(pushSession.sets[1].setNumber, 2);

  assert.equal(fullBodySession.sets[0].muscleGroup, 'arms'); // Triceps -> arms
  assert.equal(fullBodySession.sets[0].weight, 17.5);
});

test('buildImportRecords assigns setNumber per exercise, not per session, when a session has multiple exercises', () => {
  const csv = [
    'Workout Start,Workout End,Exercise,Weight,Reps,Notes,Kcal,Distance,Duration,Category,Name,Bodyweight',
    '2025-11-01 08:00,2025-11-01 08:30,"Squat",100,5,"",,,,Legs,"Leg Day",',
    '2025-11-01 08:00,2025-11-01 08:30,"Lunge",20,10,"",,,,Legs,"Leg Day",',
    '2025-11-01 08:00,2025-11-01 08:30,"Squat",105,5,"",,,,Legs,"Leg Day",',
  ].join('\n');
  const records = buildImportRecords(groupRowsIntoSessions(parseCsv(csv)), 'lb');
  const squats = records[0].sets.filter((s) => s.exerciseTitle === 'Squat');
  assert.deepEqual(squats.map((s) => s.setNumber), [1, 2]);
  const lunges = records[0].sets.filter((s) => s.exerciseTitle === 'Lunge');
  assert.deepEqual(lunges.map((s) => s.setNumber), [1]);
  assert.equal(records[0].sets[0].weightUnit, 'lb');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/repcount-import/parse.test.mjs`
Expected: FAIL — `parse.mjs` doesn't exist yet (module not found).

- [ ] **Step 3: Write `parse.mjs`**

```javascript
// scripts/repcount-import/parse.mjs
import { mapCategoryToMuscleGroup } from './musclegroups.mjs';
import { inferMovementFamily } from './movementFamily.mjs';

const HEADERS = [
  'Workout Start', 'Workout End', 'Exercise', 'Weight', 'Reps', 'Notes',
  'Kcal', 'Distance', 'Duration', 'Category', 'Name', 'Bodyweight',
];

// Quote-aware CSV parser for this specific export shape: no escaped quotes
// inside quoted fields in the sample data, so a simple state machine over
// commas/quotes is sufficient without pulling in an external CSV library.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      if (field !== '' || row.length > 0) pushRow();
    } else if (c === '\r') {
      // ignore, \n handles the row break
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return rows;
}

function rowsToRecords(rows) {
  const [header, ...dataRows] = rows;
  return dataRows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
}

// Groups CSV data rows (already header-stripped) into sessions keyed by the
// exact (Workout Start, Workout End, Name) triple, in file order, dropping
// any row where both Weight and Reps are blank.
export function groupRowsIntoSessions(rows) {
  const records = rowsToRecords(rows);
  const sessions = [];
  const sessionByKey = new Map();

  for (const rec of records) {
    const weight = rec['Weight']?.trim();
    const reps = rec['Reps']?.trim();
    if (!weight && !reps) continue;

    const key = `${rec['Workout Start']}|${rec['Workout End']}|${rec['Name']}`;
    let session = sessionByKey.get(key);
    if (!session) {
      session = { workoutStart: rec['Workout Start'], workoutEnd: rec['Workout End'], name: rec['Name'], rows: [] };
      sessionByKey.set(key, session);
      sessions.push(session);
    }
    session.rows.push(rec);
  }

  return sessions;
}

// Parses 'YYYY-MM-DD HH:mm' as local time (no timezone in the export —
// treated as the machine's local timezone when the script runs).
function parseLocalDateTime(value) {
  const [datePart, timePart] = value.trim().split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function toScheduledDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Builds the final per-session, per-set import records: set numbers are
// assigned 1-based per exercise per session, in file order.
export function buildImportRecords(sessions, unit) {
  return sessions.map((session) => {
    const startDate = parseLocalDateTime(session.workoutStart);
    const setNumberByExercise = new Map();

    const sets = session.rows.map((row) => {
      const exerciseTitle = row['Exercise'].trim();
      const n = (setNumberByExercise.get(exerciseTitle) ?? 0) + 1;
      setNumberByExercise.set(exerciseTitle, n);

      return {
        exerciseTitle,
        muscleGroup: mapCategoryToMuscleGroup(row['Category']),
        movementFamily: inferMovementFamily(exerciseTitle),
        setNumber: n,
        reps: Number(row['Reps']) || 0,
        weight: Number(row['Weight']) || 0,
        weightUnit: unit,
      };
    });

    return {
      sourceStartAtMs: startDate.getTime(),
      workoutStartLocal: session.workoutStart,
      scheduledDate: toScheduledDate(startDate),
      title: session.name,
      sets,
    };
  });
}

export { HEADERS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/repcount-import/parse.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/repcount-import/parse.mjs scripts/repcount-import/parse.test.mjs
git commit -m "feat: add RepCount CSV parsing and session-building logic"
```

---

### Task 3: CLI entry point — dry run, exercise matching, dedup, Firestore write

**Files:**
- Create: `scripts/import-repcount.mjs`
- Modify: `apps/mobile/package.json` — none needed (script lives at repo root, run directly with `node`)

**Interfaces:**
- Consumes: `parseCsv`, `groupRowsIntoSessions`, `buildImportRecords` from `scripts/repcount-import/parse.mjs` (Task 2).
- Produces: a runnable CLI (`node scripts/import-repcount.mjs <csv> --email=... [--unit=kg|lb] [--commit]`). No exported functions consumed elsewhere — this is the terminal script.

This script is not unit-tested (it's an I/O-heavy CLI wrapper around already-tested pure logic, consistent with the spec's "no Firebase/Firestore code in the tested module" design) — verified instead via a real dry run against the user's CSV in Task 4.

- [ ] **Step 1: Write the script**

```javascript
#!/usr/bin/env node
// scripts/import-repcount.mjs
//
// One-time Mac-side importer: reads a RepCount CSV export and writes
// workout-session items + workout-set-logged activityLogs to Firestore
// under the signed-in user's own uid, in the exact document shape
// apps/mobile/src/services/firestoreSync.ts's onSnapshot handlers expect —
// no app code changes needed for the data to sync down and become fully
// functional local data next time the app is open.
//
// Usage:
//   node scripts/import-repcount.mjs <path-to-csv> --email=you@example.com [--unit=kg|lb] [--commit]

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, writeBatch, WriteBatch } from 'firebase/firestore';

import { parseCsv, groupRowsIntoSessions, buildImportRecords } from './repcount-import/parse.mjs';
import { inferMovementFamily } from './repcount-import/movementFamily.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

// Reads apps/mobile/.env.local's EXPO_PUBLIC_FIREBASE_* values directly —
// no separate config step for this script, same values the app itself uses.
function loadFirebaseConfig() {
  const envPath = path.resolve(__dirname, '..', 'apps', 'mobile', '.env.local');
  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — this script reads Firebase config from the app's own .env.local.`);
  }
  const text = readFileSync(envPath, 'utf8');
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  const cfg = {
    apiKey: vars.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: vars.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: vars.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: vars.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: vars.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: vars.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    throw new Error('apps/mobile/.env.local is missing one or more required EXPO_PUBLIC_FIREBASE_* values.');
  }
  return cfg;
}

function promptPassword(promptText) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // Best-effort no-echo: Node's readline has no built-in silent mode without
    // touching raw stdin manually. Muting the write stream is the standard
    // workaround for CLI password prompts.
    const stdin = process.stdin;
    let muted = false;
    const originalWrite = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = function writeToOutput(stringToWrite) {
      if (!muted) originalWrite ? originalWrite(stringToWrite) : rl.output.write(stringToWrite);
    };
    rl.question(promptText, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const csvPath = positional[0];
  if (!csvPath) {
    console.error('Usage: node scripts/import-repcount.mjs <path-to-csv> --email=you@example.com [--unit=kg|lb] [--commit]');
    process.exit(1);
  }
  if (!flags.email) {
    console.error('Missing required --email=you@example.com');
    process.exit(1);
  }
  const unit = flags.unit === 'lb' ? 'lb' : 'kg';
  const commit = Boolean(flags.commit);

  console.log(`[repcount-import] Reading ${csvPath}...`);
  const csvText = readFileSync(path.resolve(csvPath), 'utf8');
  const rawSessions = groupRowsIntoSessions(parseCsv(csvText));
  const importSessions = buildImportRecords(rawSessions, unit);

  const totalSets = importSessions.reduce((sum, s) => sum + s.sets.length, 0);
  const dates = importSessions.map((s) => s.sourceStartAtMs).sort((a, b) => a - b);
  console.log(`[repcount-import] Parsed ${importSessions.length} sessions, ${totalSets} sets.`);
  if (dates.length > 0) {
    console.log(`[repcount-import] Date range: ${new Date(dates[0]).toLocaleDateString()} -> ${new Date(dates[dates.length - 1]).toLocaleDateString()}`);
  }
  console.log('[repcount-import] Timezone note: Workout Start/End have no timezone in the export; parsed as this machine\'s local timezone. If RepCount was used while traveling, some session dates could be off by a day at the boundary.');

  const firebaseConfig = loadFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const password = await promptPassword(`Password for ${flags.email}: `);
  console.log('[repcount-import] Signing in...');
  const cred = await signInWithEmailAndPassword(auth, flags.email, password);
  const uid = cred.user.uid;
  console.log(`[repcount-import] Signed in as ${flags.email} (uid ${uid}).`);

  console.log('[repcount-import] Fetching existing exercises and imported sessions from Firestore...');
  const itemsSnap = await getDocs(collection(firestore, 'users', uid, 'items'));
  const existingExercisesByTitle = new Map(); // lowercase title -> item id
  const alreadyImportedStartAts = new Set();
  itemsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.type === 'exercise' && typeof data.title === 'string') {
      existingExercisesByTitle.set(data.title.toLowerCase(), docSnap.id);
    }
    if (data.type === 'workout-session') {
      try {
        const meta = data.metadata ? JSON.parse(data.metadata) : null;
        if (meta?.importSource === 'repcount' && typeof meta.sourceStartAt === 'number') {
          alreadyImportedStartAts.add(meta.sourceStartAt);
        }
      } catch {
        // ignore malformed metadata on unrelated rows
      }
    }
  });

  const toImport = importSessions.filter((s) => !alreadyImportedStartAts.has(s.sourceStartAtMs));
  const skippedCount = importSessions.length - toImport.length;

  const newExerciseTitles = new Set();
  for (const session of toImport) {
    for (const set of session.sets) {
      if (!existingExercisesByTitle.has(set.exerciseTitle.toLowerCase())) {
        newExerciseTitles.add(set.exerciseTitle);
      }
    }
  }

  console.log(`[repcount-import] Sessions to skip (already imported): ${skippedCount}`);
  console.log(`[repcount-import] Net-new sessions to create: ${toImport.length}`);
  console.log(`[repcount-import] Net-new sets to create: ${toImport.reduce((sum, s) => sum + s.sets.length, 0)}`);
  console.log(`[repcount-import] Exercises matched to existing: ${new Set(toImport.flatMap((s) => s.sets.map((set) => set.exerciseTitle.toLowerCase()))).size - newExerciseTitles.size}`);
  console.log(`[repcount-import] Exercises to newly create (${newExerciseTitles.size}): ${[...newExerciseTitles].join(', ') || '(none)'}`);
  console.log(`[repcount-import] Weight unit applied: ${unit}`);

  if (!commit) {
    console.log('[repcount-import] Dry run only (pass --commit to write). No changes made.');
    process.exit(0);
  }

  if (toImport.length === 0) {
    console.log('[repcount-import] Nothing new to import. Exiting.');
    process.exit(0);
  }

  console.log('[repcount-import] Writing to Firestore...');
  const exerciseIdByTitle = new Map(existingExercisesByTitle);
  let batch = writeBatch(firestore);
  let opsInBatch = 0;
  const BATCH_LIMIT = 450; // stay under Firestore's 500-ops-per-batch cap with headroom

  async function flushIfNeeded() {
    if (opsInBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(firestore);
      opsInBatch = 0;
    }
  }

  async function setDocBatched(ref, data) {
    batch.set(ref, data, { merge: true });
    opsInBatch += 1;
    await flushIfNeeded();
  }

  try {
    for (const title of newExerciseTitles) {
      const id = uuid();
      const now = Date.now();
      // Use the muscle group from whichever set first referenced this title.
      const firstSet = toImport.flatMap((s) => s.sets).find((s) => s.exerciseTitle === title);
      const metadata = JSON.stringify({ muscleGroup: firstSet.muscleGroup, movementFamily: inferMovementFamily(title) });
      await setDocBatched(doc(firestore, 'users', uid, 'items', id), {
        id, type: 'exercise', title, status: 'active', metadata, createdAt: now, updatedAt: now, userId: uid,
      });
      exerciseIdByTitle.set(title.toLowerCase(), id);
    }

    for (const session of toImport) {
      const sessionId = uuid();
      const metadata = JSON.stringify({ importSource: 'repcount', sourceStartAt: session.sourceStartAtMs });
      await setDocBatched(doc(firestore, 'users', uid, 'items', sessionId), {
        id: sessionId,
        type: 'workout-session',
        title: session.title,
        status: 'completed',
        scheduledDate: session.scheduledDate,
        metadata,
        createdAt: session.sourceStartAtMs,
        updatedAt: session.sourceStartAtMs,
        userId: uid,
      });

      for (const set of session.sets) {
        const exerciseId = exerciseIdByTitle.get(set.exerciseTitle.toLowerCase());
        const logId = uuid();
        const details = JSON.stringify({
          sessionId, setNumber: set.setNumber, reps: set.reps, weight: set.weight,
          weightUnit: set.weightUnit, imported: true,
        });
        await setDocBatched(doc(firestore, 'users', uid, 'activityLogs', logId), {
          id: logId, entityId: exerciseId, actionType: 'workout-set-logged',
          timestamp: session.sourceStartAtMs, details, createdAt: session.sourceStartAtMs,
        });
      }
    }

    if (opsInBatch > 0) await batch.commit();
    console.log(`[repcount-import] Done. Imported ${toImport.length} sessions, ${newExerciseTitles.size} new exercises.`);
  } catch (err) {
    console.error('[repcount-import] Write failed — this is likely a Firestore security-rules permission error if it happened on the very first write:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[repcount-import] Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Install script dependencies at repo root**

The script imports `firebase` and `uuid`, both already dependencies of `apps/mobile` but not the repo root. Check root `package.json` first:

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os" && cat package.json 2>/dev/null | grep -E '"firebase"|"uuid"' || echo "no root package.json or missing deps"`

If missing, install at root:

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
npm install firebase uuid --save
```

- [ ] **Step 3: Commit**

```bash
git add scripts/import-repcount.mjs package.json package-lock.json
git commit -m "feat: add RepCount import CLI (dry-run by default, --commit to write)"
```

---

### Task 4: Real dry run against the user's CSV, then a real commit

**Files:** none (verification task, no code changes)

- [ ] **Step 1: Run a dry run against the real export**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
node scripts/import-repcount.mjs ~/Downloads/"repcount_export_5 Aug 2026.csv" --email=<the user's real account email>
```

Expected: prints total sessions/sets, date range, 0 skipped (first run), a list of new exercises, unit `kg`, and exits without writing. Confirm the session/set counts look sane against `wc -l` of the CSV (3527 data rows for 3528 total lines including header).

- [ ] **Step 2: Ask the user to confirm the dry-run summary before writing real data**

Show the user the dry-run output (sessions found, date range, new-exercise list, unit). Get explicit confirmation before proceeding — this writes real historical data to their production Firestore account.

- [ ] **Step 3: Run the real commit**

```bash
node scripts/import-repcount.mjs ~/Downloads/"repcount_export_5 Aug 2026.csv" --email=<email> --commit
```

Expected: same summary, then "Writing to Firestore...", then "Done. Imported N sessions, M new exercises."

- [ ] **Step 4: Re-run the dry run once more to confirm idempotency**

```bash
node scripts/import-repcount.mjs ~/Downloads/"repcount_export_5 Aug 2026.csv" --email=<email>
```

Expected: "Sessions to skip (already imported): N" matches the count just committed, "Net-new sessions to create: 0".

---

## Part 2: Workout Trends screen

### Task 5: Three new SQL query functions in `database.ts`

**Files:**
- Modify: `apps/mobile/src/db/database.ts`
- Test: `apps/mobile/src/utils/workoutTrends.test.ts` (Task 6 exercises these indirectly via aggregation function tests using hand-built row fixtures — these three functions are thin SQL wrappers, verified by manual on-device check in Task 8, matching the existing pattern where `database.ts` query functions aren't unit-tested directly, e.g. `getLastSessionSetsForExercise`)

**Interfaces:**
- Produces:
  - `getWorkoutSessionDates(sinceMs: number): number[]`
  - `getExerciseSetLogHistory(exerciseId: string): ActivityLog[]`
  - `getWorkoutSetLogsInRange(startMs: number, endMs: number): ActivityLog[]`

- [ ] **Step 1: Add the three functions**

Add near `getLastSessionSetsForExercise` (around line 2735 in `apps/mobile/src/db/database.ts`):

```typescript
// All completed workout-session createdAt timestamps since sinceMs, for the
// Trends frequency heatmap.
export function getWorkoutSessionDates(sinceMs: number): number[] {
  const rows = getDb().getAllSync<{ createdAt: number }>(
    `SELECT createdAt FROM items WHERE type = 'workout-session' AND status = 'completed' AND createdAt >= ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
    [sinceMs]
  );
  return rows.map((r) => r.createdAt);
}

// All workout-set-logged rows for one exercise, oldest first — unlike
// getLastSessionSetsForExercise (capped at 200, most-recent-first, for "last
// time" lookups), this is uncapped and chronological for a full progression chart.
export function getExerciseSetLogHistory(exerciseId: string): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'workout-set-logged' ORDER BY timestamp ASC`,
    [exerciseId]
  );
}

// All workout-set-logged rows across every exercise in a time window, for
// volume and muscle-group-balance aggregation.
export function getWorkoutSetLogsInRange(startMs: number, endMs: number): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'workout-set-logged' AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`,
    [startMs, endMs]
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile" && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/db/database.ts
git commit -m "feat: add workout-trends SQL queries (session dates, exercise history, range logs)"
```

---

### Task 6: Pure aggregation functions (`workoutTrends.ts`)

**Files:**
- Create: `apps/mobile/src/utils/workoutTrends.ts`
- Create: `apps/mobile/src/utils/workoutTrends.test.ts`

**Interfaces:**
- Consumes: `ActivityLog` from `../db/types`, `parseSetLogDetails` from `./workoutSet.ts` (existing), `MuscleGroup` from `./exerciseLibrary.ts` (existing).
- Produces:
  - `computeExerciseProgression(logs: ActivityLog[]): { sessionDate: number; topWeight: number }[]`
  - `computeVolumeByPeriod(logs: ActivityLog[], period: 'week' | 'month'): { periodLabel: string; periodStart: number; totalVolume: number }[]`
  - `computeMuscleGroupBalance(logs: ActivityLog[], exerciseMuscleGroupById: Record<string, MuscleGroup>): { muscleGroup: MuscleGroup; volume: number; percent: number }[]`
  - `computeFrequencyHeatmap(sessionDates: number[], sinceMs: number, untilMs: number): { date: string; count: number }[]`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/utils/workoutTrends.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExerciseProgression,
  computeVolumeByPeriod,
  computeMuscleGroupBalance,
  computeFrequencyHeatmap,
} from './workoutTrends.ts';

function log(id: string, entityId: string, timestamp: number, details: object) {
  return { id, entityId, actionType: 'workout-set-logged', timestamp, details: JSON.stringify(details), createdAt: timestamp };
}

test('computeExerciseProgression takes the max weight per session, sorted by date', () => {
  const day1 = new Date('2026-01-01').getTime();
  const day2 = new Date('2026-01-08').getTime();
  const logs = [
    log('1', 'ex1', day2, { sessionId: 's2', setNumber: 1, reps: 8, weight: 60 }),
    log('2', 'ex1', day1, { sessionId: 's1', setNumber: 1, reps: 8, weight: 50 }),
    log('3', 'ex1', day1, { sessionId: 's1', setNumber: 2, reps: 6, weight: 55 }),
  ];
  const result = computeExerciseProgression(logs);
  assert.deepEqual(result, [
    { sessionDate: day1, topWeight: 55 },
    { sessionDate: day2, topWeight: 60 },
  ]);
});

test('computeVolumeByPeriod sums reps * weight bucketed by week', () => {
  const jan1 = new Date('2026-01-01').getTime(); // Thursday
  const jan2 = new Date('2026-01-02').getTime(); // same ISO week
  const jan9 = new Date('2026-01-09').getTime(); // next ISO week
  const logs = [
    log('1', 'ex1', jan1, { sessionId: 's1', setNumber: 1, reps: 10, weight: 20 }), // 200
    log('2', 'ex1', jan2, { sessionId: 's1', setNumber: 2, reps: 5, weight: 30 }),  // 150
    log('3', 'ex1', jan9, { sessionId: 's2', setNumber: 1, reps: 10, weight: 10 }), // 100
  ];
  const result = computeVolumeByPeriod(logs, 'week');
  assert.equal(result.length, 2);
  assert.equal(result[0].totalVolume, 350);
  assert.equal(result[1].totalVolume, 100);
});

test('computeVolumeByPeriod buckets by calendar month', () => {
  const jan15 = new Date('2026-01-15').getTime();
  const feb1 = new Date('2026-02-01').getTime();
  const logs = [
    log('1', 'ex1', jan15, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 }), // 100
    log('2', 'ex1', feb1, { sessionId: 's2', setNumber: 1, reps: 10, weight: 10 }),  // 100
  ];
  const result = computeVolumeByPeriod(logs, 'month');
  assert.equal(result.length, 2);
  assert.equal(result[0].periodLabel, '2026-01');
  assert.equal(result[1].periodLabel, '2026-02');
});

test('computeMuscleGroupBalance sums volume per muscle group and sorts descending by volume', () => {
  const t = Date.now();
  const logs = [
    log('1', 'ex-chest', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 }), // 100 chest
    log('2', 'ex-legs', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 30 }),  // 300 legs
    log('3', 'ex-chest', t, { sessionId: 's1', setNumber: 2, reps: 10, weight: 10 }), // +100 chest = 200
  ];
  const result = computeMuscleGroupBalance(logs, { 'ex-chest': 'chest', 'ex-legs': 'legs' });
  assert.deepEqual(result.map((r) => r.muscleGroup), ['legs', 'chest']);
  assert.equal(result[0].volume, 300);
  assert.equal(result[1].volume, 200);
  assert.equal(Math.round(result[0].percent), 60);
  assert.equal(Math.round(result[1].percent), 40);
});

test('computeMuscleGroupBalance skips sets whose exercise has no known muscle group', () => {
  const t = Date.now();
  const logs = [log('1', 'unknown-ex', t, { sessionId: 's1', setNumber: 1, reps: 10, weight: 10 })];
  const result = computeMuscleGroupBalance(logs, {});
  assert.deepEqual(result, []);
});

test('computeFrequencyHeatmap returns one entry per day in range with session counts, 0 for rest days', () => {
  const day0 = new Date('2026-01-01T09:00:00').getTime();
  const day0b = new Date('2026-01-01T18:00:00').getTime();
  const day2 = new Date('2026-01-03T09:00:00').getTime();
  const since = new Date('2026-01-01').getTime();
  const until = new Date('2026-01-03').getTime();
  const result = computeFrequencyHeatmap([day0, day0b, day2], since, until);
  assert.equal(result.length, 3);
  assert.equal(result[0].date, '2026-01-01');
  assert.equal(result[0].count, 2);
  assert.equal(result[1].date, '2026-01-02');
  assert.equal(result[1].count, 0);
  assert.equal(result[2].date, '2026-01-03');
  assert.equal(result[2].count, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/workoutTrends.test.ts`
Expected: FAIL — `workoutTrends.ts` doesn't exist.

- [ ] **Step 3: Write `workoutTrends.ts`**

```typescript
// apps/mobile/src/utils/workoutTrends.ts
import type { ActivityLog } from '../db/types';
import { parseSetLogDetails } from './workoutSet';
import type { MuscleGroup } from './exerciseLibrary';

export interface ExerciseProgressionPoint {
  sessionDate: number;
  topWeight: number;
}

// Groups by sessionId (from each log's details, not entityId) and takes the
// max weight logged for that exercise in that session — the spec's chosen
// progression metric (top set weight), not an estimated 1RM formula.
export function computeExerciseProgression(logs: ActivityLog[]): ExerciseProgressionPoint[] {
  const bySession = new Map<string, { date: number; topWeight: number }>();

  for (const log of logs) {
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const existing = bySession.get(set.sessionId);
    if (!existing) {
      bySession.set(set.sessionId, { date: log.timestamp, topWeight: set.weight });
    } else {
      existing.date = Math.min(existing.date, log.timestamp);
      existing.topWeight = Math.max(existing.topWeight, set.weight);
    }
  }

  return [...bySession.values()]
    .sort((a, b) => a.date - b.date)
    .map((s) => ({ sessionDate: s.date, topWeight: s.topWeight }));
}

export interface VolumePeriod {
  periodLabel: string;
  periodStart: number;
  totalVolume: number;
}

function isoWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Monday = 1 ... Sunday = 7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

function isoWeekLabel(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Sums reps * weight per set, bucketed by ISO week (Monday start) or
// calendar month, sorted chronologically.
export function computeVolumeByPeriod(logs: ActivityLog[], period: 'week' | 'month'): VolumePeriod[] {
  const buckets = new Map<string, { start: number; total: number }>();

  for (const log of logs) {
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const date = new Date(log.timestamp);
    let key: string;
    let start: number;

    if (period === 'week') {
      const weekStart = isoWeekStart(date);
      key = isoWeekLabel(weekStart);
      start = weekStart.getTime();
    } else {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      start = monthStart.getTime();
    }

    const existing = buckets.get(key);
    const volume = set.reps * set.weight;
    if (existing) existing.total += volume;
    else buckets.set(key, { start, total: volume });
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].start - b[1].start)
    .map(([label, { start, total }]) => ({ periodLabel: label, periodStart: start, totalVolume: total }));
}

export interface MuscleGroupVolume {
  muscleGroup: MuscleGroup;
  volume: number;
  percent: number;
}

// Sums volume per muscle group across sets, using the caller-supplied
// exerciseId -> muscleGroup lookup (sets for an exercise not in the map are
// skipped — e.g. the exercise was deleted after logging). Sorted descending
// by volume so the highest-volume group renders first.
export function computeMuscleGroupBalance(
  logs: ActivityLog[],
  exerciseMuscleGroupById: Record<string, MuscleGroup>
): MuscleGroupVolume[] {
  const volumeByGroup = new Map<MuscleGroup, number>();
  let total = 0;

  for (const log of logs) {
    const muscleGroup = exerciseMuscleGroupById[log.entityId];
    if (!muscleGroup) continue;
    const set = parseSetLogDetails(log.details);
    if (!set) continue;
    const volume = set.reps * set.weight;
    volumeByGroup.set(muscleGroup, (volumeByGroup.get(muscleGroup) ?? 0) + volume);
    total += volume;
  }

  return [...volumeByGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([muscleGroup, volume]) => ({ muscleGroup, volume, percent: total > 0 ? (volume / total) * 100 : 0 }));
}

export interface FrequencyDay {
  date: string;
  count: number;
}

function toDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// One entry per calendar day from sinceMs to untilMs inclusive, with the
// count of sessionDates falling on that day (0 for rest days) — the
// GitHub-contributions-style heatmap's data source.
export function computeFrequencyHeatmap(sessionDates: number[], sinceMs: number, untilMs: number): FrequencyDay[] {
  const countByDate = new Map<string, number>();
  for (const ts of sessionDates) {
    const key = toDateKey(ts);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }

  const days: FrequencyDay[] = [];
  const cursor = new Date(sinceMs);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(untilMs);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateKey(cursor.getTime());
    days.push({ date: key, count: countByDate.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/workoutTrends.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/utils/workoutTrends.ts apps/mobile/src/utils/workoutTrends.test.ts
git commit -m "feat: add pure workout-trends aggregation functions"
```

---

### Task 7: Chart components

**Files:**
- Create: `apps/mobile/src/components/workouts/WorkoutFrequencyHeatmap.tsx`
- Create: `apps/mobile/src/components/workouts/ExerciseProgressionChart.tsx`
- Create: `apps/mobile/src/components/workouts/VolumeBarChart.tsx`
- Create: `apps/mobile/src/components/workouts/MuscleBalanceList.tsx`

**Interfaces:**
- Consumes: `FrequencyDay`, `ExerciseProgressionPoint`, `VolumePeriod`, `MuscleGroupVolume` types from `../../utils/workoutTrends` (Task 6); `getThemeColors` from `../../theme`; `RiverStoneProgress` from `../ui/RiverStoneProgress`; `MUSCLE_GROUP_LABELS` from `../../utils/exerciseLibrary`.
- Produces: four React components consumed by `WorkoutTrendsScreen.tsx` (Task 8):
  - `<WorkoutFrequencyHeatmap days={FrequencyDay[]} isDark={boolean} />`
  - `<ExerciseProgressionChart points={ExerciseProgressionPoint[]} isDark={boolean} />`
  - `<VolumeBarChart periods={VolumePeriod[]} isDark={boolean} />`
  - `<MuscleBalanceList groups={MuscleGroupVolume[]} isDark={boolean} />`

- [ ] **Step 1: Write `WorkoutFrequencyHeatmap.tsx`**

```typescript
// apps/mobile/src/components/workouts/WorkoutFrequencyHeatmap.tsx
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { FrequencyDay } from '../../utils/workoutTrends';

const CELL = 12;
const GAP = 3;
const WEEKS = 16;

interface WorkoutFrequencyHeatmapProps {
  days: FrequencyDay[]; // must be exactly WEEKS * 7 days, oldest first, starting on a Monday
  isDark: boolean;
}

// GitHub-contributions-style grid: one column per week, one row per weekday,
// cell shade by session count that day. Uses the app's vermilion scale, not
// a foreign green.
export function WorkoutFrequencyHeatmap({ days, isDark }: WorkoutFrequencyHeatmapProps) {
  const palette = getThemeColors(isDark);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const width = WEEKS * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  const opacityForCount = (count: number) => {
    if (count === 0) return 0;
    return 0.25 + 0.75 * (count / maxCount);
  };

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>WORKOUT FREQUENCY</Text>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {days.map((day, i) => {
          const week = Math.floor(i / 7);
          const weekday = i % 7;
          const x = week * (CELL + GAP);
          const y = weekday * (CELL + GAP);
          const opacity = opacityForCount(day.count);
          return (
            <Rect
              key={day.date}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={3}
              fill={palette.vermilion}
              opacity={opacity === 0 ? 1 : opacity}
              stroke={opacity === 0 ? palette.separator : 'none'}
              strokeWidth={opacity === 0 ? 1 : 0}
              fillOpacity={opacity === 0 ? 0.06 : undefined}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
```

- [ ] **Step 2: Write `ExerciseProgressionChart.tsx`**

```typescript
// apps/mobile/src/components/workouts/ExerciseProgressionChart.tsx
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { ExerciseProgressionPoint } from '../../utils/workoutTrends';
import type { Item } from '../../db/types';

const VIEW_W = 320;
const VIEW_H = 140;
const PAD = 16;

interface ExerciseOption {
  item: Item;
}

interface ExerciseProgressionChartProps {
  exercises: ExerciseOption[]; // exercises that have at least one set log, caller-filtered
  points: ExerciseProgressionPoint[]; // for the currently selected exercise
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  weightUnit: string;
  isDark: boolean;
}

function buildLinePath(points: ExerciseProgressionPoint[]): { path: string; xs: number[]; ys: number[] } {
  if (points.length === 0) return { path: '', xs: [], ys: [] };
  const minDate = points[0].sessionDate;
  const maxDate = points[points.length - 1].sessionDate;
  const dateRange = Math.max(1, maxDate - minDate);
  const minWeight = Math.min(...points.map((p) => p.topWeight));
  const maxWeight = Math.max(...points.map((p) => p.topWeight));
  const weightRange = Math.max(1, maxWeight - minWeight);

  const xs = points.map((p) => PAD + ((p.sessionDate - minDate) / dateRange) * (VIEW_W - PAD * 2));
  const ys = points.map((p) => VIEW_H - PAD - ((p.topWeight - minWeight) / weightRange) * (VIEW_H - PAD * 2));

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  return { path, xs, ys };
}

// Exercise picker (search over exercises with at least one set log) plus an
// SVG line chart of top-set-weight-per-session over time.
export function ExerciseProgressionChart({
  exercises,
  points,
  selectedExerciseId,
  onSelectExercise,
  weightUnit,
  isDark,
}: ExerciseProgressionChartProps) {
  const palette = getThemeColors(isDark);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (query.trim() ? exercises.filter((e) => e.item.title.toLowerCase().includes(query.trim().toLowerCase())) : exercises),
    [exercises, query]
  );

  const { path, xs, ys } = useMemo(() => buildLinePath(points), [points]);
  const selectedTitle = exercises.find((e) => e.item.id === selectedExerciseId)?.item.title;

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>EXERCISE PROGRESSION</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={selectedTitle ?? 'Search exercises...'}
        placeholderTextColor={palette.textTertiary}
        style={[s.search, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]}
      />

      {query.trim().length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.item.id}
          style={s.suggestions}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.suggestionRow}
              onPress={() => {
                onSelectExercise(item.item.id);
                setQuery('');
              }}
            >
              <Text style={{ color: palette.text }}>{item.item.title}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedExerciseId && points.length === 0 && (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets for this exercise yet.</Text>
      )}

      {points.length > 0 && (
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Line x1={PAD} y1={VIEW_H - PAD} x2={VIEW_W - PAD} y2={VIEW_H - PAD} stroke={palette.separator} strokeWidth={1} />
          <Path d={path} fill="none" stroke={palette.vermilion} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, i) => (
            <Circle key={i} cx={x} cy={ys[i]} r={3} fill={palette.vermilion} />
          ))}
        </Svg>
      )}

      {points.length > 0 && (
        <Text style={[s.caption, { color: palette.textSecondary }]}>
          Top set: {points[points.length - 1].topWeight}{weightUnit} (most recent session)
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  suggestions: { maxHeight: 160, marginBottom: 8 },
  suggestionRow: { paddingVertical: 8, paddingHorizontal: 4 },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8 },
  caption: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 },
});
```

- [ ] **Step 3: Write `VolumeBarChart.tsx`**

```typescript
// apps/mobile/src/components/workouts/VolumeBarChart.tsx
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { VolumePeriod } from '../../utils/workoutTrends';

const VIEW_W = 320;
const VIEW_H = 120;
const BAR_GAP = 4;

interface VolumeBarChartProps {
  weeklyPeriods: VolumePeriod[];
  monthlyPeriods: VolumePeriod[];
  isDark: boolean;
}

// Simple SVG bar chart with a week/month toggle over a trailing window
// (weeklyPeriods/monthlyPeriods are pre-sliced by the caller to the desired
// trailing window, e.g. last 12 weeks / last 6 months).
export function VolumeBarChart({ weeklyPeriods, monthlyPeriods, isDark }: VolumeBarChartProps) {
  const palette = getThemeColors(isDark);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const periods = mode === 'week' ? weeklyPeriods : monthlyPeriods;
  const maxVolume = Math.max(1, ...periods.map((p) => p.totalVolume));
  const barWidth = periods.length > 0 ? (VIEW_W - BAR_GAP * (periods.length - 1)) / periods.length : 0;

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>TRAINING VOLUME</Text>
        <View style={s.toggle}>
          {(['week', 'month'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[
                s.toggleBtn,
                { backgroundColor: mode === m ? palette.vermilionSoft : 'transparent' },
              ]}
            >
              <Text style={[s.toggleText, { color: mode === m ? palette.vermilion : palette.textTertiary }]}>
                {m === 'week' ? 'Week' : 'Month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {periods.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {periods.map((p, i) => {
            const barHeight = (p.totalVolume / maxVolume) * (VIEW_H - 8);
            const x = i * (barWidth + BAR_GAP);
            const y = VIEW_H - barHeight;
            return <Rect key={p.periodLabel} x={x} y={y} width={barWidth} height={barHeight} rx={2} fill={palette.vermilion} />;
          })}
        </Svg>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  toggle: { flexDirection: 'row', gap: 4 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
```

- [ ] **Step 4: Write `MuscleBalanceList.tsx`**

```typescript
// apps/mobile/src/components/workouts/MuscleBalanceList.tsx
import { StyleSheet, Text, View } from 'react-native';
import { getThemeColors } from '../../theme';
import { RiverStoneProgress } from '../ui/RiverStoneProgress';
import { MUSCLE_GROUP_LABELS } from '../../utils/exerciseLibrary';
import type { MuscleGroupVolume } from '../../utils/workoutTrends';

interface MuscleBalanceListProps {
  groups: MuscleGroupVolume[]; // pre-sorted descending by volume
  isDark: boolean;
}

// Deliberately reuses RiverStoneProgress rather than a new radial/donut
// component — the app's design system favors reusing the existing linear-bar
// indicator over inventing new shapes for the same "share of total" job.
export function MuscleBalanceList({ groups, isDark }: MuscleBalanceListProps) {
  const palette = getThemeColors(isDark);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>MUSCLE GROUP BALANCE</Text>
      {groups.length === 0 ? (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets in this window yet.</Text>
      ) : (
        <View style={s.rows}>
          {groups.map((g) => (
            <View key={g.muscleGroup} style={s.row}>
              <Text style={[s.label, { color: palette.text }]}>{MUSCLE_GROUP_LABELS[g.muscleGroup]}</Text>
              <RiverStoneProgress
                progress={g.percent / 100}
                isDark={isDark}
                label={`${Math.round(g.percent)}%`}
                accessibilityLabel={`${MUSCLE_GROUP_LABELS[g.muscleGroup]} volume share`}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  rows: { gap: 10 },
  row: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
```

- [ ] **Step 5: Type-check**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile" && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/workouts/
git commit -m "feat: add Workout Trends chart components"
```

---

### Task 8: `WorkoutTrendsScreen.tsx` + navigation wiring + WorkoutsScreen entry point

**Files:**
- Create: `apps/mobile/src/screens/WorkoutTrendsScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/WorkoutsScreen.tsx`

**Interfaces:**
- Consumes: `getWorkoutSessionDates`, `getExerciseSetLogHistory`, `getWorkoutSetLogsInRange` from `../db/database` (Task 5); `computeExerciseProgression`, `computeVolumeByPeriod`, `computeMuscleGroupBalance`, `computeFrequencyHeatmap` from `../utils/workoutTrends` (Task 6); `WorkoutFrequencyHeatmap`, `ExerciseProgressionChart`, `VolumeBarChart`, `MuscleBalanceList` from `../components/workouts/*` (Task 7); `useExercises` from `../hooks/useDb` (existing, used by `ExerciseLibraryScreen.tsx`); `parseExerciseMeta` from `../utils/exerciseLibrary` (existing).

- [ ] **Step 1: Write `WorkoutTrendsScreen.tsx`**

```typescript
// apps/mobile/src/screens/WorkoutTrendsScreen.tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { LensSurface } from '../components/LensSurface';
import { WorkoutFrequencyHeatmap } from '../components/workouts/WorkoutFrequencyHeatmap';
import { ExerciseProgressionChart } from '../components/workouts/ExerciseProgressionChart';
import { VolumeBarChart } from '../components/workouts/VolumeBarChart';
import { MuscleBalanceList } from '../components/workouts/MuscleBalanceList';
import { useThemeContext } from '../hooks/useThemeContext';
import { useExercises } from '../hooks/useDb';
import { getWorkoutSessionDates, getExerciseSetLogHistory, getWorkoutSetLogsInRange } from '../db/database';
import {
  computeFrequencyHeatmap,
  computeExerciseProgression,
  computeVolumeByPeriod,
  computeMuscleGroupBalance,
} from '../utils/workoutTrends';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { parseSetLogDetails } from '../utils/workoutSet';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 16;
const VOLUME_WEEKS_WINDOW = 12;
const VOLUME_MONTHS_WINDOW = 6;
const BALANCE_WINDOW_DAYS = 30;

export function WorkoutTrendsScreen() {
  const { isDark } = useThemeContext();
  const { exercises } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const exercisesWithLogs = useMemo(() => {
    // Only exercises with at least one set log are offered in the picker —
    // computed once per exercise list change, not on every render, since
    // getExerciseSetLogHistory hits SQLite.
    return exercises
      .map((item) => ({ item, hasLogs: getExerciseSetLogHistory(item.id).length > 0 }))
      .filter((e) => e.hasLogs)
      .map((e) => ({ item: e.item }));
  }, [exercises]);

  const now = Date.now();

  const heatmapDays = useMemo(() => {
    const sinceMs = now - HEATMAP_WEEKS * 7 * DAY_MS;
    const sessionDates = getWorkoutSessionDates(sinceMs);
    return computeFrequencyHeatmap(sessionDates, sinceMs, now);
  }, [now]);

  const progressionPoints = useMemo(() => {
    if (!selectedExerciseId) return [];
    return computeExerciseProgression(getExerciseSetLogHistory(selectedExerciseId));
  }, [selectedExerciseId]);

  const selectedExerciseUnit = useMemo(() => {
    if (progressionPoints.length === 0 || !selectedExerciseId) return 'kg';
    const logs = getExerciseSetLogHistory(selectedExerciseId);
    const last = logs[logs.length - 1];
    return parseSetLogDetails(last?.details)?.weightUnit ?? 'kg';
  }, [selectedExerciseId, progressionPoints.length]);

  const weeklyVolume = useMemo(() => {
    const sinceMs = now - VOLUME_WEEKS_WINDOW * 7 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, now), 'week').slice(-VOLUME_WEEKS_WINDOW);
  }, [now]);

  const monthlyVolume = useMemo(() => {
    const sinceMs = now - VOLUME_MONTHS_WINDOW * 31 * DAY_MS;
    return computeVolumeByPeriod(getWorkoutSetLogsInRange(sinceMs, now), 'month').slice(-VOLUME_MONTHS_WINDOW);
  }, [now]);

  const muscleBalance = useMemo(() => {
    const sinceMs = now - BALANCE_WINDOW_DAYS * DAY_MS;
    const logs = getWorkoutSetLogsInRange(sinceMs, now);
    const exerciseMuscleGroupById = Object.fromEntries(
      exercises.map((item) => [item.id, parseExerciseMeta(item.metadata).muscleGroup])
    );
    return computeMuscleGroupBalance(logs, exerciseMuscleGroupById);
  }, [now, exercises]);

  return (
    <LensSurface title="Trends">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <WorkoutFrequencyHeatmap days={heatmapDays} isDark={isDark} />
        <ExerciseProgressionChart
          exercises={exercisesWithLogs}
          points={progressionPoints}
          selectedExerciseId={selectedExerciseId}
          onSelectExercise={setSelectedExerciseId}
          weightUnit={selectedExerciseUnit}
          isDark={isDark}
        />
        <VolumeBarChart weeklyPeriods={weeklyVolume} monthlyPeriods={monthlyVolume} isDark={isDark} />
        <MuscleBalanceList groups={muscleBalance} isDark={isDark} />
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
});
```

- [ ] **Step 2: Register the screen in `MenuStack.tsx`**

In `apps/mobile/src/navigation/MenuStack.tsx`, add the import near the other Workouts-related imports:

```typescript
import { WorkoutTrendsScreen } from '../screens/WorkoutTrendsScreen';
```

Add the `Stack.Screen` entry immediately after the existing `WorkoutTemplateDetail` line (around line 49):

```typescript
      <Stack.Screen name="WorkoutTrends" component={WorkoutTrendsScreen} />
```

- [ ] **Step 3: Add the entry point in `WorkoutsScreen.tsx`**

In `apps/mobile/src/screens/WorkoutsScreen.tsx`, add a "Trends" link next to the existing "Exercise Library →" link (around line 84-90). Replace:

```typescript
        <TouchableOpacity
          onPress={() => navigation.navigate('ExerciseLibrary' as never)}
          hitSlop={8}
          style={styles.libraryLink}
        >
          <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Exercise Library →</Text>
        </TouchableOpacity>
```

with:

```typescript
        <View style={styles.topLinksRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ExerciseLibrary' as never)}
            hitSlop={8}
          >
            <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Exercise Library →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('WorkoutTrends')}
            hitSlop={8}
          >
            <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Trends →</Text>
          </TouchableOpacity>
        </View>
```

And add `topLinksRow` to the `StyleSheet.create` block (near `libraryLink`):

```typescript
  topLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
```

- [ ] **Step 4: Type-check**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile" && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/screens/WorkoutTrendsScreen.tsx apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/WorkoutsScreen.tsx
git commit -m "feat: wire Workout Trends screen into Workouts section"
```

---

### Task 9: On-device verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev client and open Workouts**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npx expo start --dev-client --port 8082
```

Open the app on device, wait for Firestore sync to pull the imported RepCount data (confirm via the existing "Synced" indicator in `AppHeader.tsx`), navigate to Workouts.

- [ ] **Step 2: Verify the Trends entry point and each visualization**

- Tap "Trends →" — screen opens, no crash.
- Frequency heatmap renders with shaded cells on days matching imported/logged sessions.
- Exercise progression: search an imported exercise (e.g. "Dumbbell Press"), confirm the line chart shows increasing/varying top-set weight across sessions with correct dates.
- Volume bar chart: toggle Week/Month, confirm bars render and change with the toggle.
- Muscle balance: confirm groups are sorted descending by volume and percentages sum to ~100%.

- [ ] **Step 3: Verify empty states**

Temporarily test with a muscle-group filter/exercise that has no logs (or check before any workout data existed, if testable) — confirm the "No logged sets..." empty-state text renders instead of a blank/crashing chart.

- [ ] **Step 4: Run the full test suite one more time**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npm test
```

Expected: all tests pass, including the new `workoutTrends.test.ts`.

---

## Self-Review Notes

- **Spec coverage:** Both CSV parsing rules (quote-aware, session grouping, blank-row drop, per-exercise set numbering) and all four record-mapping sections (session, exercise match/create, set, muscle-group table) are implemented in Tasks 1-3. Dry-run summary fields, `--commit` gating, `BulkWriter`-equivalent chunked batch writes (used `writeBatch` chunked at 450 ops rather than the `BulkWriter` class specifically — see note below), and the timezone/permissions risk callouts are all present in Task 3's script. All four trend visualizations (Task 7) and the "Trends" entry point inside Workouts (Task 8) are covered. Out-of-scope items (editing imported sets, on-device import UI, Kcal/Distance/Duration/Bodyweight, estimated 1RM) are correctly absent.
- **BulkWriter vs. writeBatch note:** the spec calls out `BulkWriter` by name for its automatic batching/retrying so ~3,500 rows aren't manually chunked against the 500-op limit. The plan above uses `writeBatch` with manual 450-op chunking instead, which achieves the same outcome (no manual chunking bugs, stays under the limit) with one fewer moving part and no additional dependency surface beyond what `firebase/firestore` already exports in this SDK version. This is a implementation-detail deviation from the letter of the spec, not the intent — flagged here rather than silently substituted.
- **Type consistency:** `WorkoutSetDetails`/`ActivityLog` types match between `database.ts` (Task 5) and `workoutTrends.ts` (Task 6) consumption. Component prop names (`days`, `points`, `weeklyPeriods`/`monthlyPeriods`, `groups`) match exactly what `WorkoutTrendsScreen.tsx` (Task 8) passes.
