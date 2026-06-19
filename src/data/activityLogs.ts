import { db } from '../db/db';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getCurrentUserId } from './runtime';
import { activityFromRemote, activityToRemote } from './serializers';
import type { ActivityLog } from '../db/db';

export async function listActivityLogs() {
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) return db.activityLogs.toArray();
  const { data, error } = await supabase.from('activity_logs').select('*').eq('user_id', userId).is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).map(activityFromRemote);
}

export async function appendActivityLog(log: ActivityLog) {
  const userId = getCurrentUserId();
  await db.activityLogs.put(log);
  if (!hasSupabaseConfig || !supabase || !userId) return log;
  const { error } = await supabase.from('activity_logs').upsert(activityToRemote(log, userId), { onConflict: 'id' });
  if (error) throw error;
  return log;
}

