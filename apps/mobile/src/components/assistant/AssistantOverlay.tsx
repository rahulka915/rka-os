import { useEffect, useRef, useState } from 'react';
import {
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
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { askAssistant, hasAssistant } from '../../services/ai/assistant';
// resolveAssistantActions/PendingAssistantCall only exist on the web build's assistant.web.ts;
// native's assistant.ts doesn't export them, and tsc's module resolution (unlike Metro) doesn't
// understand the .web.ts platform-extension convention, so the type import points at the .web.ts
// file explicitly — it's erased at runtime anyway, so this doesn't affect native's actual bundle.
import type { PendingAssistantCall } from '../../services/ai/assistant.web';
import { parseAssistantMessage } from './parseAssistantMessage';
import { getItemWithMetadata } from '../../db/database';
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

export function AssistantOverlay({ onClose, onOpenItem }: AssistantOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<any>(null);

  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [pending, setPending] = useState<PendingAssistantCall[] | null>(null);
  const [rawHistory, setRawHistory] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSend = async () => {
    const question = input.trim();
    if (!question || busy || pending) return;
    setInput('');
    setError(null);
    setTurns((prev) => [...prev, { kind: 'text', role: 'user', text: question }]);
    setBusy(true);
    try {
      const result: any = await askAssistant(question, rawHistory);
      if (result && result.kind === 'pending') {
        setPending(result.calls);
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

  const handleResolvePending = async (confirmedIndices: Set<number>) => {
    if (!pending) return;
    const calls = pending;
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      // Cast to any: this branch only ever runs when `pending` was set, which only happens on
      // web (native's askAssistant never returns { kind: 'pending' }), so resolveAssistantActions
      // is guaranteed to exist at runtime even though native's assistant.ts doesn't statically
      // export it — see the type-import comment above.
      const assistantModule: any = await import('../../services/ai/assistant');
      const resolveAssistantActions = assistantModule.resolveAssistantActions;
      const decisions = calls.map((call, i) => ({ call, confirmed: confirmedIndices.has(i) }));
      const resultLines = calls
        .filter((_, i) => confirmedIndices.has(i))
        .map((call) => `✓ ${call.preview}`);
      if (resultLines.length > 0) {
        setTurns((prev) => [...prev, ...resultLines.map((text) => ({ kind: 'action-result' as const, text }))]);
      }
      const result: any = await (resolveAssistantActions as any)(rawHistory, decisions);
      if (result.kind === 'pending') {
        setPending(result.calls);
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
  // can't catch Enter — listen at the window instead. Enter confirms all
  // pending actions, Escape cancels them. No-op on native.
  useEffect(() => {
    if (Platform.OS !== 'web' || !pending) return;
    const w: any = globalThis;
    const handler = (e: any) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleResolvePending(new Set(pending.map((_, i) => i)));
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
          <Text style={[styles.title, { color: mat.platinumMuted }]}>Assistant</Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close assistant"
          hitSlop={12}
        >
          <X size={20} color={mat.platinum} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.length === 0 ? (
            <Text style={[styles.empty, { color: mat.platinumMuted }]}>
              Ask about your tasks, missions, medications, or domains — or ask me to add, update,
              complete, or delete something. I'll always check with you before making a change.
            </Text>
          ) : null}
          {turns.map((turn, i) => {
            if (turn.kind === 'action-result') {
              return (
                <View key={i} style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.accentSoft }]}>
                  <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
                </View>
              );
            }
            return (
              <View
                key={i}
                style={[
                  styles.bubble,
                  turn.role === 'user'
                    ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
                    : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
                ]}
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
              </View>
            );
          })}
          {pending ? (
            <View
              style={[
                styles.bubble,
                { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1, maxWidth: '100%' },
              ]}
            >
              {pending.map((call, i) => (
                <Text key={i} style={[styles.bubbleText, { color: mat.platinum, marginBottom: spacing[2] }]}>
                  {call.preview}
                </Text>
              ))}
              <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
                <TouchableOpacity
                  onPress={() => handleResolvePending(new Set(pending.map((_, i) => i)))}
                  style={[styles.sendBtn, { width: 'auto', paddingHorizontal: spacing[4], backgroundColor: mat.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm"
                >
                  <Text style={{ color: mat.onAccent, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleResolvePending(new Set())}
                  style={[styles.sendBtn, { width: 'auto', paddingHorizontal: spacing[4], backgroundColor: mat.fill }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={{ color: mat.platinum, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {busy ? (
            <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 }]}>
              <Text style={[styles.bubbleText, { color: mat.platinumMuted }]}>Thinking…</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.errorText, { color: '#e0716b' }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.inputRow, { borderTopColor: mat.rim, paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={hasAssistant ? 'Ask anything…' : 'Assistant unavailable — Firebase not configured'}
            placeholderTextColor={mat.platinumMuted}
            style={[styles.input, { color: mat.platinum, backgroundColor: mat.fill }]}
            editable={hasAssistant && !busy && !pending}
            multiline
            onSubmitEditing={handleSend}
          />
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
  messages: { padding: spacing[5], gap: spacing[3], flexGrow: 1 },
  empty: { fontSize: fontSize.base, lineHeight: 22, paddingTop: spacing[8] },
  bubble: { maxWidth: '85%', borderRadius: radius.card, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
  bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
  link: { fontFamily: 'Inter_600SemiBold', fontWeight: '600', textDecorationLine: 'underline' },
  errorText: { fontSize: fontSize.sm, paddingTop: spacing[2] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
