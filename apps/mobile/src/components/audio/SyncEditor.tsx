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
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '../../icons';
import { useThemeContext } from '../../hooks/useThemeContext';
import { LyricLine, DraftLine } from '../../lib/lyricTypes';
import { parseRawLyrics, round, formatTime } from '../../lib/lyricsUtils';
import { useLyricSync } from '../../hooks/useLyricSync';
import { LyricLine as LyricLineComponent } from './LyricLine';
import { InstrumentalCard } from './InstrumentalCard';

type Step = 'paste' | 'sync' | 'preview';

interface SyncEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (lyrics: LyricLine[]) => Promise<void>;
  currentTime?: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  initialLyrics?: LyricLine[];
}

export const SyncEditor = ({
  open,
  onClose,
  onSave,
  currentTime = 0,
  isPlaying = false,
  onPlayPause,
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

  const { activeIndex, progress } = useLyricSync(currentTime, buildLines());

  // ============ STEP 1: PASTE ============
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

  // ============ STEP 2: SYNC HELPERS ============
  const stampLyricLine = (id: string) => {
    updateLine(id, { startTime: currentTime });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setDraft(draft.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const deleteLine = (id: string) => {
    setDraft(draft.filter((l) => l.id !== id));
  };

  // ============ STEP 3: BUILD LINES ============
  function buildLines(): LyricLine[] {
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
              onPress={onPlayPause}
              style={styles.playButton}
            >
              <Text style={{ fontSize: 20 }}>
                {isPlaying ? '⏸' : '▶️'}
              </Text>
            </TouchableOpacity>

            {/* Speed selector */}
            <TouchableOpacity
              onPress={() => {
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

                <TouchableOpacity
                  onPress={() => deleteLine(item.id)}
                  style={styles.deleteButton}
                >
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
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

  // ============ RENDER STEP 3: PREVIEW ============
  if (step === 'preview') {
    const builtLines = buildLines();

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
              return item.kind === 'instrumental' ? (
                <InstrumentalCard
                  label={item.label || 'Instrumental'}
                  style={item.style}
                  progress={isActive ? progress : 0}
                />
              ) : (
                <LyricLineComponent
                  line={item}
                  active={isActive}
                  progress={isActive ? progress : 0}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  lyricsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lyricRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
    alignItems: 'flex-start',
  },
  stampButton: {
    width: 50,
    minHeight: 50,
    borderRadius: 12,
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
  previewList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
