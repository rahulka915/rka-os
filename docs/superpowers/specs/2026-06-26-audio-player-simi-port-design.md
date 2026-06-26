# Audio Player: Full Simi Port to React Native + Supabase

**Document Version:** 1.0  
**Date:** June 26, 2026  
**Platform:** React Native + Expo SDK 54 (Mobile only)  
**Backend:** Supabase  
**Scope:** Full Simi feature set, minus photo linking

---

## Overview

Port Project Simi's comprehensive lyrics-sync audio player to RKA OS mobile (React Native). Full feature set includes:
- MP3 playback with metadata reading
- 3-step guided lyrics editing (Paste → Sync → Preview)
- Real-time karaoke fill animation
- Multi-song queue with shuffle/repeat
- Long-press line editing (notes, highlights)
- Offline-first with Supabase backend sync
- Instrumental scene handling

**Out of scope:**
- Photo linking to memories (no memories feature in RKA OS yet)
- Song registry (users pick local MP3s)
- Cloud storage of audio files (local playback only)

---

## Architecture

### High-Level Flow

```
User picks MP3 from device
    ↓
AudioPlayerHost loads file, reads metadata (title, artist, cover art)
    ↓
Display player UI (playback controls, progress bar, lyrics display)
    ↓
User taps "Edit lyrics" → SyncEditor modal opens
    ↓
3-step workflow: Paste → Sync → Preview
    ↓
On save: lyrics persisted to AsyncStorage + synced to Supabase
    ↓
Real-time subscription: if another device updates, pull changes
```

### Frontend Stack

- **Playback:** Expo Audio (`expo-audio`)
- **Metadata:** Manual MP3 ID3 parsing (from existing AudioPlayerHost)
- **State:** React hooks (useState, useEffect, useRef)
- **Animation:** React Native Animated API + Reanimated (existing)
- **Storage:** React Native AsyncStorage
- **Sync:** Supabase real-time subscriptions

### Backend (Supabase)

**Tables:**

```sql
-- Track metadata (auto-sync from mobile)
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,                    -- hash(title + artist)
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  coverArtUri TEXT,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  userId UUID NOT NULL REFERENCES auth.users(id)
);

-- Normalized lyrics per track
CREATE TABLE lyrics (
  id TEXT PRIMARY KEY,                    -- trackId
  lines JSONB NOT NULL,                   -- LyricLine[]
  updatedAt TIMESTAMP DEFAULT now(),
  userId UUID NOT NULL REFERENCES auth.users(id)
);

-- Create indexes for real-time subscriptions
CREATE INDEX lyrics_userId_idx ON lyrics(userId);
```

**Real-time Policy:**
- User can only read/write their own lyrics
- Subscription: `subscribeLyrics(userId, trackId)` → listen for changes
- On save: `saveLyrics(trackId, lines)` → upsert to lyrics table

---

## Data Model

### LyricLine Type

```typescript
interface LyricLine {
  id?: string;                    // Assigned on load (deterministic hash)
  text: string;                   // Main lyric line
  translation?: string;           // English translation
  script?: string;                // Original script (Hindi, etc.)
  startTime: number;              // Seconds (e.g., 14.50)
  endTime: number;                // Seconds (inferred on save)
  kind?: "lyric" | "instrumental"; // Defaults to "lyric"
  label?: string;                 // Instrumental label (e.g., "Guitar solo")
  style?: "default" | "energetic" | "calm" | "intro" | "outro";
  highlight?: boolean;            // User-marked important
  highlightStyle?: "glow" | "sparkle" | "heart";
  note?: string;                  // User-attached note
}
```

### Track Type

```typescript
interface Track {
  id: string;                     // hash(title + artist)
  title: string;
  artist: string;
  coverArtUri?: string;           // Base64 data URI or URL
  palette: [string, string, string]; // Gradient colors (fallback if no art)
  source: string;                 // Local file URI
  lyrics: LyricLine[];            // Current lyrics (from Supabase or cache)
}
```

---

## Components

### 1. AudioPlayerHost (Enhanced)

**Location:** `apps/mobile/src/components/audio/AudioPlayerHost.tsx`

**Responsibilities:**
- MP3 file picker (DocumentPicker)
- Metadata extraction (ID3 tags)
- Playback control (play/pause, seek, speed)
- Progress bar + time display
- Lyrics display (current active lyric)
- "Edit lyrics" button to open SyncEditor
- Minimized dock when player closed

**Key State:**
```typescript
const [track, setTrack] = useState<Track | null>(null);
const [lyrics, setLyrics] = useState<LyricLine[]>([]);
const [isPlaying, setIsPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [editingOpen, setEditingOpen] = useState(false);
```

**UI Pattern:** Unchanged from existing (dark gradient background, disc artwork, large play button, progress bar)

---

### 2. SyncEditor (RN Adaptation)

**Location:** `apps/mobile/src/components/audio/SyncEditor.tsx`

**Responsibilities:** 3-step guided workflow for lyrics editing

#### Step 1: Paste

**UI:**
- Modal with title "Paste Lyrics"
- Large TextInput multiline, placeholder: `[00:15.00] Script | Text | Translation`
- Parse button ("Next") / validation errors shown below input

**Logic:**
```typescript
function parseRaw(input: string): { lines: DraftLine[]; errors: string[] } {
  const lines = input.split('\n').map((line, i) => {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    const time = match ? parseTimestamp(match[1] + ':' + match[2]) : null;
    const body = match ? match[3] : line;
    const [script = '', text = '', translation = ''] = body.split('|').map(p => p.trim());
    
    return { id: `${i}`, script, text, translation, startTime: time };
  });
  
  const errors = validateTimestamps(lines.map(l => l.startTime));
  return { lines: lines.filter(l => l.script || l.text || l.translation), errors };
}
```

**Validation:**
- Timestamps must be increasing (error: "Line N has earlier timestamp than line N-1")
- Empty lines dropped
- If all lines are already timestamped, show "Skip to preview" button
- If some are untimestamped, show "Next" to go to Step 2

#### Step 2: Sync

**UI:**
- Modal with title "Sync Lyrics"
- Audio player at top: Play/pause, speed (1× / 0.75×), seek bar
- List of lyric lines below (scrollable)
- Per-line row: [Stamp button] | [Editable text fields] | [⋮ menu]

**Per-Line Row:**
```
[L1 / 00:15.50] [editable script] [editable text] [editable translation] [⋮]
```

**Stamp Button:**
- Tap captures `audio.currentTime`
- Shows "Lx" if untimed, shows "mm:ss.xx" if timed
- Auto-advances cursor to next untimed line

**⋮ Menu (per-line long-press):**
- Move up / Move down
- Insert line above / below
- Insert instrumental
- Clear timing (revert to untimed)
- Delete line

**Keyboard Shortcuts:**
- Space: stamp active line
- `[` / `]`: nudge active line ±0.1s

**Logic:**
```typescript
const stampLyricLine = (id: string) => {
  const line = draft.find(l => l.id === id);
  if (line) {
    line.startTime = currentTime;
    setCursor(cursor + 1);
  }
};

const nudge = (id: string, delta: number) => {
  const line = draft.find(l => l.id === id);
  if (line && line.startTime !== null) {
    line.startTime = Math.max(0, round(line.startTime + delta));
  }
};

const insertAfter = (index: number, text: string) => {
  const prev = draft[index];
  const next = draft[index + 1];
  const time = prev?.startTime && next?.startTime 
    ? (prev.startTime + next.startTime) / 2
    : prev?.startTime ? prev.startTime + 1 : null;
  
  draft.splice(index + 1, 0, { id: generateId(), text, startTime: time });
};
```

#### Step 3: Preview

**UI:**
- Modal with title "Preview"
- Audio player at top
- Lyrics display below (read-only)
- Active line highlighted + filled with progress
- "← Back" | "Save" buttons at bottom

**Active Line Display:**
- Filled background color (like karaoke)
- Text color shifts to inverse on active
- Fill percentage shows 0→1 progress across line duration

**Logic:**
```typescript
const buildLines = (): LyricLine[] => {
  const stamped = draft.filter(l => l.startTime !== null);
  return stamped
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
    .map((line, i, arr) => ({
      ...line,
      id: line.id || generateId(),
      endTime: arr[i + 1]?.startTime ?? line.startTime + 4,
      startTime: round(line.startTime ?? 0),
    }));
};
```

---

### 3. LyricLine (RN Component)

**Location:** `apps/mobile/src/components/audio/LyricLine.tsx`

**Responsibilities:** Render a single lyric line with karaoke fill animation

**Props:**
```typescript
interface LyricLineProps {
  line: LyricLine;
  active: boolean;
  progress: number;              // 0→1 fill amount
  onLongPress?: () => void;
  onTap?: () => void;
}
```

**Rendering:**
- **Instrumental (inactive):** Small gray text "♪ Guitar solo"
- **Lyric (inactive):** Script + Text + Translation stacked, 70% opacity
- **Lyric (active):** Same, but with fill animation (background color morphs in)

**Fill Animation:**
- Clip or mask text based on `progress` (0→1)
- Or use linear gradient left-to-right
- Color: theme primary color (blue)

**Long-Press Menu:**
- Tap: Seek to line start time
- Long-press (420ms): Open actions

---

### 4. InstrumentalCard (RN Component)

**Location:** `apps/mobile/src/components/audio/InstrumentalCard.tsx`

**Responsibilities:** Display instrumental section with pulsing animation + style-based doodles

**Props:**
```typescript
interface InstrumentalCardProps {
  label: string;                  // "Guitar solo", etc.
  style?: "default" | "energetic" | "calm" | "intro" | "outro";
  progress: number;               // 0→1 fill
}
```

**Features:**
- Pulsing scale animation (1 → 1.02 → 1)
- Progress bar showing line progress
- Corner doodles per style:
  - `energetic`: sparkle + star (wiggle)
  - `calm`: heart + flourish (float)
  - `intro/outro`: 2× flourish (pulse)
  - `default`: sparkle + heart (pulse)
- Subtle background gradient

---

### 5. useLyricSync Hook

**Location:** `apps/mobile/src/hooks/useLyricSync.ts`

**Responsibilities:** Track active lyric during playback, calculate fill progress

**Signature:**
```typescript
const { activeIndex, progress } = useLyricSync(
  player,                    // Expo Audio player
  lyrics: LyricLine[],
  { updateInterval: 250 }    // Poll interval (ms)
);
```

**Logic:**
- Poll `player.currentTime` every 250ms
- Binary search (`activeAt()`) to find active line
- Calculate `progress = (currentTime - line.startTime) / (line.endTime - line.startTime)`
- Clamp to [0, 1]
- Return activeIndex + progress

**activeAt() binary search:**
```typescript
function activeAt(times: number[], lyrics: LyricLine[], t: number): number {
  let left = 0, right = lyrics.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (lyrics[mid].startTime <= t && t < lyrics[mid].endTime) return mid;
    if (lyrics[mid].startTime > t) right = mid - 1;
    else left = mid + 1;
  }
  return -1;
}
```

---

### 6. useLongPress Hook

**Location:** `apps/mobile/src/hooks/useLongPress.ts`

**Responsibilities:** Detect tap vs. long-press (420ms threshold, 12px tolerance)

**Signature:**
```typescript
const { getEventHandlers } = useLongPress({
  onTap?: () => void,
  onLongPress?: () => void,
  threshold?: 420,           // ms
  tolerance?: 12,            // pt
});

<Pressable {...getEventHandlers()} />
```

**Behavior:**
- Start pointer down: begin timer
- Move >12px or release <420ms: fire onTap
- Hold >420ms without moving: fire onLongPress
- Cancel if moved >12px

---

## Storage Layer

### Local Storage (AsyncStorage)

**Key:** `lyrics:${trackId}`  
**Value:** `JSON.stringify(normalized[])`

**Flow:**
1. On load: `loadLyrics(trackId)` checks AsyncStorage, falls back to empty
2. On save: write to AsyncStorage immediately (offline-safe)
3. On app launch: pull from Supabase if available

### Remote Storage (Supabase)

**subscribeLyrics(userId, trackId):**
```typescript
function subscribeLyrics(userId: string, trackId: string) {
  return supabase
    .from('lyrics')
    .on('*', (payload) => {
      if (payload.new.userId === userId) {
        const lines = normalizeLyricLines(payload.new.lines);
        setLyrics(lines);
      }
    })
    .subscribe();
}
```

**saveLyrics(trackId, lines):**
```typescript
async function saveLyrics(userId: string, trackId: string, lines: LyricLine[]) {
  const normalized = normalizeLyricLines(lines);
  
  // 1. Local (instant)
  await AsyncStorage.setItem(`lyrics:${trackId}`, JSON.stringify(normalized));
  
  // 2. Remote (async)
  const { error } = await supabase
    .from('lyrics')
    .upsert({ id: trackId, lines: normalized, userId })
    .eq('userId', userId);
  
  if (error) console.error('Sync failed:', error);
}
```

---

## Long-Press Editing (Phase E)

User long-presses any lyric line in player (not edit mode):

**Actions Menu:**
1. **Edit lyrics** → Opens SyncEditor modal for full workflow
2. **Add/edit note** → Half-sheet with textarea, saves to line.note
3. **Highlight toggle** → Toggles line.highlight + line.highlightStyle (random sparkle/glow/heart)
4. **Delete line** → Removes from lyrics, saves

**Implementation:**
```typescript
const [actionsFor, setActionsFor] = useState<string | null>(null);
const [noteFor, setNoteFor] = useState<string | null>(null);

<LyricLine
  onLongPress={() => setActionsFor(line.id)}
  {...props}
/>

{actionsFor && (
  <ActionSheet onClose={() => setActionsFor(null)}>
    <Button onPress={() => setEditingOpen(true)}>Edit lyrics</Button>
    <Button onPress={() => setNoteFor(actionsFor)}>Add/edit note</Button>
    <Button onPress={() => toggleHighlight(actionsFor)}>Highlight</Button>
    <Button onPress={() => deleteLine(actionsFor)}>Delete</Button>
  </ActionSheet>
)}
```

---

## File Structure

```
apps/mobile/src/
├── components/audio/
│   ├── AudioPlayerHost.tsx        (core player, load MP3, playback controls)
│   ├── SyncEditor.tsx             (3-step modal: Paste → Sync → Preview)
│   ├── LyricLine.tsx              (per-line rendering with fill animation)
│   ├── InstrumentalCard.tsx       (instrumental scene display)
│   └── LyricActions.tsx           (long-press menu: edit, note, highlight, delete)
├── hooks/
│   ├── useLyricSync.ts            (activeAt binary search + fill progress)
│   ├── useLyrics.ts               (state: current lyrics, track, queue)
│   └── useLongPress.ts            (420ms tap/long-press detection)
├── lib/
│   ├── lyricTypes.ts              (LyricLine, Track types)
│   ├── lyricsStorage.ts           (loadLyrics, saveLyrics, subscribe)
│   ├── lyricsUtils.ts             (normalize, parse, validate, format)
│   └── mp3Parser.ts               (ID3 metadata extraction)
└── services/
    └── lyricsSync.ts              (Supabase subscription + sync logic)
```

---

## Normalization & ID Assignment

**On Load:**
- Every LyricLine without an `id` gets assigned one: `generateId(index, text)` (deterministic FNV-1a hash)
- Same text → same ID across reloads (stable)
- `kind` defaults to "lyric" unless text starts with `♪` or `kind === "instrumental"`

**On Save:**
- Normalize all lines
- Round times to 2 decimals
- Infer `endTime` = next line's start or +4s for last line
- Clean for Supabase: omit default fields (kind: "lyric", style: "default", highlightStyle: "glow")
- Persist to AsyncStorage + Supabase

---

## Gotchas & Constraints

1. **Centisecond Precision:** Times use 2 decimal places (14.50 = 14 seconds 50 centiseconds)
2. **Timestamp Validation:** Must be increasing; user gets error + "Sort by time" button
3. **Unstamped Lines Dropped:** Step 3 preview only shows stamped lines; user warned in Step 2
4. **ID Stability:** ID assigned on load, stable across reloads (not on creation)
5. **asyncStorage SSR Safety:** Read AsyncStorage in useEffect, not useState initializer
6. **Supabase Real-time:** Subscription only triggers on actual data changes, not every poll
7. **Offline-first:** Always save to AsyncStorage first, then async sync to Supabase
8. **No Photo Linking:** Removed entirely (no memories feature)
9. **Local MP3 Only:** No song registry; users pick files from device each session
10. **Reanimated Gotcha:** Use Animated API for rAF fill progress, not state updates per frame

---

## Testing Strategy

### Unit Tests
- `lyricsUtils.ts` — normalize, parse, validate functions
- `lyricTypes.ts` — type guards

### Integration Tests
- **SyncEditor workflow** — Paste → Sync → Preview → Save
  - Parse validation (increasing timestamps)
  - Stamp mechanics (capture currentTime)
  - buildLines (filter, sort, infer endTime)
  - Supabase persistence (async save)
- **useLyricSync** — activeAt binary search, progress calculation
- **useLongPress** — 420ms threshold, 12px tolerance

### E2E Tests (Manual)
- Load MP3, metadata reading
- Paste lyrics with timestamps
- Stamp during playback, nudge ±0.1s
- Reorder, insert, delete lines
- Preview playback (fill animation)
- Save, reload app, verify Supabase sync
- Long-press line, edit note, highlight, delete
- Offline: edit lyrics, then sync when online

---

## Implementation Phases

### Phase 1: Core Types & Storage
- LyricLine type + normalization
- AsyncStorage layer
- Supabase schema + subscription

### Phase 2: Player Shell
- AudioPlayerHost (enhanced with Edit button)
- MP3 loading, metadata, playback controls
- Progress bar, time display

### Phase 3: SyncEditor (3-Step)
- Step 1: Paste + validation
- Step 2: Sync + stamping + line editing
- Step 3: Preview + save to Supabase

### Phase 4: UI Polish
- LyricLine rendering + fill animation
- InstrumentalCard display
- Long-press editing menu
- Styling, animations, haptics

### Phase 5: Real-time Sync
- Supabase subscription integration
- Multi-device sync testing
- Offline fallback verification

---

## Dependencies

- `expo-audio` — playback (already installed)
- `expo-document-picker` — file picker (already used)
- `@react-native-async-storage/async-storage` — local storage
- `@supabase/supabase-js` — Supabase client
- `expo-haptics` — haptic feedback (already used)
- Reanimated 3+ — animation (already installed)

**No new major dependencies required.**

---

## Success Criteria

✅ User can pick local MP3 file and play it  
✅ Metadata (title, artist, cover) auto-extracted from ID3 tags  
✅ User can paste lyrics with `[mm:ss.xx]` timestamps  
✅ Timestamp validation shows errors and "Sort by time" button  
✅ Sync step: tap "Stamp" button captures current time  
✅ Tap to move active line during sync, space/`[`/`]` shortcuts work  
✅ Preview shows active line with fill animation (0→1 progress)  
✅ Save persists to AsyncStorage + Supabase  
✅ Long-press lyric line opens actions menu (edit, note, highlight, delete)  
✅ Multi-device sync: edit on phone A, pull on phone B  
✅ Offline: edit lyrics, save when online syncs to Supabase  
✅ All gestures include haptic feedback  
✅ Karaoke fill animation smooth (no jank)  

---

## Summary

This design adapts Project Simi's full-featured lyrics sync player to React Native + Supabase. Key highlights:

- **Full feature parity** with Simi (karaoke, editing, queue, long-press)
- **Supabase backend** for lightweight, scalable sync
- **Offline-first** (AsyncStorage + async Supabase push)
- **No photo linking** (deferred until memories feature exists)
- **Lightweight scope** (local MP3s, no song registry)
- **Mobile-optimized** UI (Things 3 aesthetic, RN primitives)

Ready for implementation after approval.

---

**Document Status:** Ready for review  
**Next Step:** Implementation plan (writing-plans skill)
