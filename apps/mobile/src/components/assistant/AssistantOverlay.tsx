import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme/colors';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { useThemeContext } from '../../hooks/useThemeContext';
import { RiverStoneSurface } from '../riverstone';
import { askAssistant, resolveAssistantActions, hasAssistant, type PendingAssistantCall } from '../../services/ai/assistant';
import { parseAssistantMessage } from './parseAssistantMessage';
import {
  getItemWithMetadata,
  getAssistantConversation,
  setAssistantConversation,
  clearAssistantConversation,
} from '../../db/database';
import type { Item } from '../../db/types';
import { X, Sparkles } from '../../icons';
import PaperAirplaneIcon from 'react-native-heroicons/solid/PaperAirplaneIcon';

interface AssistantOverlayProps {
  onClose: () => void;
  // How to open an item when the user taps an [[id:Title]] link in a reply.
  // Injected by the caller because navigation differs per platform — native
  // uses react-navigation + ItemComposer, web uses its own sidebar model.
  // When omitted, tapping a link just closes the overlay.
  onOpenItem?: (item: Item) => void;
}

type DisplayTurn =
  | { kind: 'text'; role: 'user' | 'model'; text: string }
  | { kind: 'action-result'; text: string };

// Durable conversation snapshot — persisted via the data layer (SQLite on
// native, localStorage on web) so the thread survives closing/reopening the
// overlay AND a full app restart or crash. Cleared by the header "New" button.
type PersistedConversation = {
  turns: DisplayTurn[];
  rawHistory: any[];
  pending: PendingAssistantCall[] | null;
  accepted: number[];
};

function loadPersistedConversation(): PersistedConversation {
  const stored = getAssistantConversation<PersistedConversation>();
  return {
    turns: stored?.turns ?? [],
    rawHistory: stored?.rawHistory ?? [],
    pending: stored?.pending ?? null,
    accepted: stored?.accepted ?? [],
  };
}

export function AssistantOverlay({ onClose, onOpenItem }: AssistantOverlayProps) {
  const { isDark } = useThemeContext();
  const c = getThemeColors(isDark);
  const mat = {
    background: c.bg,
    platinum: c.text,
    platinumMuted: c.textSecondary,
    accent: c.vermilion,
    accentSoft: c.vermilionSoft,
    fill: c.fill,
    rim: c.separator,
    onAccent: '#FFFFFF',
  };
  const stoneMode = isDark ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<any>(null);

  // Restore the persisted thread once, on mount, so a reopened overlay (or one
  // relaunched after a crash/restart) resumes exactly where it left off.
  const restored = useRef(loadPersistedConversation()).current;
  const [turns, setTurns] = useState<DisplayTurn[]>(restored.turns);
  const [pending, setPending] = useState<PendingAssistantCall[] | null>(restored.pending);
  // Per-action accept state for the confirmation card — each proposed action is
  // toggled individually; Done submits the accepted set. Defaults to all accepted.
  const [accepted, setAccepted] = useState<Set<number>>(new Set(restored.accepted));
  const [rawHistory, setRawHistory] = useState<any[]>(restored.rawHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      // KeyboardAvoidingView shrinks the scroll viewport without changing its
      // content size, so onContentSizeChange never fires here on its own —
      // without this the latest messages end up hidden behind the keyboard.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Persist on every change so the thread survives unmount, reload, and crash.
  useEffect(() => {
    setAssistantConversation({ turns, rawHistory, pending, accepted: [...accepted] });
  }, [turns, rawHistory, pending, accepted]);

  const startNewConversation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTurns([]);
    setRawHistory([]);
    setPending(null);
    setAccepted(new Set());
    setError(null);
    setInput('');
    clearAssistantConversation();
  };

  const opacity = useSharedValue(0);
  useState(() => {
    opacity.value = withTiming(1, { duration: reducedMotion ? 120 : 220 });
  });
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  const handleLinkPress = (id: string) => {
    const item = getItemWithMetadata(id);
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    onOpenItem?.(item);
  };

  const submitMessage = async (question: string) => {
    if (!question || busy || pending) return;
    setInput('');
    setError(null);
    setTurns((prev) => [...prev, { kind: 'text', role: 'user', text: question }]);
    setBusy(true);
    try {
      const result: any = await askAssistant(question, rawHistory);
      if (result && result.kind === 'pending') {
        setPending(result.calls);
        setAccepted(new Set(result.calls.map((_: any, i: number) => i)));
        setRawHistory(result.rawHistory);
      } else {
        const text = typeof result === 'string' ? result : result.text;
        setTurns((prev) => [...prev, { kind: 'text', role: 'model', text }]);
        if (result && result.rawHistory) setRawHistory(result.rawHistory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const handleSend = () => submitMessage(input.trim());

  const handleResolvePending = async (confirmedIndices: Set<number>) => {
    if (!pending) return;
    const calls = pending;
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      const decisions = calls.map((call, i) => ({ call, confirmed: confirmedIndices.has(i) }));
      const resultLines = calls
        .filter((_, i) => confirmedIndices.has(i))
        .map((call) => `✓ ${call.preview}`);
      if (resultLines.length > 0) {
        setTurns((prev) => [...prev, ...resultLines.map((text) => ({ kind: 'action-result' as const, text }))]);
      }
      const result: any = await resolveAssistantActions(rawHistory, decisions);
      if (result.kind === 'pending') {
        setPending(result.calls);
        setAccepted(new Set(result.calls.map((_: any, i: number) => i)));
        setRawHistory(result.rawHistory);
      } else {
        setTurns((prev) => [...prev, { kind: 'text', role: 'model', text: result.text }]);
        setRawHistory(result.rawHistory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  // Web: while a confirmation card is up the text input is disabled, so it
  // can't catch Enter — listen at the window instead. Enter submits the
  // currently-accepted actions, Escape cancels them all. acceptedRef keeps the
  // listener reading the latest selection without re-subscribing. No-op on native.
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  useEffect(() => {
    if (Platform.OS !== 'web' || !pending) return;
    const w: any = globalThis;
    const handler = (e: any) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleResolvePending(new Set(acceptedRef.current));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleResolvePending(new Set());
      }
    };
    w.addEventListener?.('keydown', handler);
    return () => w.removeEventListener?.('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Web: send on Enter, newline on Shift+Enter. react-native-web's onKeyPress
  // mapping is unreliable for the Enter key (keypress often doesn't fire), so
  // attach a real DOM keydown listener to the underlying <textarea> via ref.
  // handleSendRef keeps the listener pointed at the latest closure without
  // re-attaching every render. No-op on native (ref node has no addEventListener).
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    const handler = (e: any) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: mat.background, paddingTop: insets.top },
        overlayStyle,
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Sparkles size={16} color={mat.accent} strokeWidth={1.75} />
          <Text style={[styles.title, { color: mat.platinumMuted }]}>Sensei</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {turns.length > 0 || pending ? (
            <TouchableOpacity
              onPress={startNewConversation}
              style={{ height: 44, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="New conversation"
              hitSlop={8}
            >
              <Text style={{ color: mat.platinumMuted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: fontSize.sm }}>New</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close Sensei"
            hitSlop={12}
          >
            <X size={20} color={mat.platinum} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // Must be 0 here: with behavior="padding" the avoided space is
        // ~keyboardHeight + keyboardVerticalOffset, so any positive value adds a
        // dead gap between the input and the keyboard. The view already extends
        // to the screen bottom, so 0 seats the input flush above the keyboard.
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.length === 0 ? (
            <View>
              <Text style={[styles.empty, { color: mat.platinumMuted }]}>
                Ask about your tasks, missions, medications, or domains — or ask me to add, update,
                complete, or delete something. I'll always check with you before making a change.
              </Text>
              {hasAssistant ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[5] }}>
                  {[
                    { label: '✦ Set up my system', prompt: 'Guide me through setting up my whole system — my domains, missions, skills and habits — asking me questions one at a time.' },
                    { label: 'Plan my day', prompt: 'Help me plan my day. Ask me what I need to about my time and energy, then suggest what to focus on.' },
                    { label: 'What should I focus on?', prompt: 'Looking at my current data, what should I focus on right now?' },
                  ].map((chip) => (
                    <TouchableOpacity
                      key={chip.label}
                      onPress={() => submitMessage(chip.prompt)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={chip.label}
                    >
                      <RiverStoneSurface
                        variant="chip"
                        mode={stoneMode}
                        shape="regular"
                        fill={false}
                        contentStyle={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
                      >
                        <Text style={{ color: mat.platinum, fontSize: fontSize.sm, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>
                          {chip.label}
                        </Text>
                      </RiverStoneSurface>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {turns.map((turn, i) => {
            if (turn.kind === 'action-result') {
              return (
                <RiverStoneSurface
                  key={i}
                  variant="chip"
                  mode={stoneMode}
                  shape="regular"
                  fill={false}
                  style={[styles.bubbleWrap, styles.bubbleStart]}
                  contentStyle={styles.bubbleContent}
                  background={<View style={[StyleSheet.absoluteFill, { backgroundColor: mat.accentSoft }]} />}
                >
                  <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
                </RiverStoneSurface>
              );
            }
            const isUser = turn.role === 'user';
            return (
              <RiverStoneSurface
                key={i}
                variant={isUser ? 'chip' : 'list'}
                mode={stoneMode}
                shape="regular"
                fill={false}
                style={[styles.bubbleWrap, isUser ? styles.bubbleEnd : styles.bubbleStart]}
                contentStyle={styles.bubbleContent}
                background={isUser ? <View style={[StyleSheet.absoluteFill, { backgroundColor: mat.accentSoft }]} /> : undefined}
              >
                {turn.role === 'model' ? (
                  <Text style={[styles.bubbleText, { color: mat.platinum }]}>
                    {parseAssistantMessage(turn.text).map((segment, segIndex) => {
                      if (segment.kind === 'bold') {
                        return (
                          <Text key={segIndex} style={styles.bold}>
                            {segment.text}
                          </Text>
                        );
                      }
                      if (segment.kind === 'link') {
                        return (
                          <Text
                            key={segIndex}
                            style={[styles.link, { color: mat.accent }]}
                            onPress={() => handleLinkPress(segment.id)}
                          >
                            {segment.text}
                          </Text>
                        );
                      }
                      return <Text key={segIndex}>{segment.text}</Text>;
                    })}
                  </Text>
                ) : (
                  <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
                )}
              </RiverStoneSurface>
            );
          })}
          {pending ? (
            <RiverStoneSurface
              variant="card"
              mode={stoneMode}
              shape="regular"
              fill={false}
              style={styles.pendingWrap}
              contentStyle={{ paddingHorizontal: spacing[5], paddingVertical: spacing[4] }}
            >
              <Text style={{ color: mat.platinumMuted, marginBottom: spacing[3], fontSize: fontSize.base, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>
                {pending.length > 1 ? 'Review each — tap to include or skip:' : 'Confirm this action:'}
              </Text>
              {pending.map((call, i) => {
                const isOn = accepted.has(i);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() =>
                      setAccepted((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      opacity: isOn ? 1 : 0.45,
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn }}
                    accessibilityLabel={call.preview}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        borderWidth: 1.5,
                        borderColor: isOn ? mat.accent : mat.rim,
                        backgroundColor: isOn ? mat.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isOn ? <Text style={{ color: mat.onAccent, fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: mat.platinum, flex: 1, flexShrink: 1, fontSize: fontSize.lg, lineHeight: 23, textDecorationLine: isOn ? 'none' : 'line-through' }}>
                      {call.preview}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] }}>
                <TouchableOpacity
                  onPress={() => handleResolvePending(new Set(accepted))}
                  style={{ flex: 1, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: mat.accent }}
                  accessibilityRole="button"
                  accessibilityLabel={accepted.size > 0 ? 'Confirm selected' : 'Skip all'}
                >
                  <Text style={{ color: mat.onAccent, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: fontSize.lg }}>
                    {accepted.size === 0 ? 'Skip all' : accepted.size === pending.length ? 'Confirm' : `Confirm ${accepted.size}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleResolvePending(new Set())}
                  style={{ flex: 1, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: mat.fill }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={{ color: mat.platinum, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: fontSize.lg }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </RiverStoneSurface>
          ) : null}
          {busy ? (
            <RiverStoneSurface variant="list" mode={stoneMode} shape="regular" fill={false} style={[styles.bubbleWrap, styles.bubbleStart]} contentStyle={styles.bubbleContent}>
              <Text style={[styles.bubbleText, { color: mat.platinumMuted }]}>Thinking…</Text>
            </RiverStoneSurface>
          ) : null}
          {error ? <Text style={[styles.errorText, { color: c.red }]}>{error}</Text> : null}
        </ScrollView>

        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: mat.rim,
              // The home-indicator safe-area inset is only needed when the
              // keyboard is hidden — while it's up the keyboard covers that
              // area, so collapse the padding to avoid a dead gap.
              paddingBottom: keyboardVisible ? spacing[3] : Math.max(insets.bottom, spacing[4]),
            },
          ]}
        >
          <RiverStoneSurface
            variant="chip"
            mode={stoneMode}
            shape="regular"
            fill={false}
            style={styles.inputSurface}
            contentStyle={styles.inputSurfaceContent}
          >
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder={hasAssistant ? 'Ask anything…' : 'Sensei unavailable — Firebase not configured'}
              placeholderTextColor={mat.platinumMuted}
              style={[styles.input, { color: mat.platinum }]}
              editable={hasAssistant && !busy && !pending}
              multiline
              autoCorrect
              autoCapitalize="sentences"
              spellCheck
              keyboardAppearance={isDark ? 'dark' : 'light'}
              onSubmitEditing={handleSend}
            />
          </RiverStoneSurface>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!hasAssistant || busy || !!pending || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: mat.accent, opacity: !hasAssistant || busy || !!pending || !input.trim() ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <PaperAirplaneIcon size={18} color={mat.onAccent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 999, flexDirection: 'column' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: spacing[5], gap: spacing[3] },
  empty: { fontSize: fontSize.base, lineHeight: 22, paddingTop: spacing[8] },
  bubbleWrap: { maxWidth: '85%', alignSelf: 'stretch', flexGrow: 0, flexShrink: 0 },
  bubbleStart: { alignSelf: 'flex-start' },
  bubbleEnd: { alignSelf: 'flex-end' },
  bubbleContent: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
  bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
  link: { fontFamily: 'Inter_600SemiBold', fontWeight: '600', textDecorationLine: 'underline' },
  errorText: { fontSize: fontSize.sm, paddingTop: spacing[2] },
  pendingWrap: { alignSelf: 'stretch' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputSurface: { flex: 1 },
  inputSurfaceContent: { paddingHorizontal: spacing[4], paddingVertical: spacing[1] },
  input: {
    fontSize: fontSize.base,
    maxHeight: 120,
    paddingVertical: spacing[2],
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
