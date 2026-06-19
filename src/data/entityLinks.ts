import { db } from '../db/db';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getCurrentUserId } from './runtime';
import { linkFromRemote, linkToRemote } from './serializers';
import type { EntityLink } from '../db/db';

export async function listEntityLinks() {
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) return db.entityLinks.toArray();
  const { data, error } = await supabase.from('entity_links').select('*').eq('user_id', userId).is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).map(linkFromRemote);
}

export async function upsertEntityLink(link: EntityLink) {
  const userId = getCurrentUserId();
  await db.entityLinks.put(link);
  if (!hasSupabaseConfig || !supabase || !userId) return link;
  const { error } = await supabase.from('entity_links').upsert(linkToRemote(link, userId), { onConflict: 'id' });
  if (error) throw error;
  return link;
}

