import { db } from '../db/db';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getCurrentUserId } from './runtime';
import { exerciseSessionToRemote, setEntryToRemote, workoutSessionFromRemote, workoutSessionToRemote } from './serializers';
import type { ExerciseSession, SetEntry, WorkoutSession } from '../db/db';

export async function listWorkoutSessions() {
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) return db.workoutSessions.toArray();
  const { data, error } = await supabase.from('workout_sessions').select('*').eq('user_id', userId).is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).map(workoutSessionFromRemote);
}

export async function upsertWorkoutSession(session: WorkoutSession) {
  const userId = getCurrentUserId();
  await db.workoutSessions.put(session);
  if (!hasSupabaseConfig || !supabase || !userId) return session;
  const { error } = await supabase.from('workout_sessions').upsert(workoutSessionToRemote(session, userId), { onConflict: 'id' });
  if (error) throw error;
  return session;
}

export async function upsertExerciseSession(session: ExerciseSession) {
  const userId = getCurrentUserId();
  await db.exerciseSessions.put(session);
  if (!hasSupabaseConfig || !supabase || !userId) return session;
  const { error } = await supabase.from('exercise_sessions').upsert(exerciseSessionToRemote(session, userId), { onConflict: 'id' });
  if (error) throw error;
  return session;
}

export async function upsertSetEntry(entry: SetEntry) {
  const userId = getCurrentUserId();
  await db.setEntries.put(entry);
  if (!hasSupabaseConfig || !supabase || !userId) return entry;
  const { error } = await supabase.from('set_entries').upsert(setEntryToRemote(entry, userId), { onConflict: 'id' });
  if (error) throw error;
  return entry;
}
