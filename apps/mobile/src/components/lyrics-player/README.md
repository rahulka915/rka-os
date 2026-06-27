# `lyrics-player`

Reusable Expo Go compatible synced lyrics prototype built with React Native, TypeScript, and `expo-audio`.

## Install

```bash
npx expo install expo-audio
```

## Where to place it

Drop the whole folder at:

```text
apps/mobile/src/components/lyrics-player
```

In another Expo project, place it under your components directory so you can import it like:

```ts
import { SyncedLyricsPlayer } from "@/components/lyrics-player";
```

## Example usage

```tsx
import { SyncedLyricsPlayer } from "@/components/lyrics-player";

export default function LyricsScreen() {
  return <SyncedLyricsPlayer />;
}
```

## What it includes

- Raw lyric parsing for lines like:
  `[00:15.00] Punjabi | Romanised | English translation`
- Timestamp conversion to milliseconds
- `endMs` generation from the next lyric line
- Binary-search active lyric lookup
- Offset nudging with `-250ms` and `+250ms`
- Auto-scroll to the active lyric
- Auto-scroll pause while the user manually scrolls
- Tap any lyric line to seek playback
- Display modes:
  `all`, `romanised`, `translation`
- Dark premium UI
- Expo Go compatible playback using `useAudioPlayer` and `useAudioPlayerStatus`

## Passing your own lyrics and audio

```tsx
import { SyncedLyricsPlayer } from "@/components/lyrics-player";

const rawLyrics = `
[00:15.00] Punjabi line | Romanised line | English translation
[00:19.00] Next line | Next romanised line | Next translation
`.trim();

export default function LyricsScreen() {
  return (
    <SyncedLyricsPlayer
      title="My Song"
      artist="My Artist"
      rawLyrics={rawLyrics}
      audioSource="https://example.com/my-song.mp3"
    />
  );
}
```

For a local bundled file, replace the default remote source with:

```tsx
// Example:
// audioSource={require("../../assets/your-song.mp3")}
```

## Exports

- `SyncedLyricsPlayer`
- `parseLyrics`
- `findActiveLyricIndex`
- relevant TypeScript types from `types.ts`
