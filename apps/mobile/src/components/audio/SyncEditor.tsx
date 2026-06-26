import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Play, Pause, Trash2 } from '../../icons';
import { useThemeContext } from '../../hooks/useThemeContext';
import { LyricLine, DraftLine } from '../../lib/lyricTypes';
import { parseRawLyrics, round, formatTime } from '../../lib/lyricsUtils';
import { getLyricScrollTarget, useLyricSync } from '../../hooks/useLyricSync';
import { InstrumentalCard } from './InstrumentalCard';

type Step = 'paste' | 'sync' | 'preview';

interface SyncEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (lyrics: LyricLine[]) => Promise<void>;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onSetSpeed?: (rate: number) => void;
  initialLyrics?: LyricLine[];
}

export const SyncEditor = ({
  open,
  onClose,
  onSave,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onPlayPause,
  onSeek,
  onSetSpeed,
  initialLyrics = [],
}: SyncEditorProps) => {
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('paste');
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [seekBarWidth, setSeekBarWidth] = useState(0);
  const openedWithExistingRef = useRef(false);

  // Task 1: cursor
  const [cursor, setCursor] = useState(0);

  // Task 2: count-in
  const [countIn, setCountIn] = useState<number | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Task 4: per-row overflow
  const [overflowFor, setOverflowFor] = useState<string | null>(null);

  // Task 8: copy JSON
  const [copied, setCopied] = useState(false);

  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewFooterHeight, setPreviewFooterHeight] = useState(0);
  const [previewAutoScrollPaused, setPreviewAutoScrollPaused] = useState(false);
  const previewListRef = useRef<FlatList<LyricLine> | null>(null);
  const previewRowOffsetsRef = useRef<Record<string, number>>({});
  const previewScrollYRef = useRef(0);
  const lastSettledPreviewTargetRef = useRef<number | null>(null);
  const previewAutoScrollResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      if (countTimerRef.current) clearInterval(countTimerRef.current);
      setCountIn(null);
      return;
    }

    if (initialLyrics.length > 0) {
      openedWithExistingRef.current = true;
      const nextDraft = [...initialLyrics]
        .sort((a, b) => a.startTime - b.startTime)
        .map((line, index) => ({
          id: line.id || `draft-existing-${index}`,
          script: line.script || '',
          text: line.text || '',
          translation: line.translation || '',
          startTime: line.startTime,
          kind: line.kind,
          label: line.label,
        }));

      setDraft(nextDraft);
      setPasted('');
      setErrors([]);
      setCursor(0);
      setStep('preview');
      return;
    }

    openedWithExistingRef.current = false;
    setDraft([]);
    setPasted('');
    setErrors([]);
    setCursor(0);
    setStep('paste');
  }, [open, initialLyrics]);

  const builtLines = useMemo(() => buildLines(draft), [draft]);
  const { activeIndex, progress } = useLyricSync(currentTime, builtLines);
  const previewAnchorY = Math.round((previewViewportHeight || 420) * 0.44);
  const previewTopPadding = Math.max(124, previewAnchorY - 68);
  const previewBottomPadding = Math.max(
    previewFooterHeight + insets.bottom + 112,
    Math.round((previewViewportHeight || 420) * 0.5)
  );

  // Task 3: derived out-of-order / progress stats
  const stampedCount = draft.filter((l) => l.startTime != null).length;
  const unstampedCount = draft.length - stampedCount;
  const outOfOrder = draft.some((l, i) => {
    if (l.startTime == null || i === 0) return false;
    const prev = draft[i - 1];
    return prev.startTime != null && l.startTime < prev.startTime;
  });

  // Task 7: live parse stats for paste step
  const { lines: parsedPreview, errors: liveErrors } = useMemo(() => parseRawLyrics(pasted), [pasted]);
  const withTranslation = parsedPreview.filter((l) => l.translation).length;
  const withScript = parsedPreview.filter((l) => l.script).length;
  const allTimestamped = parsedPreview.length > 0 && parsedPreview.every((l) => l.startTime !== null);

  useEffect(() => {
    return () => {
      if (previewAutoScrollResumeRef.current) {
        clearTimeout(previewAutoScrollResumeRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 'preview' || previewAutoScrollPaused || builtLines.length === 0) {
      return;
    }

    const targetY = getLyricScrollTarget({
      lyrics: builtLines,
      activeIndex,
      progress,
      currentTime,
      rowOffsets: previewRowOffsetsRef.current,
      anchorY: previewAnchorY,
      preRollSeconds: 6.5,
      preRollTravel: 56,
    });
    if (targetY === null) {
      return;
    }

    const currentScrollY = previewScrollYRef.current;
    if (!isPlaying) {
      if (lastSettledPreviewTargetRef.current !== null && Math.abs(lastSettledPreviewTargetRef.current - targetY) < 0.5) {
        return;
      }
      lastSettledPreviewTargetRef.current = targetY;
      previewScrollYRef.current = targetY;
      previewListRef.current?.scrollToOffset({
        offset: targetY,
        animated: false,
      });
      return;
    }

    const smoothing = activeIndex < 0 ? 0.16 : 0.2;
    const nextScrollY = currentScrollY + (targetY - currentScrollY) * smoothing;
    if (Math.abs(nextScrollY - currentScrollY) < 0.5) {
      return;
    }

    lastSettledPreviewTargetRef.current = null;
    previewScrollYRef.current = nextScrollY;
    previewListRef.current?.scrollToOffset({
      offset: nextScrollY,
      animated: false,
    });
  }, [activeIndex, builtLines, currentTime, isPlaying, previewAnchorY, previewAutoScrollPaused, progress, step]);

  const pausePreviewAutoScrollTemporarily = () => {
    setPreviewAutoScrollPaused(true);
    if (previewAutoScrollResumeRef.current) {
      clearTimeout(previewAutoScrollResumeRef.current);
    }
    previewAutoScrollResumeRef.current = setTimeout(() => {
      setPreviewAutoScrollPaused(false);
    }, 1400);
  };

  // ============ STEP 1: PASTE ============
  const handlePaste = () => {
    const { lines, errors: parseErrors } = parseRawLyrics(pasted);
    setErrors(parseErrors);

    if (parseErrors.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    if (lines.length === 0) {
      setErrors(['No valid lines found']);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setDraft(lines);
    setCursor(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep('sync');
  };

  // ============ STEP 2: SYNC HELPERS ============

  // Task 1: stamp()
  const stamp = () => {
    if (!isPlaying || cursor >= draft.length) return;
    const target = draft[cursor];
    updateLine(target.id, { startTime: currentTime });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCursor((c) => Math.min(c + 1, draft.length));
  };

  // Task 2: playWithCountIn()
  const playWithCountIn = () => {
    if (countTimerRef.current) clearInterval(countTimerRef.current);
    let n = 3;
    setCountIn(n);
    countTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(countTimerRef.current!);
        countTimerRef.current = null;
        setCountIn(null);
        onPlayPause?.();
      } else {
        setCountIn(n);
      }
    }, 700);
  };

  // Task 3: sortDraftByTime()
  const sortDraftByTime = () => {
    setDraft((d) => {
      const sorted = [...d].sort((a, b) => (a.startTime ?? Infinity) - (b.startTime ?? Infinity));
      const firstUnstamped = sorted.findIndex((l) => l.startTime == null);
      setCursor(firstUnstamped >= 0 ? firstUnstamped : sorted.length);
      return sorted;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const stampLyricLine = (id: string) => {
    updateLine(id, { startTime: currentTime });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setDraft((currentDraft) => currentDraft.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const deleteLine = (id: string) => {
    setDraft((currentDraft) => currentDraft.filter((l) => l.id !== id));
  };

  const adjustLineTime = (id: string, delta: number) => {
    setDraft((currentDraft) =>
      currentDraft.map((line) => {
        if (line.id !== id) return line;
        const baseTime = line.startTime ?? currentTime;
        return {
          ...line,
          startTime: round(Math.max(0, baseTime + delta)),
        };
      })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // Task 4: per-row helpers
  const moveLine = (id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const i = d.findIndex((l) => l.id === id);
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const insertLineAfter = (id: string, text: string, extra?: Partial<DraftLine>) => {
    setDraft((d) => {
      const i = d.findIndex((l) => l.id === id);
      const prev = d[i]?.startTime;
      const nextT = d[i + 1]?.startTime;
      const startTime =
        prev != null && nextT != null
          ? round((prev + nextT) / 2)
          : prev != null
          ? round(prev + 1)
          : null;
      const newLine: DraftLine = {
        id: `draft-new-${Date.now()}`,
        text,
        script: '',
        translation: '',
        startTime,
        ...extra,
      };
      return [...d.slice(0, i + 1), newLine, ...d.slice(i + 1)];
    });
  };

  const clearLineTiming = (id: string) => {
    updateLine(id, { startTime: null });
    const index = draft.findIndex((l) => l.id === id);
    if (index >= 0) setCursor(index);
  };

  // Task 8: copyJson()
  const copyJson = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(JSON.stringify(builtLines, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // expo-clipboard not available
    }
  };

  // ============ STEP 3: BUILD LINES ============
  function buildLines(lines: DraftLine[]): LyricLine[] {
    const stamped = lines.filter((l) => l.startTime !== null);

    if (stamped.length === 0) {
      return [];
    }

    const sorted = [...stamped].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

    return sorted.map((line, i, arr) => ({
      id: line.id,
      text: line.text,
      translation: line.translation,
      script: line.script,
      kind: line.kind,
      label: line.label,
      startTime: round(line.startTime ?? 0),
      endTime: arr[i + 1]?.startTime ?? (line.startTime ?? 0) + 4,
    }));
  }

  // ============ RENDER STEP 1: PASTE ============
  if (step === 'paste') {
    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            {
              backgroundColor: isDark ? '#0c0c0c' : '#f2f2f7',
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View
              style={[
                styles.header,
                {
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
            >
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
              keyboardShouldPersistTaps="handled"
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

              {/* Task 7: parse stats */}
              {parsedPreview.length > 0 && (
                <Text style={[styles.parseStats, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
                  {parsedPreview.length} line{parsedPreview.length === 1 ? '' : 's'}
                  {withScript > 0 ? ` · ${withScript} with script` : ''}
                  {withTranslation > 0 ? ` · ${withTranslation} with translation` : ''}
                  {allTimestamped ? ' · all timestamps present ✓' : ''}
                </Text>
              )}

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
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.footer,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
              ]}
            >
              {/* Task 7: two-button footer when all timestamps present */}
              {allTimestamped && liveErrors.length === 0 ? (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      const { lines } = parseRawLyrics(pasted);
                      setDraft(lines);
                      setCursor(0);
                      setStep('preview');
                    }}
                    style={[styles.nextButton, { backgroundColor: '#34a853' }]}
                  >
                    <Text style={styles.nextButtonText}>Skip to preview</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePaste}
                    style={[styles.nextButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
                  >
                    <Text style={[styles.nextButtonText, { color: isDark ? '#f2f2f2' : '#333' }]}>
                      Fine-tune timings
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePaste}
                  style={[
                    styles.nextButton,
                    { backgroundColor: '#007aff' },
                    pasted.trim().length === 0 && { opacity: 0.5 },
                  ]}
                  disabled={pasted.trim().length === 0}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }

  // ============ RENDER STEP 2: SYNC ============
  if (step === 'sync') {
    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            { backgroundColor: isDark ? '#0c0c0c' : '#f2f2f7' },
          ]}
        >
          <View
            style={[
              styles.header,
              {
                borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
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

          {/* Player transport */}
          <View
            style={[
              styles.playerControls,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
            {/* Time row */}
            <View style={styles.syncTimeRow}>
              <Text style={[styles.syncTimeText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
                {formatTime(currentTime)}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const next = playbackSpeed === 1 ? 0.75 : 1;
                  setPlaybackSpeed(next);
                  onSetSpeed?.(next);
                }}
                style={[styles.syncSpeedBtn, { backgroundColor: isDark ? 'rgba(124,92,255,0.18)' : 'rgba(0,122,255,0.1)' }]}
              >
                <Text style={{ color: isDark ? '#7c5cff' : '#007aff', fontWeight: '700', fontSize: 12 }}>
                  {playbackSpeed === 1 ? '1×' : '¾×'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.syncTimeText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
                {duration > 0 ? formatTime(duration) : '--:--'}
              </Text>
            </View>

            {/* Seek bar */}
            <Pressable
              onLayout={(e) => setSeekBarWidth(e.nativeEvent.layout.width)}
              onPress={(e) => {
                if (!duration || seekBarWidth <= 0) return;
                onSeek?.(Math.max(0, Math.min(duration, (e.nativeEvent.locationX / seekBarWidth) * duration)));
              }}
              style={styles.syncSeekBar}
            >
              <View style={[styles.syncSeekTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
              <View
                style={[
                  styles.syncSeekFill,
                  {
                    width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%',
                    backgroundColor: isDark ? '#7c5cff' : '#007aff',
                  },
                ]}
              />
            </Pressable>

            {/* Controls row */}
            <View style={styles.syncControlsRow}>
              <TouchableOpacity
                onPress={() => onSeek?.(Math.max(0, currentTime - 5))}
                style={styles.syncSkipBtn}
                accessibilityLabel="Back 5 seconds"
              >
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700' }}>−5s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onPlayPause}
                style={[styles.playButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                accessibilityRole="button"
              >
                {isPlaying
                  ? <Pause size={22} color={isDark ? '#f8fafc' : '#1c1c1e'} strokeWidth={2.2} />
                  : <Play size={22} color={isDark ? '#f8fafc' : '#1c1c1e'} fill={isDark ? '#f8fafc' : '#1c1c1e'} strokeWidth={2} />
                }
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSeek?.(Math.min(duration || 9999, currentTime + 5))}
                style={styles.syncSkipBtn}
                accessibilityLabel="Forward 5 seconds"
              >
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700' }}>+5s</Text>
              </TouchableOpacity>
            </View>

            {/* Task 2: Play with 3-2-1 */}
            {!isPlaying && (
              <TouchableOpacity onPress={playWithCountIn} style={styles.countInBtn}>
                <Text style={[styles.countInBtnText, { color: isDark ? '#7c5cff' : '#007aff' }]}>
                  Play with 3-2-1
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Task 3: Out-of-order warning */}
          {outOfOrder && (
            <View style={[styles.warnBanner, { backgroundColor: isDark ? 'rgba(255,180,0,0.15)' : 'rgba(255,180,0,0.12)' }]}>
              <Text style={[styles.warnText, { color: isDark ? '#ffd060' : '#a06000' }]}>
                Lines are out of time order.
              </Text>
              <TouchableOpacity onPress={sortDraftByTime}>
                <Text style={{ color: isDark ? '#ffd060' : '#a06000', fontWeight: '700', fontSize: 12 }}>
                  Sort by time
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {unstampedCount > 0 && stampedCount > 0 && (
            <Text style={[styles.stampProgress, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' }]}>
              {stampedCount}/{draft.length} stamped · {unstampedCount} will be dropped
            </Text>
          )}

          {/* Task 5: Edit toolbar */}
          <View style={styles.editToolbar}>
            {(['♪ Add instrumental', '+ Add line'] as const).map((label, i) => (
              <TouchableOpacity
                key={label}
                onPress={() => {
                  const lastId = draft[draft.length - 1]?.id ?? '';
                  if (i === 0) {
                    insertLineAfter(lastId, '♪ Instrumental', { kind: 'instrumental', label: 'Instrumental' });
                  } else {
                    insertLineAfter(lastId, '');
                  }
                }}
                style={[styles.toolbarBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Text style={[styles.toolbarBtnText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lyrics list */}
          <FlatList
            data={draft}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => setCursor(index)}
                style={[
                  styles.lyricRow,
                  index === cursor && {
                    backgroundColor: isDark ? 'rgba(124,92,255,0.18)' : 'rgba(0,122,255,0.12)',
                    borderColor: isDark ? 'rgba(124,92,255,0.35)' : 'rgba(0,122,255,0.25)',
                  },
                ]}
              >
                <View style={styles.lyricRowTop}>
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
                    <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>Script</Text>
                    <TextInput
                      value={item.script}
                      onChangeText={(value) => updateLine(item.id, { script: value })}
                      placeholder="Script"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[
                        styles.lineInput,
                        {
                          color: isDark ? '#f2f2f2' : '#000',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                    />
                    <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>Lyrics</Text>
                    <TextInput
                      value={item.text}
                      onChangeText={(value) => updateLine(item.id, { text: value })}
                      placeholder="Text"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[
                        styles.lineInput,
                        {
                          color: isDark ? '#f2f2f2' : '#000',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                    />
                    <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>Translation</Text>
                    <TextInput
                      value={item.translation}
                      onChangeText={(value) => updateLine(item.id, { translation: value })}
                      placeholder="Translation"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[
                        styles.lineInput,
                        {
                          color: isDark ? '#f2f2f2' : '#000',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        },
                      ]}
                    />
                  </View>

                  {/* Task 4: ⋮ overflow button */}
                  <TouchableOpacity
                    onPress={() => setOverflowFor(item.id)}
                    style={styles.overflowBtn}
                    hitSlop={10}
                  >
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)', fontSize: 20, lineHeight: 24 }}>
                      ⋮
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.adjustRow}>
                  {[-1, -0.5, -0.1, 0.1, 0.5, 1].map((delta) => (
                    <TouchableOpacity
                      key={`${item.id}-${delta}`}
                      onPress={() => adjustLineTime(item.id, delta)}
                      style={styles.adjustChip}
                    >
                      <Text style={[styles.adjustChipText, { color: isDark ? '#f8fafc' : '#111827' }]}>
                        {delta > 0 ? `+${delta.toFixed(1)}s` : `${delta.toFixed(1)}s`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.lyricsList}
            scrollEnabled
          />

          {/* Task 1: Big STAMP button */}
          <TouchableOpacity
            onPress={stamp}
            disabled={!isPlaying || cursor >= draft.length}
            activeOpacity={0.82}
            style={[
              styles.stampBigButton,
              (!isPlaying || cursor >= draft.length) && { opacity: 0.42 },
            ]}
          >
            <Text style={styles.stampBigButtonText}>
              {cursor >= draft.length
                ? 'All lines stamped ✓'
                : !isPlaying
                ? 'Press play, then tap'
                : 'Tap on the beat'}
            </Text>
          </TouchableOpacity>

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
                { backgroundColor: '#007aff' },
              ]}
            >
              <Text style={styles.nextButtonText}>Preview</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Task 2: Count-in overlay */}
          {countIn !== null && (
            <View style={styles.countInOverlay} pointerEvents="none">
              <Text style={styles.countInNumber}>{countIn}</Text>
            </View>
          )}

          {/* Task 4: Overflow modal */}
          <Modal
            visible={overflowFor !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setOverflowFor(null)}
          >
            <TouchableOpacity
              style={styles.overflowBackdrop}
              activeOpacity={1}
              onPress={() => setOverflowFor(null)}
            />
            <View style={[styles.overflowSheet, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
              {overflowFor !== null && (() => {
                const idx = draft.findIndex((l) => l.id === overflowFor);
                const line = draft[idx];
                const actions: Array<{
                  label: string;
                  disabled?: boolean;
                  destructive?: boolean;
                  onPress: () => void;
                }> = [
                  {
                    label: 'Move up',
                    disabled: idx === 0,
                    onPress: () => { moveLine(overflowFor, -1); setOverflowFor(null); },
                  },
                  {
                    label: 'Move down',
                    disabled: idx === draft.length - 1,
                    onPress: () => { moveLine(overflowFor, 1); setOverflowFor(null); },
                  },
                  {
                    label: 'Insert line below',
                    onPress: () => { insertLineAfter(overflowFor, ''); setOverflowFor(null); },
                  },
                  {
                    label: '♪ Insert instrumental below',
                    onPress: () => {
                      insertLineAfter(overflowFor, '♪ Instrumental', { kind: 'instrumental', label: 'Instrumental' });
                      setOverflowFor(null);
                    },
                  },
                  ...(line?.startTime != null
                    ? [{ label: 'Clear timing', onPress: () => { clearLineTiming(overflowFor); setOverflowFor(null); } }]
                    : []),
                  {
                    label: 'Delete line',
                    destructive: true,
                    onPress: () => { deleteLine(overflowFor); setOverflowFor(null); },
                  },
                ];
                return actions.map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    onPress={a.disabled ? undefined : a.onPress}
                    style={[styles.overflowAction, a.disabled && { opacity: 0.35 }]}
                  >
                    <Text
                      style={[
                        styles.overflowActionText,
                        { color: a.destructive ? '#ff3b30' : isDark ? '#f2f2f2' : '#000' },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
    );
  }

  // ============ RENDER STEP 3: PREVIEW ============
  if (step === 'preview') {
    return (
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <SafeAreaView
          style={[
            styles.safeArea,
            { backgroundColor: '#05070b' },
          ]}
        >
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['#05070b', '#0f1824', '#16141f']}
              locations={[0, 0.48, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => { openedWithExistingRef.current ? onClose() : setStep('sync'); }}
              hitSlop={10}
            >
              <ChevronLeft size={24} color="#f8fafc" />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Preview</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.previewTrackMeta}>
            <Text style={styles.previewEyebrow}>Preview Mode</Text>
            <Text style={styles.previewMetaText}>Check timing and readability before saving</Text>
          </View>

          <View
            onLayout={(event) => setPreviewViewportHeight(event.nativeEvent.layout.height)}
            style={[
              styles.previewViewport,
              { marginBottom: previewFooterHeight > 0 ? previewFooterHeight + 12 : 124 },
            ]}
          >
            <LinearGradient
              colors={['rgba(5,7,11,0.78)', 'rgba(5,7,11,0)', 'rgba(5,7,11,0.82)']}
              locations={[0, 0.22, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(5,7,11,0)', 'rgba(5,7,11,0.12)', 'rgba(5,7,11,0.92)']}
              locations={[0, 0.68, 1]}
              pointerEvents="none"
              style={styles.previewBottomFade}
            />
            <FlatList
              ref={previewListRef}
              data={builtLines}
              keyExtractor={(item) => item.id || ''}
              renderItem={({ item, index }) => {
                const isActive = index === activeIndex;
                const fill =
                  isActive && item.endTime > item.startTime
                    ? Math.min(1, Math.max(0, (currentTime - item.startTime) / (item.endTime - item.startTime)))
                    : 0;

                if (item.kind === 'instrumental') {
                  return (
                    <View
                      onLayout={(e) => {
                        const key = item.id ?? `${index}`;
                        previewRowOffsetsRef.current[key] = e.nativeEvent.layout.y;
                      }}
                    >
                      <InstrumentalCard
                        label={item.label || 'Instrumental'}
                        style={item.style}
                        progress={isActive ? progress : 0}
                      />
                    </View>
                  );
                }

                return (
                  <View
                    onLayout={(e) => {
                      const key = item.id ?? `${index}:${item.startTime}:${item.text}`;
                      previewRowOffsetsRef.current[key] = e.nativeEvent.layout.y;
                    }}
                    style={[styles.previewRow, { opacity: isActive ? 1 : 0.38 }]}
                  >
                    {/* Task 6: karaoke fill row */}
                    <View style={styles.previewTextTrack}>
                      <Text
                        style={[styles.previewText, { color: 'rgba(255,255,255,0.32)' }]}
                        numberOfLines={2}
                      >
                        {item.text}
                      </Text>
                      {isActive && (
                        <View style={[styles.previewFillClip, { width: `${fill * 100}%` as any }]}>
                          <Text
                            style={[
                              styles.previewText,
                              {
                                color: '#fff',
                                textShadowColor: 'rgba(255,255,255,0.3)',
                                textShadowRadius: 12,
                                textShadowOffset: { width: 0, height: 0 },
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {item.text}
                          </Text>
                        </View>
                      )}
                    </View>
                    {item.translation ? (
                      <Text
                        style={[
                          styles.previewTranslation,
                          { color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.translation}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
              onScrollBeginDrag={pausePreviewAutoScrollTemporarily}
              onMomentumScrollBegin={pausePreviewAutoScrollTemporarily}
              onScrollEndDrag={pausePreviewAutoScrollTemporarily}
              onMomentumScrollEnd={pausePreviewAutoScrollTemporarily}
              onScroll={(event) => {
                previewScrollYRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.previewList,
                {
                  paddingTop: previewTopPadding,
                  paddingBottom: previewBottomPadding,
                },
              ]}
              showsVerticalScrollIndicator={false}
            />
          </View>

          <View
            onLayout={(event) => setPreviewFooterHeight(event.nativeEvent.layout.height)}
            style={[styles.previewFooter, { paddingBottom: Math.max(12, insets.bottom) }]}
          >
            {/* Task 8: Copy JSON button */}
            <TouchableOpacity
              onPress={copyJson}
              style={[
                styles.nextButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  marginBottom: 8,
                },
              ]}
            >
              <Text style={[styles.nextButtonText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>
                {copied ? '✓ Copied' : 'Copy JSON'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(builtLines);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  onClose();
                } catch (error) {
                  console.error('Failed to save:', error);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={[
                styles.saveButton,
                { backgroundColor: '#34a853', opacity: saving ? 0.6 : 1 },
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
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
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
    marginBottom: 8,
  },
  parseStats: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
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
  playerControls: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  syncTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncTimeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  syncSpeedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 44,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncSeekBar: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  syncSeekTrack: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  syncSeekFill: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  syncControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  syncSkipBtn: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Task 2
  countInBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  countInBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countInOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  countInNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
  },
  // Task 3
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  warnText: {
    fontSize: 12,
    flex: 1,
  },
  stampProgress: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  // Task 4
  overflowBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overflowSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  overflowAction: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  overflowActionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Task 5
  editToolbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toolbarBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
  },
  lyricsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
  },
  lyricRow: {
    marginVertical: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lyricRowTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stampButton: {
    width: 62,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputGroup: {
    flex: 1,
    gap: 4,
  },
  lineInput: {
    minHeight: 32,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  adjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginLeft: 74,
  },
  adjustChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  adjustChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Task 1
  stampBigButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#7c5cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBigButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  // Task 6
  previewRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  previewTextTrack: {
    position: 'relative',
  },
  previewText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  previewFillClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  previewTranslation: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  previewList: {
    paddingHorizontal: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  previewTrackMeta: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  previewEyebrow: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  previewMetaText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '600',
  },
  previewViewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  previewBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    zIndex: 2,
  },
  previewFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(5,7,11,0.9)',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
