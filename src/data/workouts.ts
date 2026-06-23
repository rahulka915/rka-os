import { db } from '../db/db';
import type { WorkoutSession, ExerciseSession, SetEntry } from '../db/db';

// ─── Read Helpers ────────────────────────────────────────────────────────────
// These functions read exclusively from local Dexie (IndexedDB).
// The sync bridge in sync.ts keeps Dexie in sync with Supabase automatically.
// Do NOT add direct Supabase reads/writes here — use db/actions.ts for mutations.

export async function listWorkoutSessions(): Promise<WorkoutSession[]> {
  return db.workoutSessions.filter(s => !s.deletedAt).toArray();
}

export async function getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.get(id);
}

export async function listExerciseSessions(workoutSessionId: string): Promise<ExerciseSession[]> {
  return db.exerciseSessions
    .where('workoutSessionId')
    .equals(workoutSessionId)
    .filter(s => !s.deletedAt)
    .toArray();
}

export async function listSetEntries(exerciseSessionId: string): Promise<SetEntry[]> {
  return db.setEntries
    .where('exerciseSessionId')
    .equals(exerciseSessionId)
    .filter(e => !e.deletedAt)
    .toArray();
}
