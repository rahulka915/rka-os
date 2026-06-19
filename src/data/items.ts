import { db } from '../db/db';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getCurrentUserId } from './runtime';
import { itemFromRemote, itemToRemote } from './serializers';
import type { Item } from '../db/db';

export async function listItems() {
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) return db.items.toArray();
  const { data, error } = await supabase.from('items').select('*').eq('user_id', userId).is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).map(itemFromRemote);
}

export async function upsertItem(item: Item) {
  const userId = getCurrentUserId();
  await db.items.put(item);
  if (!hasSupabaseConfig || !supabase || !userId) return item;
  const { error } = await supabase.from('items').upsert(itemToRemote(item, userId), { onConflict: 'id' });
  if (error) throw error;
  return item;
}

export async function deleteItem(itemId: string) {
  await db.items.delete(itemId);
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) return;
  const { error } = await supabase.from('items').delete().eq('id', itemId).eq('user_id', userId);
  if (error) throw error;
}

