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
