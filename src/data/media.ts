import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getCurrentUserId } from './runtime';

export async function uploadExerciseMedia(exerciseId: string, file: File, kind: 'image' | 'video') {
  const userId = getCurrentUserId();
  if (!hasSupabaseConfig || !supabase || !userId) {
    throw new Error('Supabase storage is not configured for this environment.');
  }

  const cleanName = file.name.replace(/\s+/g, '-').toLowerCase();
  const storagePath = `${userId}/${exerciseId}/${crypto.randomUUID()}-${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from('exercise-media')
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('exercise-media').getPublicUrl(storagePath);
  return {
    storagePath,
    url: data.publicUrl,
    mediaType: kind,
  };
}

