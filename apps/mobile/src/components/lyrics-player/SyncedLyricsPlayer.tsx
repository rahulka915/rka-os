import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';

import { SAMPLE_AUDIO_URL, SAMPLE_LYRICS } from './lyrics.sample';
import { parseLyrics } from './parser';
import { formatMs } from './sync';
import type { DisplayMode, ParsedLyricLine, SyncedLyricsPlayerProps } from './types';
import { useSyncedLyrics } from './useSyncedLyrics';

const DISPLAY_MODES: DisplayMode[] = ['all', 'romanised', 'translation'];
const AUTO_SCROLL_RESUME_MS = 1800;

function displayModeLabel(mode: DisplayMode): string {
  if (mode === 'romanised') return 'Romanised';
  if (mode === 'translation') return 'Translation';
  return 'All';
}

function displayModeContent(line: ParsedLyricLine, mode: DisplayMode) {
  if (mode === 'romanised') {
    return {
      primary: line.romanised || line.original,
      secondary: line.translation,
      tertiary: undefined,
    };
  }

  if (mode === 'translation') {
    return {
      primary: line.translation || line.original,
      secondary: line.romanised,
      tertiary: undefined,
    };
  }

  return {
    primary: line.original,
    secondary: line.romanised,
    tertiary: line.translation,
  };
}

export function SyncedLyricsPlayer({
  rawLyrics = SAMPLE_LYRICS,
  audioSource = SAMPLE_AUDIO_URL,
  title = 'Synced Lyrics',
  artist = 'Prototype Player',
  initialDisplayMode = 'all',
  initialOffsetMs = 0,
  accentColor = '#f59e0b',
}: SyncedLyricsPlayerProps) {
  const lyrics = useMemo(() => parseLyrics(rawLyrics), [rawLyrics]);
  const player = useAudioPlayer(audioSource, { updateInterval: 100 });
  const {
    status,
    currentMs,
    durationMs,
    offsetMs,
    activeIndex,
    activeLyric,
    activeProgress,
    nudgeOffsetBackward,
    nudgeOffsetForward,
    seekToLyric,
  } = useSyncedLyrics(player, lyrics, { initialOffsetMs });

  const scrollRef = useRef<ScrollView | null>(null);
  const rowOffsetsRef = useRef<Record<string, number>>({});
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (autoScrollPaused || activeIndex < 0) return;
    const activeLine = lyrics[activeIndex];
    const y = rowOffsetsRef.current[activeLine.id];
    if (typeof y !== 'number') return;

    scrollRef.current?.scrollTo({
      y: Math.max(0, y - 180),
      animated: true,
    });
  }, [activeIndex, autoScrollPaused, lyrics]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  const pauseAutoScroll = () => {
    setAutoScrollPaused(true);
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = setTimeout(() => {
      setAutoScrollPaused(false);
    }, AUTO_SCROLL_RESUME_MS);
  };

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    player.play();
  };

  const seekBy = async (deltaMs: number) => {
    const nextMs = Math.max(0, Math.min(durationMs || currentMs + deltaMs, currentMs + deltaMs));
    await player.seekTo(nextMs / 1000);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.shell}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Lyrics Player</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.artist}>{artist}</Text>
          <Text style={styles.activeStamp}>
            {activeLyric ? formatMs(activeLyric.startMs) : formatMs(currentMs)}
          </Text>
          <Text style={styles.activeLine}>
            {displayModeContent(activeLyric ?? lyrics[0], displayMode).primary}
          </Text>
          {!!activeLyric && displayModeContent(activeLyric, displayMode).secondary ? (
            <Text style={styles.activeSecondary}>
              {displayModeContent(activeLyric, displayMode).secondary}
            </Text>
          ) : null}
          {!!activeLyric && displayModeContent(activeLyric, displayMode).tertiary ? (
            <Text style={styles.activeTertiary}>
              {displayModeContent(activeLyric, displayMode).tertiary}
            </Text>
          ) : null}

          <View style={styles.waveformRow}>
            {Array.from({ length: 18 }).map((_, index) => {
              const scale = activeIndex >= 0 && index / 18 <= activeProgress ? 1 : 0.38 + (index % 4) * 0.12;
              return (
                <View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      backgroundColor: accentColor,
                      transform: [{ scaleY: scale }],
                      opacity: activeIndex >= 0 && index / 18 <= activeProgress ? 0.95 : 0.28,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={() => seekBy(-5_000)} style={styles.smallControl} activeOpacity={0.82}>
              <SkipBack size={18} color="#f8fafc" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlayback} style={styles.playControl} activeOpacity={0.82}>
              {status.playing ? (
                <Pause size={24} color="#05070b" />
              ) : (
                <Play size={24} color="#05070b" fill="#05070b" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekBy(5_000)} style={styles.smallControl} activeOpacity={0.82}>
              <SkipForward size={18} color="#f8fafc" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${durationMs > 0 ? (currentMs / durationMs) * 100 : 0}%`, backgroundColor: accentColor }]} />
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatMs(currentMs)}</Text>
            <Text style={styles.timeText}>{formatMs(Math.max(0, durationMs - currentMs))}</Text>
          </View>

          <View style={styles.offsetRow}>
            <Text style={styles.offsetLabel}>Offset {offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms</Text>
            <View style={styles.offsetButtons}>
              <TouchableOpacity onPress={nudgeOffsetBackward} style={styles.offsetButton} activeOpacity={0.82}>
                <Text style={styles.offsetButtonText}>-250ms</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={nudgeOffsetForward} style={styles.offsetButton} activeOpacity={0.82}>
                <Text style={styles.offsetButtonText}>+250ms</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modeRow}>
            {DISPLAY_MODES.map((mode) => {
              const active = mode === displayMode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setDisplayMode(mode)}
                  style={[
                    styles.modeChip,
                    active && { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderColor: accentColor },
                  ]}
                >
                  <Text style={[styles.modeChipText, active && { color: '#fff4da' }]}>
                    {displayModeLabel(mode)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
          onScrollBeginDrag={pauseAutoScroll}
          onMomentumScrollBegin={pauseAutoScroll}
          onScrollEndDrag={pauseAutoScroll}
          onMomentumScrollEnd={pauseAutoScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.map((line, index) => {
            const active = index === activeIndex;
            const content = displayModeContent(line, displayMode);

            return (
              <Pressable
                key={line.id}
                onPress={() => {
                  void seekToLyric(line);
                }}
                onLayout={(event) => {
                  rowOffsetsRef.current[line.id] = event.nativeEvent.layout.y;
                }}
                style={[
                  styles.lyricCard,
                  active && { borderColor: `${accentColor}88`, backgroundColor: 'rgba(255,255,255,0.09)' },
                ]}
              >
                {active ? (
                  <View
                    style={[
                      styles.activeFill,
                      {
                        width: `${activeProgress * 100}%`,
                        backgroundColor: accentColor,
                      },
                    ]}
                  />
                ) : null}

                <View style={styles.lineMeta}>
                  <Text style={styles.lineTime}>{formatMs(line.startMs)}</Text>
                </View>

                <View style={styles.lineCopy}>
                  <Text style={[styles.linePrimary, active && styles.linePrimaryActive]}>
                    {content.primary}
                  </Text>
                  {content.secondary ? (
                    <Text style={[styles.lineSecondary, active && styles.lineSecondaryActive]}>
                      {content.secondary}
                    </Text>
                  ) : null}
                  {content.tertiary ? (
                    <Text style={[styles.lineTertiary, active && styles.lineTertiaryActive]}>
                      {content.tertiary}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05070b',
  },
  shell: {
    flex: 1,
    backgroundColor: '#05070b',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  hero: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: '#0d1118',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  kicker: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  artist: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.64)',
    fontSize: 15,
    fontWeight: '600',
  },
  activeStamp: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  activeLine: {
    marginTop: 8,
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  activeSecondary: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  activeTertiary: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  waveformRow: {
    height: 52,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  waveformBar: {
    flex: 1,
    height: 32,
    borderRadius: 999,
  },
  controlsCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  smallControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playControl: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
    fontWeight: '700',
  },
  offsetRow: {
    marginTop: 16,
    gap: 10,
  },
  offsetLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  offsetButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  offsetButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  offsetButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modeChipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  lyricsScroll: {
    flex: 1,
    marginTop: 14,
  },
  lyricsContent: {
    paddingBottom: 24,
    gap: 10,
  },
  lyricCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  activeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.12,
  },
  lineMeta: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    zIndex: 1,
  },
  lineTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '800',
  },
  lineCopy: {
    flex: 1,
    zIndex: 1,
  },
  linePrimary: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  linePrimaryActive: {
    color: '#fff7e8',
  },
  lineSecondary: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  lineSecondaryActive: {
    color: '#ffffff',
  },
  lineTertiary: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  lineTertiaryActive: {
    color: 'rgba(255,255,255,0.82)',
  },
});
