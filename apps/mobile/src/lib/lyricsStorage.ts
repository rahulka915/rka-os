import * as FileSystem from 'expo-file-system/legacy';
import { LyricLine } from './lyricTypes';
import { normalizeLyricLines } from './lyricsUtils';

function getDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('expo-file-system documentDirectory is unavailable');
  }
  return FileSystem.documentDirectory;
}

const DOCUMENT_DIR = getDocumentDirectory();
const LYRICS_DIR = `${DOCUMENT_DIR}lyrics/`;
const LAST_TRACK_PATH = `${DOCUMENT_DIR}last_track.json`;
const TRACK_VISUALS_DIR = `${DOCUMENT_DIR}track_visuals/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LYRICS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LYRICS_DIR, { intermediates: true });
  }
}

async function ensureTrackVisualsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(TRACK_VISUALS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TRACK_VISUALS_DIR, { intermediates: true });
  }
}

function lyricsPath(trackId: string): string {
  // Sanitize trackId for use as filename
  const safe = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${LYRICS_DIR}${safe}.json`;
}

function trackVisualPath(trackId: string): string {
  const safe = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${TRACK_VISUALS_DIR}${safe}.json`;
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

// Track metadata persistence — saves the last loaded track so it survives restarts
export interface PersistedTrack {
  id: string;
  title: string;
  artist: string;
  source: string | number;
  coverArtUri?: string;
  visualArtUri?: string;
  palette: [string, string, string];
}

export async function saveTrackVisual(trackId: string, visualArtUri: string): Promise<void> {
  try {
    await ensureTrackVisualsDir();
    await FileSystem.writeAsStringAsync(
      trackVisualPath(trackId),
      JSON.stringify({ visualArtUri })
    );
  } catch (error) {
    console.error('Failed to save track visual:', error);
  }
}

export async function loadTrackVisual(trackId: string): Promise<string | null> {
  try {
    const path = trackVisualPath(trackId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(content);
    return typeof parsed.visualArtUri === 'string' ? parsed.visualArtUri : null;
  } catch (error) {
    console.error('Failed to load track visual:', error);
    return null;
  }
}

export async function saveLastTrack(track: PersistedTrack): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(LAST_TRACK_PATH, JSON.stringify(track));
  } catch (error) {
    console.error('Failed to save last track:', error);
  }
}

export async function loadLastTrack(): Promise<PersistedTrack | null> {
  try {
    const info = await FileSystem.getInfoAsync(LAST_TRACK_PATH);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(LAST_TRACK_PATH);
    return JSON.parse(content);
  } catch {
    return null;
  }
}
