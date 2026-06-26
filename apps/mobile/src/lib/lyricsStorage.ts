import AsyncStorage from '@react-native-async-storage/async-storage';
import { LyricLine } from './lyricTypes';
import { normalizeLyricLines } from './lyricsUtils';

const LYRIC_KEY_PREFIX = 'lyrics:';

export async function loadLyrics(trackId: string): Promise<LyricLine[]> {
  try {
    const key = `${LYRIC_KEY_PREFIX}${trackId}`;
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
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
    const key = `${LYRIC_KEY_PREFIX}${trackId}`;
    const normalized = normalizeLyricLines(lines);
    await AsyncStorage.setItem(key, JSON.stringify(normalized));
  } catch (error) {
    console.error('Failed to save lyrics locally:', error);
    throw error;
  }
}

export async function deleteLyricsLocal(trackId: string): Promise<void> {
  try {
    const key = `${LYRIC_KEY_PREFIX}${trackId}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to delete lyrics:', error);
  }
}

export async function hasCustomLyrics(trackId: string): Promise<boolean> {
  try {
    const key = `${LYRIC_KEY_PREFIX}${trackId}`;
    const value = await AsyncStorage.getItem(key);
    return !!value;
  } catch {
    return false;
  }
}
