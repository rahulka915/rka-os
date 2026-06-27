import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronDown,
  ChevronUp,
  Disc3,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Upload,
  X,
} from '../../icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useThemeContext } from '../../hooks/useThemeContext';
import { DragHandle } from '../ui/DragHandle';
import { SyncEditor } from './SyncEditor';
import { LyricActions } from './LyricActions';
import { LyricLine as PlaybackLyricRow } from './LyricLine';
import { BY_MY_SIDE_DEMO_LYRICS } from './demoByMySide';
import { saveLyrics } from '../../services/lyricsSync';
import { saveLastTrack, loadLastTrack, loadLyrics, loadTrackVisual, saveTrackVisual } from '../../lib/lyricsStorage';
import { getLyricScrollTarget, useLyricSync } from '../../hooks/useLyricSync';

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  subtitle: string;
  source: string | number;
  coverArtUri?: string;
  visualArtUri?: string;
  palette: [string, string, string];
};

type LyricLine = {
  id: string;
  original: string;
  romanization: string;
  translation: string;
  time: number | null;
  note?: string;
};

type PersistedLyricLine = {
  id: string;
  text: string;
  translation: string;
  script: string;
  startTime: number;
  endTime: number;
  note?: string;
};

const SAMPLE_TRACK: AudioTrack = {
  id: 'demo-by-my-side',
  title: 'By My Side',
  artist: 'AP Dhillon',
  subtitle: 'Bundled demo with synced lyrics',
  source: require('../../../assets/audio/ap-dhillon-by-my-side.mp3'),
  palette: ['#08141c', '#12343a', '#d59e5f'],
};

const PALLETTES: Array<[string, string, string]> = [
  ['#0b1020', '#23324d', '#7c5cff'],
  ['#111827', '#4c1d95', '#f472b6'],
  ['#09131f', '#0f766e', '#84cc16'],
  ['#140f1f', '#5b21b6', '#f59e0b'],
  ['#111827', '#b91c1c', '#fb7185'],
];

function hashPalette(seed: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALLETTES[Math.abs(hash) % PALLETTES.length];
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function splitLyricText(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function parseTimestamp(value: string) {
  const match = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parsePastedTimedLyrics(text: string): LyricLine[] {
  return splitLyricText(text).map((line, index) => {
    const match = line.match(/^\[(\d+:\d+(?:\.\d+)?)\]\s*(.*)$/);
    const time = match ? parseTimestamp(match[1]) : null;
    const body = match ? match[2] : line;
    const [original = '', romanization = '', translation = ''] = body
      .split('|')
      .map(part => part.trim());

    return {
      id: `${Date.now()}-${index}`,
      original,
      romanization,
      translation,
      time,
    };
  }).filter(line => line.original || line.romanization || line.translation);
}

function decodeBase64(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of base64.replace(/\s/g, '')) {
    if (char === '=') break;
    const value = chars.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

function syncSafeToInt(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 21) |
    (bytes[offset + 1] << 14) |
    (bytes[offset + 2] << 7) |
    bytes[offset + 3]
  );
}

function int32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

function latin1(bytes: Uint8Array) {
  return Array.from(bytes, byte => String.fromCharCode(byte)).join('');
}

function decodeTextFrame(bytes: Uint8Array) {
  if (bytes.length <= 1) return '';
  const encoding = bytes[0];
  const payload = bytes.slice(1);
  if (encoding === 1 || encoding === 2) {
    const littleEndian = encoding === 1 && payload[0] === 0xff && payload[1] === 0xfe;
    const start = encoding === 1 && (payload[0] === 0xff || payload[0] === 0xfe) ? 2 : 0;
    const chars: string[] = [];
    for (let i = start; i + 1 < payload.length; i += 2) {
      const code = littleEndian ? payload[i] | (payload[i + 1] << 8) : (payload[i] << 8) | payload[i + 1];
      if (code === 0) break;
      chars.push(String.fromCharCode(code));
    }
    return chars.join('').trim();
  }
  return latin1(payload).replace(/\0/g, '').trim();
}

function findTerminator(bytes: Uint8Array, start: number, encoding: number) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2;
    }
    return bytes.length;
  }
  const index = bytes.indexOf(0, start);
  return index === -1 ? bytes.length : index + 1;
}

function readApicFrame(bytes: Uint8Array) {
  if (bytes.length < 5) return null;
  const encoding = bytes[0];
  const mimeEnd = bytes.indexOf(0, 1);
  if (mimeEnd === -1) return null;
  const mimeType = latin1(bytes.slice(1, mimeEnd)) || 'image/jpeg';
  const descriptionEnd = findTerminator(bytes, mimeEnd + 2, encoding);
  const imageBytes = bytes.slice(descriptionEnd);
  if (!imageBytes.length) return null;

  let binary = '';
  for (let i = 0; i < imageBytes.length; i += 1) {
    binary += String.fromCharCode(imageBytes[i]);
  }
  const encoded = globalThis.btoa?.(binary);
  if (!encoded) return null;
  return `data:${mimeType};base64,${encoded}`;
}

async function readMp3Metadata(uri: string) {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const bytes = decodeBase64(base64);
    if (latin1(bytes.slice(0, 3)) !== 'ID3') return {};

    const majorVersion = bytes[3];
    const tagSize = syncSafeToInt(bytes, 6);
    const tagEnd = Math.min(bytes.length, 10 + tagSize);
    let offset = 10;
    const metadata: { title?: string; artist?: string; coverArtUri?: string } = {};

    while (offset + 10 <= tagEnd) {
      const frameId = latin1(bytes.slice(offset, offset + 4));
      if (!frameId.trim()) break;
      const frameSize = majorVersion === 4 ? syncSafeToInt(bytes, offset + 4) : int32(bytes, offset + 4);
      const frameStart = offset + 10;
      const frameEnd = Math.min(frameStart + frameSize, tagEnd);
      const frame = bytes.slice(frameStart, frameEnd);

      if (frameId === 'TIT2') metadata.title = decodeTextFrame(frame);
      if (frameId === 'TPE1') metadata.artist = decodeTextFrame(frame);
      if (frameId === 'APIC' && !metadata.coverArtUri) metadata.coverArtUri = readApicFrame(frame) ?? undefined;

      offset = frameEnd;
    }

    return metadata;
  } catch {
    return {};
  }
}

function ControlButton({
  onPress,
  disabled,
  children,
  size = 54,
  backgroundColor = 'rgba(255,255,255,0.08)',
  accessibilityLabel,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: number;
  backgroundColor?: string;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[
        styles.controlButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

function TrackArt({ track }: { track: AudioTrack }) {
  const artUri = track.visualArtUri ?? track.coverArtUri;

  if (artUri) {
    return (
      <View style={styles.artShell}>
        <Image source={{ uri: artUri }} style={styles.coverArt} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={styles.artShell}>
      <LinearGradient colors={track.palette} style={StyleSheet.absoluteFillObject} />
      <View style={styles.artGlow} />
      <View style={styles.artInner}>
        <Disc3 size={64} color="rgba(255,255,255,0.95)" strokeWidth={1.3} />
        <Text style={styles.artLabel}>MP3</Text>
      </View>
    </View>
  );
}

function WaveformBackdrop({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const bars = useRef(Array.from({ length: 14 }, () => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (reduceMotion) {
      bars.forEach((bar) => bar.setValue(0.5));
      return;
    }
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 70),
          Animated.timing(bar, {
            toValue: 1,
            duration: 620 + (index % 4) * 110,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 620 + ((index + 2) % 4) * 120,
            useNativeDriver: true,
          }),
        ])
      )
    );

    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
      bars.forEach((bar) => bar.stopAnimation());
    };
  }, [bars, reduceMotion]);

  return (
    <View style={styles.waveformWrap} pointerEvents="none">
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            reduceMotion
              ? { opacity: 0.5 }
              : {
                  transform: [{ scaleY: bar }],
                  opacity: bar.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.28, 0.82],
                  }),
                },
          ]}
        />
      ))}
    </View>
  );
}

function LyricsBackdrop({
  uri,
  palette,
}: {
  uri?: string | null;
  palette: [string, string, string];
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {uri ? (
        <Image source={{ uri }} style={styles.backdropImage} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[palette[0], palette[1], '#05070b']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <LinearGradient
        colors={[
          'rgba(5,7,11,0.22)',
          'rgba(5,7,11,0.56)',
          'rgba(5,7,11,0.86)',
          'rgba(5,7,11,0.98)',
        ]}
        locations={[0, 0.28, 0.68, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.backdropNoise} />
    </View>
  );
}

function MiniTrackHeader({ track }: { track: AudioTrack }) {
  const artUri = track.visualArtUri ?? track.coverArtUri;
  return (
    <View style={styles.miniTrackHeader}>
      <View style={styles.miniArtShell}>
        {artUri ? (
          <Image source={{ uri: artUri }} style={styles.miniArtImage} resizeMode="cover" />
        ) : (
          <>
            <LinearGradient colors={track.palette} style={StyleSheet.absoluteFillObject} />
            <Disc3 size={20} color="rgba(255,255,255,0.9)" strokeWidth={1.6} />
          </>
        )}
      </View>
      <View style={styles.miniTrackCopy}>
        <Text style={styles.miniTrackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.miniTrackArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
    </View>
  );
}

export function AudioPlayerHost({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [progressWidth, setProgressWidth] = useState(0);
  const [editingOpen, setEditingOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [lyricsViewportHeight, setLyricsViewportHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dockAnim = useRef(new Animated.Value(0)).current;
  const lyricsScrollRef = useRef<ScrollView | null>(null);
  const lyricRowOffsetsRef = useRef<Record<string, number>>({});
  const autoScrollResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollYRef = useRef(0);
  const lastSettledLyricTargetRef = useRef<number | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);

  // Mobile auth is not wired here yet, so remote lyric sync is disabled until a real user id is available.
  const userId: string | null = null;

  const activeTrack = track ?? (open ? SAMPLE_TRACK : null);
  const player = useAudioPlayer(activeTrack?.source ?? null, { updateInterval: 90 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = Boolean(status.playing);
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const emptyLyrics = lyricLines.length === 0;
  const lyricsBackdropUri = activeTrack?.visualArtUri ?? activeTrack?.coverArtUri ?? null;

  const sourceLabel = useMemo(() => {
    if (!activeTrack) return '';
    return activeTrack.id === SAMPLE_TRACK.id ? 'Demo sample' : 'Local MP3';
  }, [activeTrack]);
  const availableLyricsHeight = lyricsViewportHeight > 0
    ? lyricsViewportHeight
    : Math.max(260, screenHeight - insets.top - insets.bottom - 150);
  const lyricAnchorY = Math.round(availableLyricsHeight * 0.445);
  const lyricTopPadding = Math.max(132, lyricAnchorY - 72);
  const lyricBottomPadding = Math.max(132, Math.round(availableLyricsHeight * 0.58));

  const playbackLyrics = useMemo(() => {
    const stamped = lyricLines
      .filter((line): line is LyricLine & { time: number } => line.time !== null)
      .sort((a, b) => a.time - b.time);

    return stamped.map((line, index, arr) => ({
      id: line.id,
      text: line.original,
      script: line.romanization || undefined,
      translation: line.translation || undefined,
      startTime: line.time,
      endTime: arr[index + 1]?.time ?? line.time + 4,
      note: line.note,
    }));
  }, [lyricLines]);

  const { activeIndex, progress: lyricProgress } = useLyricSync(currentTime, playbackLyrics);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    // Restore last track + lyrics on mount
    loadLastTrack().then(async (saved) => {
      if (!saved) return;
      const restored: AudioTrack = {
        id: saved.id,
        title: saved.title,
        artist: saved.artist,
        subtitle: 'Local MP3',
        source: saved.source,
        coverArtUri: saved.coverArtUri,
        visualArtUri: saved.visualArtUri,
        palette: saved.palette,
      };
      const savedVisual = await loadTrackVisual(saved.id);
      if (savedVisual) {
        restored.visualArtUri = savedVisual;
      }
      setTrack(restored);

      const savedLyrics = await loadLyrics(saved.id);
      if (savedLyrics.length > 0) {
        setLyricLines(
          savedLyrics.map((l) => ({
            id: l.id || '',
            original: l.text,
            romanization: l.script || '',
            translation: l.translation || '',
            time: l.startTime ?? null,
            note: l.note,
          }))
        );
      } else if (saved.id === SAMPLE_TRACK.id) {
        setLyricLines(BY_MY_SIDE_DEMO_LYRICS);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && !track) {
      setTrack(SAMPLE_TRACK);
    }
  }, [open, track]);

  useEffect(() => {
    if (activeTrack?.id === SAMPLE_TRACK.id && lyricLines.length === 0) {
      setLyricLines(BY_MY_SIDE_DEMO_LYRICS);
    }
  }, [activeTrack?.id, lyricLines.length]);

  useEffect(() => {
    Animated.timing(dockAnim, {
      toValue: track && !open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [dockAnim, open, track]);

  useEffect(() => {
    return () => {
      if (autoScrollResumeRef.current) {
        clearTimeout(autoScrollResumeRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoScrollPaused || playbackLyrics.length === 0) return;
    const targetY = getLyricScrollTarget({
      lyrics: playbackLyrics,
      activeIndex,
      progress: lyricProgress,
      currentTime,
      rowOffsets: lyricRowOffsetsRef.current,
      anchorY: lyricAnchorY,
      preRollSeconds: 6.5,
      preRollTravel: 64,
    });
    if (targetY === null) return;

    const currentScrollY = scrollYRef.current;
    if (!isPlaying) {
      if (lastSettledLyricTargetRef.current !== null && Math.abs(lastSettledLyricTargetRef.current - targetY) < 0.5) {
        return;
      }
      lastSettledLyricTargetRef.current = targetY;
      scrollYRef.current = targetY;
      lyricsScrollRef.current?.scrollTo({
        y: targetY,
        animated: false,
      });
      return;
    }

    const smoothing = activeIndex < 0 ? 0.16 : 0.22;
    const nextScrollY = currentScrollY + (targetY - currentScrollY) * smoothing;

    if (Math.abs(nextScrollY - currentScrollY) < 0.5) return;

    lastSettledLyricTargetRef.current = null;
    scrollYRef.current = nextScrollY;
    lyricsScrollRef.current?.scrollTo({
      y: nextScrollY,
      animated: false,
    });
  }, [activeIndex, autoScrollPaused, currentTime, isPlaying, lyricAnchorY, lyricProgress, playbackLyrics]);

  const seekBy = (deltaSeconds: number) => {
    if (!activeTrack) return;
    const next = Math.max(0, Math.min(duration || currentTime + deltaSeconds, currentTime + deltaSeconds));
    void player.seekTo(next).catch(() => {});
  };

  const togglePlay = () => {
    if (!activeTrack) return;
    if (isPlaying) {
      player.pause();
      return;
    }
    if (duration > 0 && currentTime >= duration - 0.4) {
      void player.seekTo(0).catch(() => {});
    }
    player.play();
  };

  const pauseAutoScrollTemporarily = () => {
    setAutoScrollPaused(true);
    if (autoScrollResumeRef.current) {
      clearTimeout(autoScrollResumeRef.current);
    }
    autoScrollResumeRef.current = setTimeout(() => {
      setAutoScrollPaused(false);
    }, 1600);
  };

  const loadFromDevice = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const metadata = await readMp3Metadata(asset.uri);
    const fallbackTitle = stripExtension(asset.name) || 'Local MP3';
    const title = metadata.title || fallbackTitle;
    const nextTrack: AudioTrack = {
      id: asset.uri,
      title,
      artist: metadata.artist || 'Local file',
      subtitle: 'Picked from your device',
      source: asset.uri,
      coverArtUri: metadata.coverArtUri,
      palette: hashPalette(title || asset.uri),
    };
    const savedVisual = await loadTrackVisual(asset.uri);
    if (savedVisual) {
      nextTrack.visualArtUri = savedVisual;
    }

    player.pause();
    void player.seekTo(0).catch(() => {});
    setTrack(nextTrack);
    setLyricLines([]);

    // Persist track + any existing lyrics for this track
    saveLastTrack({
      id: nextTrack.id,
      title: nextTrack.title,
      artist: nextTrack.artist,
      source: nextTrack.source,
      coverArtUri: nextTrack.coverArtUri,
      visualArtUri: nextTrack.visualArtUri,
      palette: nextTrack.palette,
    }).catch(() => {});

    // Load any previously saved lyrics for this file
    loadLyrics(nextTrack.id).then((saved) => {
      if (saved.length > 0) {
        setLyricLines(
          saved.map((l) => ({
            id: l.id || '',
            original: l.text,
            romanization: l.script || '',
            translation: l.translation || '',
            time: l.startTime ?? null,
            note: l.note,
          }))
        );
      }
    }).catch(() => {});

    onOpen();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const dismissTrack = () => {
    player.pause();
    void player.seekTo(0).catch(() => {});
    setTrack(null);
    setLyricLines([]);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const uploadVisual = async () => {
    if (!track) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const visualArtUri = result.assets[0].uri;
    const updatedTrack: AudioTrack = {
      ...track,
      visualArtUri,
    };

    setTrack(updatedTrack);
    await saveTrackVisual(track.id, visualArtUri);
    await saveLastTrack({
      id: updatedTrack.id,
      title: updatedTrack.title,
      artist: updatedTrack.artist,
      source: updatedTrack.source,
      coverArtUri: updatedTrack.coverArtUri,
      visualArtUri: updatedTrack.visualArtUri,
      palette: updatedTrack.palette,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const buildPersistedLyrics = (lines: LyricLine[]): PersistedLyricLine[] => {
    const stamped = lines
      .filter((line): line is LyricLine & { time: number } => line.time !== null)
      .sort((a, b) => a.time - b.time);

    return stamped.map((line, index, arr) => ({
      id: line.id,
      text: line.original,
      translation: line.translation,
      script: line.romanization,
      startTime: line.time,
      endTime: arr[index + 1]?.time ?? line.time + 4,
      note: line.note,
    }));
  };

  const dockTranslate = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar style="light" />
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['#05070b', '#0d121b', '#1a1520', '#25171a']}
              locations={[0, 0.36, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassOverlay} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContent}
          >
            <DragHandle isDark width={44} style={styles.handle} />

            {/* ── Header ── */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={styles.headerIconButton}
                hitSlop={10}
                accessibilityLabel="Close player"
                accessibilityRole="button"
              >
                <ChevronDown size={18} color="rgba(255,255,255,0.92)" strokeWidth={1.8} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerLabel}>Audio Player</Text>
                <Text style={styles.headerMeta}>{sourceLabel}</Text>
              </View>

              <View style={styles.headerButtons}>
                <TouchableOpacity
                  onPress={() => setEditingOpen(true)}
                  activeOpacity={0.8}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={loadFromDevice}
                  activeOpacity={0.8}
                  style={styles.pickButton}
                >
                  <Upload size={14} color="#f8fafc" strokeWidth={2} />
                  <Text style={styles.pickButtonText}>MP3</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Mini track header (only when lyrics exist) ── */}
            {!emptyLyrics && activeTrack && (
              <MiniTrackHeader track={activeTrack} />
            )}

            {/* ── Content: flex:1, never overlapped by controls ── */}
            <View style={styles.content}>
              <LyricsBackdrop
                uri={lyricsBackdropUri}
                palette={(activeTrack ?? SAMPLE_TRACK).palette}
              />

              {emptyLyrics ? (
                <>
                  <View style={styles.trackCopy}>
                    <Text style={styles.trackTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {activeTrack?.title ?? SAMPLE_TRACK.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {activeTrack?.artist ?? SAMPLE_TRACK.artist}
                    </Text>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {activeTrack?.subtitle ?? SAMPLE_TRACK.subtitle}
                    </Text>
                  </View>
                  <View style={styles.emptyLyricsFullscreen}>
                    <View style={styles.emptyArtworkShell}>
                      {!lyricsBackdropUri ? <WaveformBackdrop reduceMotion={reduceMotion} /> : null}
                      <View style={styles.emptyArtworkGlow} />
                      <View style={styles.emptyLyricsCopy}>
                        <Text style={styles.lyricsKicker}>Lyrics</Text>
                        <Text style={styles.emptyLyricsTitle}>
                          {lyricsBackdropUri ? 'No synced lyrics yet' : 'Add lyrics for full-screen playback'}
                        </Text>
                        <Text style={styles.emptyLyricsBody}>
                          {lyricsBackdropUri
                            ? 'Artwork is ready. Add synced lyrics to switch into the immersive player.'
                            : 'Upload artwork or keep the animated backdrop, then add synced lyrics.'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.emptyLyricsActions}>
                      <TouchableOpacity onPress={() => setEditingOpen(true)} activeOpacity={0.82} style={styles.emptyPrimaryButton}>
                        <Text style={styles.emptyPrimaryButtonText}>Add lyrics</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={uploadVisual} activeOpacity={0.82} style={styles.emptySecondaryButton}>
                        <Upload size={14} color="#ffffff" strokeWidth={2} />
                        <Text style={styles.emptySecondaryButtonText}>
                          {lyricsBackdropUri ? 'Change image' : 'Upload image'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View
                  onLayout={(event) => {
                    setLyricsViewportHeight(event.nativeEvent.layout.height);
                  }}
                  style={styles.lyricsViewport}
                >
                  <LinearGradient
                    colors={['rgba(5,7,11,0.82)', 'rgba(5,7,11,0.08)', 'rgba(5,7,11,0)']}
                    locations={[0, 0.52, 1]}
                    pointerEvents="none"
                    style={styles.lyricsTopScrim}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.055)', 'rgba(255,255,255,0)']}
                    locations={[0, 0.5, 1]}
                    pointerEvents="none"
                    style={[styles.lyricsFocusGlow, { top: lyricAnchorY - 104 }]}
                  />
                  <LinearGradient
                    colors={['rgba(5,7,11,0)', 'rgba(5,7,11,0.14)', 'rgba(5,7,11,0.88)']}
                    locations={[0, 0.36, 1]}
                    pointerEvents="none"
                    style={styles.lyricsBottomScrim}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(5,7,11,0)', 'rgba(5,7,11,0)', 'rgba(5,7,11,0.92)']}
                    locations={[0, 0.72, 1]}
                    style={styles.lyricsBottomFade}
                  />
                  <ScrollView
                    ref={lyricsScrollRef}
                    style={styles.lyricsScroll}
                    contentContainerStyle={[
                      styles.lyricsFullscreenContent,
                      { paddingTop: lyricTopPadding, paddingBottom: lyricBottomPadding },
                    ]}
                    showsVerticalScrollIndicator={false}
                    onScrollBeginDrag={pauseAutoScrollTemporarily}
                    onMomentumScrollBegin={pauseAutoScrollTemporarily}
                    onScrollEndDrag={pauseAutoScrollTemporarily}
                    onMomentumScrollEnd={pauseAutoScrollTemporarily}
                    onScroll={(event) => {
                      scrollYRef.current = event.nativeEvent.contentOffset.y;
                    }}
                    scrollEventThrottle={16}
                  >
                    {playbackLyrics.map((line, index) => {
                      const isCurrent = index === activeIndex;
                      const focusDistance = activeIndex >= 0 ? Math.abs(index - activeIndex) : 3;
                      const focusOffset = activeIndex >= 0 ? index - activeIndex : index;
                      return (
                        <Pressable
                          key={line.id}
                          onPress={() => {
                            void player.seekTo(line.startTime).catch(() => {});
                          }}
                          onLongPress={() => {
                            setActionsFor(line.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          }}
                          onLayout={(event) => {
                            lyricRowOffsetsRef.current[line.id] = event.nativeEvent.layout.y;
                          }}
                          style={styles.fullscreenLyricPressable}
                          accessibilityRole="button"
                          accessibilityLabel={line.text}
                          accessibilityHint="Seek to this lyric"
                        >
                          <PlaybackLyricRow
                            line={line}
                            active={isCurrent}
                            progress={isCurrent ? lyricProgress : 0}
                            focusDistance={focusDistance}
                            focusOffset={focusOffset}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ── Controls: in normal flow, below lyrics ── */}
            <View style={styles.bottomPlayerDock}>
              <View style={styles.progressGlass}>
                <Pressable
                  onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)}
                  onPress={(event) => {
                    if (!duration || progressWidth <= 0) return;
                    const next = Math.min(
                      duration,
                      Math.max(0, (event.nativeEvent.locationX / progressWidth) * duration),
                    );
                    void player.seekTo(next).catch(() => {});
                  }}
                  style={styles.progressTrack}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Playback position"
                  accessibilityValue={{ now: Math.round(currentTime), min: 0, max: Math.round(duration) }}
                >
                  <View style={styles.progressBase} />
                  <View style={[styles.progressFill, { width: `${Math.max(0, progress * 100)}%` }]} />
                  <View style={[styles.progressThumb, { left: `${Math.max(0, progress * 100)}%` }]} />
                </Pressable>

                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(Math.max(0, duration - currentTime))}</Text>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <ControlButton
                  onPress={() => seekBy(-15)}
                  size={52}
                  backgroundColor="rgba(255,255,255,0.12)"
                  accessibilityLabel="Skip back 15 seconds"
                >
                  <SkipBack size={22} color="#f8fafc" strokeWidth={1.9} />
                </ControlButton>

                <ControlButton
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    togglePlay();
                  }}
                  size={88}
                  backgroundColor="#f8fafc"
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause size={34} color="#0c1018" strokeWidth={2.4} />
                  ) : (
                    <Play size={34} color="#0c1018" fill="#0c1018" strokeWidth={2.1} />
                  )}
                </ControlButton>

                <ControlButton
                  onPress={() => seekBy(15)}
                  size={52}
                  backgroundColor="rgba(255,255,255,0.12)"
                  accessibilityLabel="Skip forward 15 seconds"
                >
                  <SkipForward size={22} color="#f8fafc" strokeWidth={1.9} />
                </ControlButton>
              </View>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingOpen(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  activeOpacity={0.8}
                  style={styles.footerPill}
                >
                  <Text style={styles.footerPillText}>Edit lyrics</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={loadFromDevice}
                  activeOpacity={0.8}
                  style={styles.footerPill}
                >
                  <Upload size={14} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
                  <Text style={styles.footerPillText}>Load MP3</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
        <SyncEditor
          open={editingOpen}
          onClose={() => setEditingOpen(false)}
          onSave={async (newLyrics) => {
            await saveLyrics(userId, track!.id, newLyrics);
            setLyricLines(
              newLyrics.map((l) => ({
                id: l.id || '',
                original: l.text,
                romanization: l.script || '',
                translation: l.translation || '',
                time: l.startTime,
              }))
            );
          }}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onPlayPause={togglePlay}
          onSeek={(t) => { void player.seekTo(t).catch(() => {}); }}
          onSetSpeed={(rate) => { player.playbackRate = rate; }}
          initialLyrics={playbackLyrics}
        />

        <LyricActions
          open={!!actionsFor}
          line={lyricLines.find((l) => l.id === actionsFor) ? {
            id: actionsFor || '',
            text: lyricLines.find((l) => l.id === actionsFor)?.original || '',
            translation: lyricLines.find((l) => l.id === actionsFor)?.translation,
            script: lyricLines.find((l) => l.id === actionsFor)?.romanization,
            startTime: lyricLines.find((l) => l.id === actionsFor)?.time || 0,
            endTime: 0,
            note: lyricLines.find((l) => l.id === actionsFor)?.note,
          } : null}
          onClose={() => setActionsFor(null)}
          onEdit={() => setEditingOpen(true)}
          onAddNote={(note) => {
            const updated = lyricLines.map((l) =>
              l.id === actionsFor ? { ...l, note } : l
            );
            setLyricLines(updated);
            saveLyrics(userId, track!.id, buildPersistedLyrics(updated)).catch(console.error);
          }}
          onDelete={() => {
            const updated = lyricLines.filter((l) => l.id !== actionsFor);
            setLyricLines(updated);
            saveLyrics(userId, track!.id, buildPersistedLyrics(updated)).catch(console.error);
          }}
        />
      </Modal>

      <Animated.View
        pointerEvents={track && !open ? 'auto' : 'none'}
        style={[
          styles.dockWrap,
          {
            bottom: insets.bottom + 74,
            opacity: dockAnim,
            transform: [{ translateY: dockTranslate }],
          },
        ]}
      >
        <View style={[styles.dock, !isDark && styles.dockLight]}>
          <TouchableOpacity
            onPress={onOpen}
            activeOpacity={0.85}
            style={styles.dockMain}
            accessibilityLabel={`${activeTrack?.title ?? SAMPLE_TRACK.title} by ${activeTrack?.artist ?? SAMPLE_TRACK.artist}`}
            accessibilityHint="Open player"
            accessibilityRole="button"
          >
            <View style={styles.dockArt}>
              {(activeTrack ?? SAMPLE_TRACK).coverArtUri ? (
                <Image
                  source={{ uri: (activeTrack ?? SAMPLE_TRACK).coverArtUri }}
                  style={styles.dockCoverArt}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <LinearGradient colors={(activeTrack ?? SAMPLE_TRACK).palette} style={StyleSheet.absoluteFillObject} />
                  <Disc3 size={22} color="rgba(255,255,255,0.96)" strokeWidth={1.8} />
                </>
              )}
            </View>

            <View style={styles.dockCopy}>
              <Text style={styles.dockTitle} numberOfLines={1}>
                {activeTrack?.title ?? SAMPLE_TRACK.title}
              </Text>
              <Text style={styles.dockArtist} numberOfLines={1}>
                {activeTrack?.artist ?? SAMPLE_TRACK.artist}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlay}
            activeOpacity={0.8}
            style={styles.dockAction}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button"
          >
            {isPlaying ? (
              <Pause size={20} color="#f8fafc" strokeWidth={2.2} />
            ) : (
              <Play size={20} color="#f8fafc" fill="#f8fafc" strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={dismissTrack}
            activeOpacity={0.8}
            style={styles.dockClose}
            accessibilityLabel="Dismiss player"
            accessibilityRole="button"
          >
            <X size={16} color="rgba(255,255,255,0.85)" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#05070b',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  handle: {
    marginTop: 8,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headerMeta: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pickButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  content: {
    flex: 1,
    paddingTop: 12,
  },
  backdropImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backdropNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  artShell: {
    width: 246,
    height: 246,
    borderRadius: 34,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  artGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  artInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(3,6,12,0.18)',
  },
  artLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  trackCopy: {
    alignSelf: 'stretch',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  trackTitle: {
    color: '#ffffff',
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  trackArtist: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  lyricsPanel: {
    alignSelf: 'stretch',
    marginTop: 18,
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyLyricsFullscreen: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  emptyLyricsState: {
    gap: 14,
  },
  emptyArtworkShell: {
    minHeight: 260,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyArtworkImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  emptyArtworkGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    top: -30,
    right: -20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    opacity: 0.35,
  },
  emptyLyricsCopy: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 8,
  },
  emptyLyricsTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptyLyricsBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    maxWidth: '88%',
  },
  emptyLyricsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  emptyPrimaryButtonText: {
    color: '#0d121b',
    fontSize: 14,
    fontWeight: '800',
  },
  emptySecondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  emptySecondaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  lyricsViewport: {
    flex: 1,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsFullscreenContent: {
    paddingHorizontal: 14,
  },
  fullscreenLyricPressable: {
    marginBottom: 10,
  },
  lyricsTopScrim: {
    position: 'absolute',
    top: 0,
    left: -16,
    right: -16,
    height: 120,
    zIndex: 2,
  },
  lyricsFocusGlow: {
    position: 'absolute',
    left: -16,
    right: -16,
    height: 190,
    zIndex: 1,
  },
  lyricsBottomScrim: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: 0,
    height: 220,
    zIndex: 2,
  },
  lyricsBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    zIndex: 3,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lyricsKicker: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  lyricsLead: {
    marginTop: 10,
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  lyricsTranslation: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  lyricsRomanization: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  lyricIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  playbackEditText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  playbackStage: {
    minHeight: 280,
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playbackStageImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playbackHero: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  playbackHeroTime: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  playbackHeroText: {
    marginTop: 10,
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  playbackHeroScript: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  playbackHeroTranslation: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  pasteGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  pasteInput: {
    flex: 1,
    minHeight: 96,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  miniTrackHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  miniArtShell: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniArtImage: {
    width: '100%',
    height: '100%',
  },
  miniTrackCopy: {
    flex: 1,
  },
  miniTrackTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  miniTrackArtist: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  bottomPlayerDock: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  progressGlass: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,11,18,0.66)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  playbackLyricsList: {
    marginTop: 10,
    gap: 2,
  },
  lyricRows: {
    gap: 10,
    marginTop: 14,
  },
  lyricRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lyricRowActive: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  timestampButton: {
    width: 58,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  timestampText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  lyricTextInputs: {
    flex: 1,
    gap: 4,
  },
  lyricLineInput: {
    minHeight: 28,
    padding: 0,
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  translationInput: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  romanizationInput: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  waveformWrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  waveformBar: {
    width: 10,
    height: 118,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  progressBlock: {
    alignSelf: 'stretch',
    marginTop: 22,
  },
  progressTrack: {
    height: 44,
    justifyContent: 'center',
  },
  progressBase: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  progressThumb: {
    position: 'absolute',
    top: 16,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginTop: 12,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  footerPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  footerPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  dock: {
    height: 72,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,20,27,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },
  dockLight: {
    backgroundColor: 'rgba(24,26,32,0.88)',
  },
  dockMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 10,
  },
  dockArt: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dockCoverArt: {
    width: '100%',
    height: '100%',
  },
  dockCopy: {
    flex: 1,
  },
  dockTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dockArtist: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dockAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  dockClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
