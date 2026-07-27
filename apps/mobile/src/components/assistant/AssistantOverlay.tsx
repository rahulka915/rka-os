import { useRef, useState } from 'react';
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
import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
import { X, Sparkles } from '../../icons';
import PaperAirplaneIcon from 'react-native-heroicons/solid/PaperAirplaneIcon';

interface AssistantOverlayProps {
  onClose: () => void;
}

export function AssistantOverlay({ onClose }: AssistantOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  const [turns, setTurns] = useState<AssistantTurn[]>([]);
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

  const handleSend = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput('');
    setError(null);
    const nextTurns: AssistantTurn[] = [...turns, { role: 'user', text: question }];
    setTurns(nextTurns);
    setBusy(true);
    try {
      const answer = await askAssistant(question, turns);
      setTurns([...nextTurns, { role: 'model', text: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

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
              Ask about your tasks, projects, medications, or domains — I can see your current data
              but can't change anything yet.
            </Text>
          ) : null}
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
                  : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 }]}>
              <Text style={[styles.bubbleText, { color: mat.platinumMuted }]}>Thinking…</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.errorText, { color: '#e0716b' }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.inputRow, { borderTopColor: mat.rim, paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={hasAssistant ? 'Ask anything…' : 'Assistant unavailable — Firebase not configured'}
            placeholderTextColor={mat.platinumMuted}
            style={[styles.input, { color: mat.platinum, backgroundColor: mat.fill }]}
            editable={hasAssistant && !busy}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!hasAssistant || busy || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: mat.accent, opacity: !hasAssistant || busy || !input.trim() ? 0.4 : 1 }]}
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
  title: { fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: spacing[5], gap: spacing[3], flexGrow: 1 },
  empty: { fontSize: fontSize.base, lineHeight: 22, paddingTop: spacing[8] },
  bubble: { maxWidth: '85%', borderRadius: radius.card, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
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
