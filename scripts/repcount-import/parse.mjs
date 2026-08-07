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
