# Audio Player: Full Simi Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Project Simi's full-featured lyrics-sync audio player to RKA OS mobile (React Native + Expo), with Supabase backend for real-time sync and offline-first AsyncStorage.

**Architecture:** 
- **Core types & storage** from Simi (LyricLine, normalization, AsyncStorage + Supabase sync)
- **Player shell** (AudioPlayerHost) — enhanced with "Edit lyrics" button, MP3 loading, playback controls
- **SyncEditor modal** (3-step: Paste → Sync → Preview) adapted to React Native
- **UI components** (LyricLine, InstrumentalCard) with karaoke fill animation
- **Long-press editing** (note, highlight, delete) via actions menu
- **Real-time sync** via Supabase subscriptions

**Tech Stack:** React Native, Expo SDK 54, Expo Audio, AsyncStorage, Supabase, Reanimated 3, React Native Gesture Handler

---

## File Structure

**New Files to Create:**

```
apps/mobile/src/
├── components/audio/
│   ├── SyncEditor.tsx               (3-step lyrics editor modal)
│   ├── LyricLine.tsx                (lyric rendering with fill animation)
│   ├── InstrumentalCard.tsx         (instrumental scene display)
│   └── LyricActions.tsx             (long-press actions menu)
├── hooks/
│   ├── useLyricSync.ts              (active line tracking, fill progress)
│   ├── useLyrics.ts                 (lyrics state management)
│   └── useLongPress.ts              (420ms tap/long-press detection)
├── lib/
│   ├── lyricTypes.ts                (LyricLine, Track types)
│   ├── lyricsStorage.ts             (AsyncStorage + Supabase sync)
│   ├── lyricsUtils.ts               (normalize, parse, validate, format)
│   └── mp3Parser.ts                 (already exists, reuse ID3 parsing)
└── services/
    └── lyricsSync.ts                (Supabase subscription + sync orchestration)
```

**Modified Files:**

```
├── components/audio/AudioPlayerHost.tsx   (add Edit button, SyncEditor integration)
└── App.tsx                                 (if adding audio player to navigation)
```

---

## Phase 1: Core Types & Storage Foundation

### Task 1: Define Lyric Types

**Files:**
- Create: `apps/mobile/src/lib/lyricTypes.ts`

- [ ] **Step 1: Write types file with LyricLine and Track interfaces**

```typescript
// apps/mobile/src/lib/lyricTypes.ts

export interface LyricLine {
  id?: string;
  text: string;
  translation?: string;
  script?: string;
  startTime: number;
  endTime: number;
  kind?: "lyric" | "instrumental";
  label?: string;
  style?: "default" | "energetic" | "calm" | "intro" | "outro";
  highlight?: boolean;
  highlightStyle?: "glow" | "sparkle" | "heart";
  note?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  coverArtUri?: string;
  palette: [string, string, string];
  source: string;
  lyrics: LyricLine[];
}

export interface DraftLine {
  id: string;
  script: string;
  text: string;
  translation: string;
  startTime: number | null;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/lyricTypes.ts
git commit -m "feat: add lyric and track type definitions"
```

---

### Task 2: Implement Lyrics Utility Functions

**Files:**
- Create: `apps/mobile/src/lib/lyricsUtils.ts`

- [ ] **Step 1: Write parsing and normalization utilities**

```typescript
// apps/mobile/src/lib/lyricsUtils.ts

import { LyricLine, DraftLine } from './lyricTypes';

// FNV-1a hash for deterministic ID generation
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `lyric-${Math.abs(hash).toString(16)}`;
}

export function generateId(index: number, text: string): string {
  return hashString(`${index}-${text}`);
}

export function parseTimestamp(value: string): number | null {
  const match = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeLyricLines(lines: (LyricLine | DraftLine)[]): LyricLine[] {
  return lines.map((l, i) => {
    const base: LyricLine = {
      ...l,
      id: l.id || generateId(i, (l as any).text || ''),
      text: (l as any).text || '',
      startTime: typeof (l as any).startTime === 'number' ? (l as any).startTime : 0,
      endTime: typeof (l as any).endTime === 'number' ? (l as any).endTime : 0,
    };

    // Detect instrumental
    if ((l as any).kind === 'instrumental' || base.text.startsWith('♪')) {
      base.kind = 'instrumental';
      if (!base.label && base.text.startsWith('♪')) {
        base.label = base.text.replace(/^♪\s*/, '').trim() || 'Instrumental';
      }
    } else {
      base.kind = 'lyric';
    }

    return base;
  });
}

export interface ParseResult {
  lines: DraftLine[];
  errors: string[];
}

export function parseRawLyrics(input: string): ParseResult {
  const lines: DraftLine[] = [];
  const errors: string[] = [];
  let prevTime: number | null = null;

  const rawLines = input.split('\n').map(l => l.trim()).filter(Boolean);

  rawLines.forEach((line, index) => {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    const timeStr = match ? `${match[1]}:${match[2]}` : null;
    const time = timeStr ? parseTimestamp(timeStr) : null;
    const body = match ? match[3] : line;
    
    const [script = '', text = '', translation = ''] = body
      .split('|')
      .map(p => p.trim());

    if (!script && !text && !translation) {
      // Skip empty lines
      return;
    }

    // Validate timestamp order
    if (time !== null && prevTime !== null && time < prevTime) {
      errors.push(`Line ${index + 1}: timestamp ${formatTime(time)} is earlier than previous line ${formatTime(prevTime)}`);
    }

    lines.push({
      id: `draft-${Date.now()}-${index}`,
      script,
      text,
      translation,
      startTime: time,
    });

    if (time !== null) prevTime = time;
  });

  return { lines, errors };
}

export function inferEndTimes(lines: LyricLine[]): LyricLine[] {
  return lines.map((line, i) => {
    const endTime = i < lines.length - 1
      ? lines[i + 1].startTime
      : line.startTime + 4;
    return { ...line, endTime };
  });
}
```

- [ ] **Step 2: Write unit tests**

```typescript
// apps/mobile/src/lib/lyricsUtils.test.ts

import {
  generateId,
  parseTimestamp,
  formatTime,
  round,
  normalizeLyricLines,
  parseRawLyrics,
  inferEndTimes,
} from './lyricsUtils';
import { LyricLine } from './lyricTypes';

describe('lyricsUtils', () => {
  describe('generateId', () => {
    it('generates stable id for same text', () => {
      const id1 = generateId(0, 'hello');
      const id2 = generateId(0, 'hello');
      expect(id1).toBe(id2);
    });

    it('generates different ids for different text', () => {
      const id1 = generateId(0, 'hello');
      const id2 = generateId(0, 'world');
      expect(id1).not.toBe(id2);
    });
  });

  describe('parseTimestamp', () => {
    it('parses mm:ss format', () => {
      expect(parseTimestamp('1:30')).toBe(90);
    });

    it('parses mm:ss.xx format', () => {
      expect(parseTimestamp('1:30.50')).toBe(90.5);
    });

    it('returns null for invalid format', () => {
      expect(parseTimestamp('invalid')).toBeNull();
    });
  });

  describe('formatTime', () => {
    it('formats seconds to mm:ss', () => {
      expect(formatTime(90)).toBe('1:30');
    });

    it('formats with leading zero', () => {
      expect(formatTime(5)).toBe('0:05');
    });
  });

  describe('round', () => {
    it('rounds to 2 decimals', () => {
      expect(round(14.505)).toBe(14.51);
      expect(round(14.504)).toBe(14.5);
    });
  });

  describe('normalizeLyricLines', () => {
    it('assigns id if missing', () => {
      const line: LyricLine = { text: 'hello', startTime: 0, endTime: 1 };
      const normalized = normalizeLyricLines([line]);
      expect(normalized[0].id).toBeDefined();
    });

    it('detects instrumental kind', () => {
      const line: LyricLine = { text: '♪ Guitar solo', startTime: 0, endTime: 1 };
      const normalized = normalizeLyricLines([line]);
      expect(normalized[0].kind).toBe('instrumental');
      expect(normalized[0].label).toBe('Guitar solo');
    });

    it('defaults kind to lyric', () => {
      const line: LyricLine = { text: 'hello', startTime: 0, endTime: 1 };
      const normalized = normalizeLyricLines([line]);
      expect(normalized[0].kind).toBe('lyric');
    });
  });

  describe('parseRawLyrics', () => {
    it('parses timestamped lyrics', () => {
      const input = '[0:15.00] Script | Text | Translation\n[0:20.00] More text';
      const { lines, errors } = parseRawLyrics(input);
      expect(lines).toHaveLength(2);
      expect(lines[0].startTime).toBe(15);
      expect(lines[0].text).toBe('Text');
      expect(errors).toHaveLength(0);
    });

    it('detects out-of-order timestamps', () => {
      const input = '[0:20.00] First\n[0:15.00] Second';
      const { lines, errors } = parseRawLyrics(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/earlier than previous/);
    });

    it('handles mixed timestamped and untimestamped', () => {
      const input = '[0:10.00] First\nSecond (untimed)\n[0:20.00] Third';
      const { lines, errors } = parseRawLyrics(input);
      expect(lines).toHaveLength(3);
      expect(lines[1].startTime).toBeNull();
    });
  });

  describe('inferEndTimes', () => {
    it('infers from next line start time', () => {
      const lines: LyricLine[] = [
        { id: '1', text: 'First', startTime: 0, endTime: 0 },
        { id: '2', text: 'Second', startTime: 5, endTime: 0 },
      ];
      const result = inferEndTimes(lines);
      expect(result[0].endTime).toBe(5);
    });

    it('adds 4 seconds for last line', () => {
      const lines: LyricLine[] = [
        { id: '1', text: 'Only', startTime: 10, endTime: 0 },
      ];
      const result = inferEndTimes(lines);
      expect(result[0].endTime).toBe(14);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- lyricsUtils.test.ts
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/lyricsUtils.ts apps/mobile/src/lib/lyricsUtils.test.ts
git commit -m "feat: add lyrics parsing and normalization utilities"
```

---

### Task 3: Implement AsyncStorage & Supabase Storage Layer

**Files:**
- Create: `apps/mobile/src/lib/lyricsStorage.ts`
- Modify: `apps/mobile/src/services/lyricsSync.ts` (create new)

- [ ] **Step 1: Write AsyncStorage storage layer**

```typescript
// apps/mobile/src/lib/lyricsStorage.ts

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
```

- [ ] **Step 2: Write Supabase sync service**

```typescript
// apps/mobile/src/services/lyricsSync.ts

import { createClient } from '@supabase/supabase-js';
import { LyricLine } from '../lib/lyricTypes';
import { normalizeLyricLines } from '../lib/lyricsUtils';
import { saveLyricsLocal } from '../lib/lyricsStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveLyrics(
  userId: string,
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  const normalized = normalizeLyricLines(lines);

  // 1. Save locally first (offline-safe)
  await saveLyricsLocal(trackId, normalized);

  // 2. Sync to Supabase (async, don't await)
  syncToSupabase(userId, trackId, normalized).catch((error) => {
    console.error('Failed to sync lyrics to Supabase:', error);
  });
}

async function syncToSupabase(
  userId: string,
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  const { error } = await supabase
    .from('lyrics')
    .upsert({
      id: trackId,
      lines: lines,
      userId: userId,
    })
    .eq('userId', userId);

  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }
}

export function subscribeLyrics(
  userId: string,
  trackId: string,
  onUpdate: (lines: LyricLine[]) => void
): () => void {
  const subscription = supabase
    .from('lyrics')
    .on('*', (payload) => {
      if (payload.new?.userId === userId && payload.new?.id === trackId) {
        const lines = normalizeLyricLines(payload.new.lines || []);
        onUpdate(lines);
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/lyricsStorage.ts apps/mobile/src/services/lyricsSync.ts
git commit -m "feat: add lyrics storage and Supabase sync layer"
```

---

## Phase 2: Core Hooks

### Task 4: Implement useLyricSync Hook

**Files:**
- Create: `apps/mobile/src/hooks/useLyricSync.ts`

- [ ] **Step 1: Write useLyricSync hook with binary search**

```typescript
// apps/mobile/src/hooks/useLyricSync.ts

import { useEffect, useRef, useState } from 'react';
import { LyricLine } from '../lib/lyricTypes';

// Binary search to find active lyric at current time
function activeAt(lyrics: LyricLine[], currentTime: number): number {
  let left = 0;
  let right = lyrics.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lyrics[mid];

    if (line.startTime <= currentTime && currentTime < line.endTime) {
      return mid;
    }
    if (line.startTime > currentTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}

export interface UseLyricSyncOptions {
  updateInterval?: number; // ms between updates
}

export function useLyricSync(
  currentTime: number,
  lyrics: LyricLine[],
  options: UseLyricSyncOptions = {}
) {
  const { updateInterval = 250 } = options;
  const [activeIndex, setActiveIndex] = useState(-1);
  const prevIndexRef = useRef(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = activeAt(lyrics, currentTime);
      if (idx !== prevIndexRef.current) {
        setActiveIndex(idx);
        prevIndexRef.current = idx;
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [currentTime, lyrics, updateInterval]);

  // Calculate fill progress (0-1) for active line
  let progress = 0;
  if (activeIndex >= 0 && lyrics[activeIndex]) {
    const line = lyrics[activeIndex];
    const duration = line.endTime - line.startTime;
    const elapsed = currentTime - line.startTime;
    progress = Math.max(0, Math.min(1, elapsed / duration));
  }

  return { activeIndex, progress };
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/mobile/src/hooks/useLyricSync.test.ts

import { renderHook } from '@testing-library/react-native';
import { useLyricSync } from './useLyricSync';
import { LyricLine } from '../lib/lyricTypes';

describe('useLyricSync', () => {
  const lyrics: LyricLine[] = [
    { id: '1', text: 'Line 1', startTime: 0, endTime: 5 },
    { id: '2', text: 'Line 2', startTime: 5, endTime: 10 },
    { id: '3', text: 'Line 3', startTime: 10, endTime: 15 },
  ];

  it('finds active line at start', () => {
    const { result } = renderHook(() => useLyricSync(0, lyrics));
    expect(result.current.activeIndex).toBe(0);
  });

  it('finds active line in middle', () => {
    const { result } = renderHook(() => useLyricSync(7, lyrics));
    expect(result.current.activeIndex).toBe(1);
  });

  it('returns -1 when no line is active', () => {
    const { result } = renderHook(() => useLyricSync(20, lyrics));
    expect(result.current.activeIndex).toBe(-1);
  });

  it('calculates progress correctly', () => {
    const { result } = renderHook(() => useLyricSync(2.5, lyrics));
    // 2.5 - 0 = 2.5, duration = 5, progress = 0.5
    expect(result.current.progress).toBe(0.5);
  });

  it('clamps progress to 0-1', () => {
    const { result: result1 } = renderHook(() => useLyricSync(-1, lyrics));
    expect(result1.current.progress).toBe(0);

    const { result: result2 } = renderHook(() => useLyricSync(100, lyrics));
    expect(result2.current.progress).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/mobile && npm test -- useLyricSync.test.ts
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useLyricSync.ts apps/mobile/src/hooks/useLyricSync.test.ts
git commit -m "feat: add useLyricSync hook with binary search"
```

---

### Task 5: Implement useLongPress Hook

**Files:**
- Create: `apps/mobile/src/hooks/useLongPress.ts`

- [ ] **Step 1: Write useLongPress hook**

```typescript
// apps/mobile/src/hooks/useLongPress.ts

import { useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';

export interface UseLongPressOptions {
  onTap?: () => void;
  onLongPress?: () => void;
  threshold?: number; // ms
  tolerance?: number; // pt
}

export function useLongPress(options: UseLongPressOptions = {}) {
  const {
    onTap,
    onLongPress,
    threshold = 420,
    tolerance = 12,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = (event: GestureResponderEvent) => {
    setIsPressed(true);
    const { pageX, pageY } = event.nativeEvent;
    startPosRef.current = { x: pageX, y: pageY };

    timerRef.current = setTimeout(() => {
      if (startPosRef.current && onLongPress) {
        onLongPress();
      }
    }, threshold);
  };

  const handlePointerMove = (event: GestureResponderEvent) => {
    if (!startPosRef.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - startPosRef.current.x);
    const dy = Math.abs(pageY - startPosRef.current.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > tolerance) {
      // User moved too far, cancel long-press
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    setIsPressed(false);

    // If timer is still running, user released before 420ms → tap
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (onTap) {
        onTap();
      }
    }

    startPosRef.current = null;
  };

  return {
    getEventHandlers: () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
    }),
  };
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useLongPress.ts
git commit -m "feat: add useLongPress hook with 420ms threshold"
```

---

### Task 6: Implement useLyrics State Hook

**Files:**
- Create: `apps/mobile/src/hooks/useLyrics.ts`

- [ ] **Step 1: Write useLyrics hook for state management**

```typescript
// apps/mobile/src/hooks/useLyrics.ts

import { useEffect, useState } from 'react';
import { LyricLine } from '../lib/lyricTypes';
import { loadLyrics } from '../lib/lyricsStorage';
import { subscribeLyrics } from '../services/lyricsSync';

export function useLyrics(trackId: string, userId: string) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from local storage first
    loadLyrics(trackId).then((local) => {
      setLyrics(local);
      setLoading(false);
    });

    // Subscribe to remote updates
    const unsubscribe = subscribeLyrics(userId, trackId, (updated) => {
      setLyrics(updated);
    });

    return unsubscribe;
  }, [trackId, userId]);

  return { lyrics, setLyrics, loading };
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useLyrics.ts
git commit -m "feat: add useLyrics hook for state and sync management"
```

---

## Phase 3: UI Components Foundation

### Task 7: Create LyricLine Component

**Files:**
- Create: `apps/mobile/src/components/audio/LyricLine.tsx`

- [ ] **Step 1: Write LyricLine component with karaoke fill**

```typescript
// apps/mobile/src/components/audio/LyricLine.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LyricLine as LyricLineType } from '../../lib/lyricTypes';
import { useThemeContext } from '../../hooks/useThemeContext';

interface LyricLineProps {
  line: LyricLineType;
  active: boolean;
  progress: number; // 0-1
  onTap?: () => void;
  onLongPress?: () => void;
}

export const LyricLine = React.forwardRef<View, LyricLineProps>(
  ({ line, active, progress, onTap, onLongPress }, ref) => {
    const { isDark } = useThemeContext();

    // Instrumental rendering
    if (line.kind === 'instrumental') {
      return (
        <View
          ref={ref}
          style={[
            styles.container,
            active && styles.instrumentalActive,
          ]}
        >
          <Text style={[styles.instrumentalText, { color: isDark ? '#999' : '#ccc' }]}>
            ♪ {line.label || 'Instrumental'}
          </Text>
        </View>
      );
    }

    // Lyric rendering
    const textColor = isDark ? '#f2f2f2' : '#000000';
    const secondaryColor = isDark ? 'rgba(255,255,255,0.56)' : 'rgba(0,0,0,0.56)';
    const fillColor = isDark ? '#7c5cff' : '#007aff';
    const activeBackgroundColor = isDark
      ? 'rgba(124, 92, 255, 0.15)'
      : 'rgba(0, 122, 255, 0.1)';

    return (
      <Pressable
        ref={ref}
        onPress={onTap}
        onLongPress={onLongPress}
        style={[
          styles.container,
          active && {
            backgroundColor: activeBackgroundColor,
          },
        ]}
      >
        {/* Fill bar background */}
        {active && (
          <View
            style={[
              styles.fillBar,
              {
                backgroundColor: fillColor,
                width: `${Math.max(0, progress * 100)}%`,
              },
            ]}
          />
        )}

        {/* Content */}
        <View style={styles.content}>
          {line.script && (
            <Text
              style={[
                styles.scriptText,
                {
                  color: textColor,
                  opacity: active ? 1 : 0.7,
                },
              ]}
            >
              {line.script}
            </Text>
          )}

          <Text
            style={[
              styles.mainText,
              {
                color: textColor,
                opacity: active ? 1 : 0.7,
              },
            ]}
          >
            {line.text}
            {line.highlight && (
              <Text style={styles.highlightMarker}>
                {' '}
                {line.highlightStyle === 'sparkle' ? '✨' : 
                 line.highlightStyle === 'heart' ? '❤️' : '⭐'}
              </Text>
            )}
          </Text>

          {line.translation && (
            <Text
              style={[
                styles.translationText,
                {
                  color: secondaryColor,
                  opacity: active ? 0.8 : 0.56,
                },
              ]}
            >
              {line.translation}
            </Text>
          )}

          {line.note && (
            <Text
              style={[
                styles.noteText,
                {
                  color: secondaryColor,
                },
              ]}
            >
              📝 {line.note}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

LyricLine.displayName = 'LyricLine';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    opacity: 0.2,
  },
  content: {
    zIndex: 1,
  },
  scriptText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mainText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  translationText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  instrumentalText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  instrumentalActive: {
    backgroundColor: 'rgba(124, 92, 255, 0.25)',
  },
  highlightMarker: {
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/audio/LyricLine.tsx
git commit -m "feat: add LyricLine component with karaoke fill animation"
```

---

### Task 8: Create InstrumentalCard Component

**Files:**
- Create: `apps/mobile/src/components/audio/InstrumentalCard.tsx`

- [ ] **Step 1: Write InstrumentalCard with pulsing animation**

```typescript
// apps/mobile/src/components/audio/InstrumentalCard.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useThemeContext } from '../../hooks/useThemeContext';

interface InstrumentalCardProps {
  label: string;
  style?: 'default' | 'energetic' | 'calm' | 'intro' | 'outro';
  progress: number; // 0-1
}

export const InstrumentalCard = React.memo(({
  label,
  style = 'default',
  progress,
}: InstrumentalCardProps) => {
  const { isDark } = useThemeContext();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const bgColor = isDark
    ? 'rgba(124, 92, 255, 0.15)'
    : 'rgba(0, 122, 255, 0.1)';

  const doodleEmoji = style === 'energetic' ? '✨' :
                      style === 'calm' ? '❤️' :
                      style === 'intro' ? '🎵' :
                      style === 'outro' ? '🌙' : '⭐';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.doodle, { fontSize: 24 }]}>{doodleEmoji}</Text>
        <Text
          style={[
            styles.label,
            {
              color: isDark ? '#f2f2f2' : '#000000',
            },
          ]}
        >
          {label}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={[
          styles.progressBar,
          {
            width: `${Math.max(0, progress * 100)}%`,
            backgroundColor: isDark ? '#7c5cff' : '#007aff',
          },
        ]}
      />
    </Animated.View>
  );
});

InstrumentalCard.displayName = 'InstrumentalCard';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doodle: {
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
  },
});
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/audio/InstrumentalCard.tsx
git commit -m "feat: add InstrumentalCard component with pulsing animation"
```

---

## Phase 4: SyncEditor (3-Step Modal)

### Task 9: Create SyncEditor Component - Step 1 (Paste)

**Files:**
- Create: `apps/mobile/src/components/audio/SyncEditor.tsx` (part 1)

- [ ] **Step 1: Write SyncEditor shell and Step 1 (Paste)**

```typescript
// apps/mobile/src/components/audio/SyncEditor.tsx (Part 1/3)

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '../../icons';
import { useThemeContext } from '../../hooks/useThemeContext';
import { LyricLine, DraftLine } from '../../lib/lyricTypes';
import { parseRawLyrics, inferEndTimes, normalizeLyricLines, round, formatTime } from '../../lib/lyricsUtils';

type Step = 'paste' | 'sync' | 'preview';

interface SyncEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (lyrics: LyricLine[]) => Promise<void>;
  initialLyrics?: LyricLine[];
}

export const SyncEditor = ({
  open,
  onClose,
  onSave,
  initialLyrics = [],
}: SyncEditorProps) => {
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('paste');
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePaste = () => {
    const { lines, errors: parseErrors } = parseRawLyrics(pasted);
    setErrors(parseErrors);

    if (parseErrors.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      return;
    }

    if (lines.length === 0) {
      setErrors(['No valid lines found']);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      return;
    }

    // Check if all lines are timestamped
    const allTimestamped = lines.every((l) => l.startTime !== null);

    setDraft(lines);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (allTimestamped) {
      // Skip to preview
      setStep('preview');
    } else {
      // Go to sync
      setStep('sync');
    }
  };

  // Render Step 1: Paste
  if (step === 'paste') {
    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslated
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            {
              backgroundColor: isDark ? '#0c0c0c' : '#f2f2f7',
            },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <ChevronLeft size={24} color={isDark ? '#f2f2f2' : '#000'} />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              Paste Lyrics
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
              ]}
            >
              Paste lyrics with optional timestamps:
            </Text>
            <Text
              style={[
                styles.example,
                { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
              ]}
            >
              [0:15.50] Script | Text | Translation
            </Text>

            <TextInput
              value={pasted}
              onChangeText={setPasted}
              placeholder="[00:15.00] Paste lyrics here..."
              placeholderTextColor={
                isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
              }
              multiline
              textAlignVertical="top"
              style={[
                styles.pasteInput,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.05)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(0,0,0,0.1)',
                  color: isDark ? '#f2f2f2' : '#000',
                },
              ]}
            />

            {errors.length > 0 && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : 'rgba(255,59,48,0.1)' },
                ]}
              >
                <Text style={styles.errorTitle}>Errors:</Text>
                {errors.map((error, i) => (
                  <Text
                    key={i}
                    style={[styles.errorText, { color: '#ff3b30' }]}
                  >
                    • {error}
                  </Text>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    // Show "Sort by time" button
                    const sorted = draft.sort(
                      (a, b) => (a.startTime ?? 999) - (b.startTime ?? 999)
                    );
                    setDraft(sorted);
                    setErrors([]);
                  }}
                  style={styles.sortButton}
                >
                  <Text style={styles.sortButtonText}>Sort by time</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <TouchableOpacity
              onPress={handlePaste}
              style={[
                styles.nextButton,
                { backgroundColor: isDark ? '#007aff' : '#007aff' },
              ]}
              disabled={pasted.trim().length === 0}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Placeholder for Steps 2 & 3 (to be implemented in next tasks)
  return null;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  example: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 16,
  },
  pasteInput: {
    minHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 16,
  },
  errorBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff3b30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  sortButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,122,255,0.2)',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007aff',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/audio/SyncEditor.tsx
git commit -m "feat: add SyncEditor Step 1 (Paste) UI"
```

---

### Task 10: Implement SyncEditor Step 2 (Sync)

**Files:**
- Modify: `apps/mobile/src/components/audio/SyncEditor.tsx`

- [ ] **Step 1: Add Step 2 (Sync) rendering to SyncEditor**

Note: This is a large addition. Replace the `// Placeholder for Steps 2 & 3` section with:

```typescript
  // Step 2: Sync
  if (step === 'sync' && player) {
    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslated
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            { backgroundColor: isDark ? '#0c0c0c' : '#f2f2f7' },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setStep('paste')}
              hitSlop={10}
            >
              <ChevronLeft size={24} color={isDark ? '#f2f2f2' : '#000'} />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              Sync Lyrics
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Player controls */}
          <View
            style={[
              styles.playerControls,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.05)',
                borderBottomColor: isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                if (isPlaying) player.pause();
                else player.play();
              }}
              style={styles.playButton}
            >
              {isPlaying ? (
                <Pause size={20} color={isDark ? '#f2f2f2' : '#000'} />
              ) : (
                <Play
                  size={20}
                  color={isDark ? '#f2f2f2' : '#000'}
                  fill={isDark ? '#f2f2f2' : '#000'}
                />
              )}
            </TouchableOpacity>

            {/* Speed selector */}
            <TouchableOpacity
              onPress={() => {
                // Cycle speed: 1.0 → 0.75 → 1.0
                setPlaybackSpeed(playbackSpeed === 1 ? 0.75 : 1);
              }}
              style={styles.speedButton}
            >
              <Text style={{ color: isDark ? '#7c5cff' : '#007aff', fontWeight: '700' }}>
                {playbackSpeed}×
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lyrics list */}
          <FlatList
            data={draft}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.lyricRow}>
                <TouchableOpacity
                  onPress={() => stampLyricLine(item.id)}
                  style={[
                    styles.stampButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(124,92,255,0.2)'
                        : 'rgba(0,122,255,0.1)',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isDark ? '#7c5cff' : '#007aff',
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {item.startTime === null ? `L${index + 1}` : formatTime(item.startTime)}
                  </Text>
                </TouchableOpacity>

                <View style={styles.textInputGroup}>
                  <TextInput
                    value={item.script}
                    onChangeText={(value) => updateLine(item.id, { script: value })}
                    placeholder="Script"
                    style={[
                      styles.lineInput,
                      { color: isDark ? '#f2f2f2' : '#000' },
                    ]}
                  />
                  <TextInput
                    value={item.text}
                    onChangeText={(value) => updateLine(item.id, { text: value })}
                    placeholder="Text"
                    style={[
                      styles.lineInput,
                      { color: isDark ? '#f2f2f2' : '#000' },
                    ]}
                  />
                  <TextInput
                    value={item.translation}
                    onChangeText={(value) => updateLine(item.id, { translation: value })}
                    placeholder="Translation"
                    style={[
                      styles.lineInput,
                      { color: isDark ? '#f2f2f2' : '#000' },
                    ]}
                  />
                </View>

                {/* Line actions menu */}
                <TouchableOpacity
                  onPress={() => setActionsFor(item.id)}
                  style={styles.menuButton}
                >
                  <Text style={{ fontSize: 18 }}>⋮</Text>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.lyricsList}
            scrollEnabled
          />

          <View
            style={[
              styles.footer,
              { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <TouchableOpacity
              onPress={() => setStep('preview')}
              style={[
                styles.nextButton,
                { backgroundColor: isDark ? '#007aff' : '#007aff' },
              ]}
            >
              <Text style={styles.nextButtonText}>Preview</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }
```

- [ ] **Step 2: Add necessary state and helper functions before the render logic**

Add these before the main component body return statement:

```typescript
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [actionsFor, setActionsFor] = useState<string | null>(null);

  const stampLyricLine = (id: string) => {
    updateLine(id, { startTime: currentTime });
    setCursor(cursor + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setDraft(draft.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const deleteLine = (id: string) => {
    setDraft(draft.filter((l) => l.id !== id));
  };
```

- [ ] **Step 3: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors (may have warnings about unused player prop - ignore for now)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/audio/SyncEditor.tsx
git commit -m "feat: add SyncEditor Step 2 (Sync) with playback and stamping"
```

---

### Task 11: Implement SyncEditor Step 3 (Preview)

**Files:**
- Modify: `apps/mobile/src/components/audio/SyncEditor.tsx`

- [ ] **Step 1: Replace final placeholder with Step 3 (Preview) rendering**

Replace the `return null;` at the end with:

```typescript
  // Step 3: Preview
  if (step === 'preview') {
    const builtLines = buildLines();

    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslated
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            { backgroundColor: isDark ? '#0c0c0c' : '#f2f2f7' },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setStep('sync')}
              hitSlop={10}
            >
              <ChevronLeft size={24} color={isDark ? '#f2f2f2' : '#000'} />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              Preview
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={builtLines}
            keyExtractor={(item) => item.id || ''}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              return (
                <LyricLine
                  line={item}
                  active={isActive}
                  progress={isActive ? progress : 0}
                  onTap={() => {
                    // Seek to line
                  }}
                />
              );
            }}
            contentContainerStyle={styles.previewList}
          />

          <View
            style={[
              styles.footer,
              { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <TouchableOpacity
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(builtLines);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => {}
                  );
                  onClose();
                } catch (error) {
                  console.error('Failed to save:', error);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
                    () => {}
                  );
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={[
                styles.saveButton,
                { backgroundColor: isDark ? '#34a853' : '#34a853', opacity: saving ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return null;
```

- [ ] **Step 2: Add buildLines helper before the main render block**

Add this function inside SyncEditor component:

```typescript
  const buildLines = (): LyricLine[] => {
    const stamped = draft.filter((l) => l.startTime !== null);
    
    if (stamped.length === 0) {
      return [];
    }

    const sorted = stamped.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

    return sorted.map((line, i, arr) => ({
      id: line.id,
      text: line.text,
      translation: line.translation,
      script: line.script,
      startTime: round(line.startTime ?? 0),
      endTime: arr[i + 1]?.startTime ?? (line.startTime ?? 0) + 4,
    }));
  };
```

- [ ] **Step 3: Add activeIndex and progress calculation for preview**

Add these state/hooks for preview step:

```typescript
  const { activeIndex, progress } = useLyricSync(
    currentTime,
    step === 'preview' ? buildLines() : []
  );
```

- [ ] **Step 4: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/audio/SyncEditor.tsx
git commit -m "feat: add SyncEditor Step 3 (Preview) with save functionality"
```

---

## Phase 5: Integration with AudioPlayerHost

### Task 12: Enhance AudioPlayerHost with SyncEditor Integration

**Files:**
- Modify: `apps/mobile/src/components/audio/AudioPlayerHost.tsx`

- [ ] **Step 1: Add SyncEditor modal state and button to AudioPlayerHost**

In `AudioPlayerHost.tsx`, add after the existing state declarations:

```typescript
  const [editingOpen, setEditingOpen] = useState(false);
  const { lyrics, setLyrics, loading } = useLyrics(track?.id ?? '', userId);
```

Add "Edit lyrics" button in the header (replace the existing header row with):

```typescript
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={styles.headerIconButton}
                hitSlop={10}
              >
                <ChevronDown size={18} color="rgba(255,255,255,0.92)" strokeWidth={1.8} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerLabel}>Audio Player</Text>
                <Text style={styles.headerMeta}>{sourceLabel}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setEditingOpen(true)}
                activeOpacity={0.8}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <SyncEditor
              open={editingOpen}
              onClose={() => setEditingOpen(false)}
              initialLyrics={lyrics}
              onSave={async (newLyrics) => {
                await saveLyrics(userId, track!.id, newLyrics);
                setLyrics(newLyrics);
              }}
            />
```

- [ ] **Step 2: Add styles for edit button**

Add to the StyleSheet at the bottom of AudioPlayerHost:

```typescript
  editButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
```

- [ ] **Step 3: Import SyncEditor at top of AudioPlayerHost**

```typescript
import { SyncEditor } from './SyncEditor';
import { useLyrics } from '../../hooks/useLyrics';
import { saveLyrics } from '../../services/lyricsSync';
import { useAuth } from '../../auth/AuthProvider'; // or wherever userId comes from
```

- [ ] **Step 4: Get userId from auth context (add this near top of component)**

```typescript
  const { user } = useAuth(); // Assumes useAuth hook exists
  const userId = user?.id ?? 'anonymous';
```

- [ ] **Step 5: Update lyrics display to use real lyrics**

Replace the inline `<Text style={styles.lyricsLead}>` section with:

```typescript
                    <Text style={styles.lyricsLead} numberOfLines={2}>
                      {activeLyric?.text || activeLyric?.script || 'No lyrics loaded'}
                    </Text>
                    {activeLyric?.translation ? (
                      <Text style={styles.lyricsTranslation} numberOfLines={2}>
                        {activeLyric.translation}
                      </Text>
                    ) : null}
```

- [ ] **Step 6: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors (may have userId/useAuth warnings if hook doesn't exist yet)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/audio/AudioPlayerHost.tsx
git commit -m "feat: integrate SyncEditor into AudioPlayerHost with Edit button"
```

---

## Phase 6: Long-Press Editing & Polish

### Task 13: Create LyricActions Menu Component

**Files:**
- Create: `apps/mobile/src/components/audio/LyricActions.tsx`

- [ ] **Step 1: Write LyricActions menu component**

```typescript
// apps/mobile/src/components/audio/LyricActions.tsx

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../../hooks/useThemeContext';
import { LyricLine } from '../../lib/lyricTypes';

interface LyricActionsProps {
  open: boolean;
  line: LyricLine | null;
  onClose: () => void;
  onEdit?: () => void;
  onAddNote?: (note: string) => void;
  onToggleHighlight?: () => void;
  onDelete?: () => void;
}

export const LyricActions = ({
  open,
  line,
  onClose,
  onEdit,
  onAddNote,
  onToggleHighlight,
  onDelete,
}: LyricActionsProps) => {
  const { isDark } = useThemeContext();
  const [noteText, setNoteText] = React.useState(line?.note ?? '');
  const [editingNote, setEditingNote] = React.useState(false);

  React.useEffect(() => {
    if (line) {
      setNoteText(line.note ?? '');
    }
  }, [line]);

  if (!line) return null;

  // Edit note sheet
  if (editingNote) {
    return (
      <Modal visible={open && editingNote} transparent animationType="slide">
        <SafeAreaView
          style={[
            styles.noteSheet,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' },
          ]}
        >
          <View
            style={[
              styles.noteContent,
              { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
            ]}
          >
            <Text
              style={[
                styles.noteTitle,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              Add/Edit Note
            </Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Your note..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              multiline
              textAlignVertical="top"
              style={[
                styles.noteInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#f2f2f2' : '#000',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
            />

            <View style={styles.noteButtons}>
              <TouchableOpacity
                onPress={() => setEditingNote(false)}
                style={[
                  styles.noteButton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.noteButtonText,
                    { color: isDark ? '#f2f2f2' : '#000' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onAddNote?.(noteText);
                  setEditingNote(false);
                  onClose();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {}
                  );
                }}
                style={[
                  styles.noteButton,
                  { backgroundColor: '#007aff' },
                ]}
              >
                <Text style={[styles.noteButtonText, { color: '#fff' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Main actions menu
  return (
    <Modal visible={open} transparent animationType="fade">
      <View
        style={[
          styles.overlay,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTap}
          onPress={onClose}
          activeOpacity={1}
        />

        <View
          style={[
            styles.menu,
            { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
          ]}
        >
          <Text
            style={[
              styles.menuTitle,
              { color: isDark ? '#f2f2f2' : '#000' },
            ]}
            numberOfLines={1}
          >
            {line.text}
          </Text>

          <TouchableOpacity
            onPress={() => {
              onEdit?.();
              onClose();
            }}
            style={styles.menuItem}
          >
            <Text style={[styles.menuItemText, { color: '#007aff' }]}>
              ✏️ Edit lyrics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setEditingNote(true)}
            style={styles.menuItem}
          >
            <Text
              style={[
                styles.menuItemText,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              📝 {line.note ? 'Edit note' : 'Add note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onToggleHighlight?.();
              onClose();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {}
              );
            }}
            style={styles.menuItem}
          >
            <Text
              style={[
                styles.menuItemText,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              {line.highlight ? '★' : '☆'} {line.highlight ? 'Remove highlight' : 'Highlight'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onDelete?.();
              onClose();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => {}
              );
            }}
            style={styles.menuItem}
          >
            <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTap: {
    flex: 1,
  },
  menu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteSheet: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContent: {
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  noteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  noteButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/audio/LyricActions.tsx
git commit -m "feat: add LyricActions long-press menu with note and highlight editing"
```

---

### Task 14: Integrate LyricActions into AudioPlayerHost

**Files:**
- Modify: `apps/mobile/src/components/audio/AudioPlayerHost.tsx`

- [ ] **Step 1: Add long-press state and LyricActions to AudioPlayerHost**

Add this state after existing state declarations:

```typescript
  const [actionsFor, setActionsFor] = useState<string | null>(null);
```

Add LyricActions import at top:

```typescript
import { LyricActions } from './LyricActions';
```

Add the LyricActions modal in the return JSX (before the closing `</>`):

```typescript
        <LyricActions
          open={!!actionsFor}
          line={lyrics.find((l) => l.id === actionsFor) ?? null}
          onClose={() => setActionsFor(null)}
          onEdit={() => setEditingOpen(true)}
          onAddNote={(note) => {
            const updated = lyrics.map((l) =>
              l.id === actionsFor ? { ...l, note } : l
            );
            setLyrics(updated);
            saveLyrics(userId, track!.id, updated);
          }}
          onToggleHighlight={() => {
            const line = lyrics.find((l) => l.id === actionsFor);
            if (line) {
              const styles = ['glow', 'sparkle', 'heart'] as const;
              const nextStyle = styles[(styles.indexOf(line.highlightStyle ?? 'glow') + 1) % styles.length];
              const updated = lyrics.map((l) =>
                l.id === actionsFor
                  ? { ...l, highlight: !l.highlight, highlightStyle: nextStyle }
                  : l
              );
              setLyrics(updated);
              saveLyrics(userId, track!.id, updated);
            }
          }}
          onDelete={() => {
            const updated = lyrics.filter((l) => l.id !== actionsFor);
            setLyrics(updated);
            saveLyrics(userId, track!.id, updated);
          }}
        />
```

- [ ] **Step 2: Add long-press handler to active lyric display**

Modify the lyrics display section to include long-press and use useLongPress:

```typescript
                    <Pressable
                      onLongPress={() => setActionsFor(activeLyric?.id ?? null)}
                      onPress={() => {
                        // Seek to line
                        if (activeLyric) {
                          player.seekTo(activeLyric.startTime).catch(() => {});
                        }
                      }}
                    >
                      <Text style={styles.lyricsLead} numberOfLines={2}>
                        {activeLyric?.text || activeLyric?.script || 'No lyrics loaded'}
                      </Text>
```

- [ ] **Step 3: Verify compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/audio/AudioPlayerHost.tsx
git commit -m "feat: integrate LyricActions menu with long-press editing"
```

---

## Phase 7: Testing & Verification

### Task 15: Manual Integration Testing

**No files to create, but comprehensive testing:**

- [ ] **Step 1: Start Expo dev server**

```bash
cd apps/mobile && npm start -- --clear
```

Expected: Metro bundler starts, shows QR code

- [ ] **Step 2: Launch app on device/simulator**

Scan QR or press `i` for iOS simulator

Expected: App loads, navigates to home screen

- [ ] **Step 3: Test AudioPlayerHost basic flow**

Open the audio player (if accessible from app nav), load an MP3 file.

Expected:
- File picker opens
- MP3 metadata (title, artist, cover) extracted
- Play/pause button works
- Progress bar shows current time

- [ ] **Step 4: Test SyncEditor Step 1 (Paste)**

Tap "Edit lyrics" button, paste sample lyrics:

```
[0:10.50] First line | romanized | English
[0:15.00] Second line | more | translation
```

Expected:
- Step 1 modal shows with paste input
- "Next" button enabled
- No validation errors
- Transitions to Step 2

- [ ] **Step 5: Test SyncEditor Step 2 (Sync)**

In Step 2:
- Play audio, tap "Stamp" button on line 1 at ~10s
- Advance to line 2, stamp at ~15s
- Tap "Preview"

Expected:
- Lines stamped with times
- Transitions to Step 3
- Progress bar shows current fill

- [ ] **Step 6: Test SyncEditor Step 3 (Preview)**

In Step 3:
- Play audio
- Observe active line highlighting + fill animation
- Tap "Save"

Expected:
- Fill animates smoothly 0→1 as line plays
- Active line highlighted
- Save completes, modal closes
- Lyrics persist to AsyncStorage

- [ ] **Step 7: Test Supabase sync**

Edit lyrics on one device, check if changes sync to another (if multi-device available).

Expected:
- Lyrics saved to AsyncStorage immediately
- Supabase sync happens in background
- Other devices receive real-time update

- [ ] **Step 8: Test long-press editing**

Long-press an active lyric line:

Expected:
- Actions menu appears with options
- "Add note" opens note sheet
- "Highlight" toggles with emoji
- "Delete" removes line
- Changes persist to Supabase

- [ ] **Step 9: Test offline fallback**

Disable network, edit lyrics, go offline:

Expected:
- Lyrics save to AsyncStorage
- When online, Supabase sync catches up

- [ ] **Step 10: Commit test results**

```bash
git add -A
git commit -m "test: verify audio player full integration (manual testing complete)"
```

---

## Completion Checklist

- [ ] All types defined (`lyricTypes.ts`)
- [ ] All utilities working (`lyricsUtils.ts`)
- [ ] AsyncStorage + Supabase sync (`lyricsStorage.ts`, `lyricsSync.ts`)
- [ ] All hooks implemented (`useLyricSync.ts`, `useLongPress.ts`, `useLyrics.ts`)
- [ ] LyricLine component with fill animation
- [ ] InstrumentalCard component
- [ ] SyncEditor (3-step) integrated
- [ ] LyricActions menu
- [ ] AudioPlayerHost enhanced with Edit button
- [ ] Long-press editing works
- [ ] Manual testing complete
- [ ] All commits made

---

## Summary

This plan ports Project Simi's full-featured audio player to React Native + Expo, integrating Supabase for real-time sync. The implementation is modular, testable, and follows TDD principles with frequent commits.

**Key Milestones:**
1. **Phase 1:** Types & Storage (foundation)
2. **Phase 2:** Hooks (state management)
3. **Phase 3:** UI Components (LyricLine, InstrumentalCard)
4. **Phase 4:** SyncEditor (3-step modal)
5. **Phase 5:** AudioPlayerHost Integration
6. **Phase 6:** Long-press Editing
7. **Phase 7:** Testing & Verification

**Total Tasks:** 15  
**Estimated Implementation Time:** 8-12 hours  
**Tech Stack:** React Native, Expo, Supabase, AsyncStorage, Reanimated

---

**Document Status:** Ready for execution  
**Execution Options:** Subagent-Driven or Inline (see below)
