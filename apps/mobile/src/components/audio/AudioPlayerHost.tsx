import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  Plus,
  SkipBack,
  SkipForward,
  TimerReset,
  Upload,
  X,
} from '../../icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useThemeContext } from '../../hooks/useThemeContext';
import { DragHandle } from '../ui/DragHandle';

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  subtitle: string;
  source: string;
  coverArtUri?: string;
  palette: [string, string, string];
};

type LyricLine = {
  id: string;
  original: string;
  romanization: string;
  translation: string;
  time: number | null;
};

const SAMPLE_TRACK: AudioTrack = {
  id: 'sample-track',
  title: 'Where Is My Husband!',
  artist: 'Demo track',
  subtitle: 'Synced lyrics will land here later',
  source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  palette: ['#0c1220', '#2a2740', '#a56b57'],
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
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: number;
  backgroundColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
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
  if (track.coverArtUri) {
    return (
      <View style={styles.artShell}>
        <Image source={{ uri: track.coverArtUri }} style={styles.coverArt} resizeMode="cover" />
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
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [originalDraft, setOriginalDraft] = useState('');
  const [translationDraft, setTranslationDraft] = useState('');
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [progressWidth, setProgressWidth] = useState(0);
  const dockAnim = useRef(new Animated.Value(0)).current;

  const activeTrack = track ?? (open ? SAMPLE_TRACK : null);
  const player = useAudioPlayer(activeTrack?.source ?? null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = Boolean(status.playing);
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const sourceLabel = useMemo(() => {
    if (!activeTrack) return '';
    return activeTrack.id === SAMPLE_TRACK.id ? 'Demo sample' : 'Local MP3';
  }, [activeTrack]);

  const activeLyric = useMemo(() => {
    const stamped = lyricLines
      .filter(line => line.time !== null)
      .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

    let current: LyricLine | null = null;
    for (const line of stamped) {
      if ((line.time ?? 0) <= currentTime + 0.15) current = line;
    }
    return current;
  }, [currentTime, lyricLines]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && !track) {
      setTrack(SAMPLE_TRACK);
    }
  }, [open, track]);

  useEffect(() => {
    Animated.timing(dockAnim, {
      toValue: track && !open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [dockAnim, open, track]);

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

    player.pause();
    void player.seekTo(0).catch(() => {});
    setTrack(nextTrack);
    setLyricLines([]);
    setOriginalDraft('');
    setTranslationDraft('');
    onOpen();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const dismissTrack = () => {
    player.pause();
    void player.seekTo(0).catch(() => {});
    setTrack(null);
    setLyricLines([]);
    setOriginalDraft('');
    setTranslationDraft('');
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };


  const buildLyricLines = () => {
    const timedLines = parsePastedTimedLyrics(originalDraft);
    if (timedLines.some(line => line.time !== null || line.romanization || line.translation)) {
      setLyricLines(timedLines);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }

    const originals = splitLyricText(originalDraft);
    const translations = splitLyricText(translationDraft);
    const count = Math.max(originals.length, translations.length);
    if (count === 0) return;

    setLyricLines(Array.from({ length: count }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      original: originals[index] ?? '',
      romanization: '',
      translation: translations[index] ?? '',
      time: null,
    })));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const addLyricLine = () => {
    setLyricLines(lines => [
      ...lines,
      {
        id: `${Date.now()}-${lines.length}`,
        original: '',
        romanization: '',
        translation: '',
        time: null,
      },
    ]);
  };

  const updateLyricLine = (id: string, patch: Partial<LyricLine>) => {
    setLyricLines(lines => lines.map(line => line.id === id ? { ...line, ...patch } : line));
  };

  const stampLyricLine = (id: string) => {
    updateLyricLine(id, { time: currentTime });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
                onPress={loadFromDevice}
                activeOpacity={0.8}
                style={styles.pickButton}
              >
                <Upload size={14} color="#f8fafc" strokeWidth={2} />
                <Text style={styles.pickButtonText}>MP3</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <TrackArt track={activeTrack ?? SAMPLE_TRACK} />

              <View style={styles.trackCopy}>
                <Text style={styles.trackTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {activeTrack?.title ?? SAMPLE_TRACK.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {activeTrack?.artist ?? SAMPLE_TRACK.artist}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {activeTrack?.subtitle ?? SAMPLE_TRACK.subtitle}
                  </Text>
                </View>
              </View>

              <View style={styles.lyricsPanel}>
                <View style={styles.lyricsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lyricsKicker}>Lyrics</Text>
                    <Text style={styles.lyricsLead} numberOfLines={2}>
                      {activeLyric?.original || 'Paste script and translation'}
                    </Text>
                    {activeLyric?.romanization ? (
                      <Text style={styles.lyricsRomanization} numberOfLines={2}>
                        {activeLyric.romanization}
                      </Text>
                    ) : null}
                    {activeLyric?.translation ? (
                      <Text style={styles.lyricsTranslation} numberOfLines={2}>
                        {activeLyric.translation}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={addLyricLine} activeOpacity={0.82} style={styles.lyricIconButton}>
                    <Plus size={18} color="#ffffff" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.pasteGrid}>
                  <TextInput
                    value={originalDraft}
                    onChangeText={setOriginalDraft}
                    placeholder="[00:15.00] ਪੰਜਾਬੀ | Romanization | Translation"
                    placeholderTextColor="rgba(255,255,255,0.36)"
                    multiline
                    textAlignVertical="top"
                    style={styles.pasteInput}
                  />
                  <TextInput
                    value={translationDraft}
                    onChangeText={setTranslationDraft}
                    placeholder="Translation"
                    placeholderTextColor="rgba(255,255,255,0.36)"
                    multiline
                    textAlignVertical="top"
                    style={styles.pasteInput}
                  />
                </View>

                <View style={styles.lyricToolbar}>
                  <TouchableOpacity onPress={buildLyricLines} activeOpacity={0.82} style={styles.lyricToolbarButton}>
                    <Text style={styles.lyricToolbarText}>Build lines</Text>
                  </TouchableOpacity>
                  <Text style={styles.lyricCountText}>
                    {lyricLines.length} line{lyricLines.length === 1 ? '' : 's'}
                  </Text>
                </View>

                <View style={styles.lyricRows}>
                  {lyricLines.map((line, index) => {
                    const isActive = activeLyric?.id === line.id;
                    return (
                      <View key={line.id} style={[styles.lyricRow, isActive && styles.lyricRowActive]}>
                        <TouchableOpacity
                          activeOpacity={0.82}
                          style={styles.timestampButton}
                          onPress={() => stampLyricLine(line.id)}
                          onLongPress={() => {
                            if (line.time !== null) void player.seekTo(line.time).catch(() => {});
                          }}
                        >
                          <TimerReset size={13} color="#ffffff" strokeWidth={2.2} />
                          <Text style={styles.timestampText}>
                            {line.time === null ? `L${index + 1}` : formatTime(line.time)}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.lyricTextInputs}>
                          <TextInput
                            value={line.original}
                            onChangeText={(value) => updateLyricLine(line.id, { original: value })}
                            placeholder="Original"
                            placeholderTextColor="rgba(255,255,255,0.32)"
                            multiline
                            style={styles.lyricLineInput}
                          />
                          <TextInput
                            value={line.romanization}
                            onChangeText={(value) => updateLyricLine(line.id, { romanization: value })}
                            placeholder="Romanization"
                            placeholderTextColor="rgba(255,255,255,0.32)"
                            multiline
                            style={[styles.lyricLineInput, styles.romanizationInput]}
                          />
                          <TextInput
                            value={line.translation}
                            onChangeText={(value) => updateLyricLine(line.id, { translation: value })}
                            placeholder="Translation"
                            placeholderTextColor="rgba(255,255,255,0.32)"
                            multiline
                            style={[styles.lyricLineInput, styles.translationInput]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.progressBlock}>
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
                <ControlButton onPress={() => seekBy(-15)} size={48} backgroundColor="rgba(255,255,255,0.06)">
                  <SkipBack size={22} color="#f8fafc" strokeWidth={1.9} />
                </ControlButton>

                <ControlButton onPress={togglePlay} size={72} backgroundColor="#f8fafc">
                  {isPlaying ? (
                    <Pause size={32} color="#0c1018" strokeWidth={2.4} />
                  ) : (
                    <Play size={32} color="#0c1018" fill="#0c1018" strokeWidth={2.1} />
                  )}
                </ControlButton>

                <ControlButton onPress={() => seekBy(15)} size={48} backgroundColor="rgba(255,255,255,0.06)">
                  <SkipForward size={22} color="#f8fafc" strokeWidth={1.9} />
                </ControlButton>
              </View>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  activeOpacity={0.8}
                  style={styles.footerPill}
                >
                  <ChevronUp size={14} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
                  <Text style={styles.footerPillText}>Minimize</Text>
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
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
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
          <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={styles.dockMain}>
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

          <TouchableOpacity onPress={togglePlay} activeOpacity={0.8} style={styles.dockAction}>
            {isPlaying ? (
              <Pause size={20} color="#f8fafc" strokeWidth={2.2} />
            ) : (
              <Play size={20} color="#f8fafc" fill="#f8fafc" strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={dismissTrack} activeOpacity={0.8} style={styles.dockClose}>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  pickButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  content: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
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
    marginTop: 22,
  },
  trackTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: 0,
  },
  trackArtist: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  lyricToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  lyricToolbarButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  lyricToolbarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  lyricCountText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '700',
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
  progressBlock: {
    alignSelf: 'stretch',
    marginTop: 22,
  },
  progressTrack: {
    height: 18,
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
    top: 4,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
    gap: 18,
    marginTop: 22,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    alignSelf: 'stretch',
  },
  footerPill: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
