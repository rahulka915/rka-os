import type { AudioSource } from 'expo-audio';

export type DisplayMode = 'all' | 'romanised' | 'translation';

export interface ParsedLyricLine {
  id: string;
  original: string;
  romanised: string;
  translation: string;
  startMs: number;
  endMs: number;
}

export interface ParsedLyricDraft {
  id: string;
  original: string;
  romanised: string;
  translation: string;
  startMs: number;
}

export interface SyncedLyricsPlayerProps {
  rawLyrics?: string;
  audioSource?: AudioSource | string | number | null;
  title?: string;
  artist?: string;
  initialDisplayMode?: DisplayMode;
  initialOffsetMs?: number;
  accentColor?: string;
}
