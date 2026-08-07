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
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

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
