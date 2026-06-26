import * as FileSystem from 'expo-file-system';
import { LyricLine } from './lyricTypes';
import { normalizeLyricLines } from './lyricsUtils';

const LYRICS_DIR = `${FileSystem.documentDirectory}lyrics/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LYRICS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LYRICS_DIR, { intermediates: true });
  }
}

function lyricsPath(trackId: string): string {
  // Sanitize trackId for use as filename
  const safe = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${LYRICS_DIR}${safe}.json`;
}

export async function loadLyrics(trackId: string): Promise<LyricLine[]> {
  try {
    const path = lyricsPath(trackId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const content = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(content);
    return normalizeLyricLines(parsed);
  } catch (error) {
    console.error('Failed to load lyrics:', error);
    return [];
  }
}

export async function saveLyricsLocal(
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  try {
    await ensureDir();
    const normalized = normalizeLyricLines(lines);
    await FileSystem.writeAsStringAsync(
      lyricsPath(trackId),
      JSON.stringify(normalized)
    );
  } catch (error) {
    console.error('Failed to save lyrics locally:', error);
    throw error;
  }
}

export async function deleteLyricsLocal(trackId: string): Promise<void> {
  try {
    const path = lyricsPath(trackId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path);
    }
  } catch (error) {
    console.error('Failed to delete lyrics:', error);
  }
}

export async function hasCustomLyrics(trackId: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(lyricsPath(trackId));
    return info.exists;
  } catch {
    return false;
  }
}
