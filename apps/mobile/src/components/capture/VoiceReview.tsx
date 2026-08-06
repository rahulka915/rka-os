import { useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, lineHeight, spacing, radius } from '../../theme/spacing';

interface VoiceReviewProps {
  value: string;
  onChange: (text: string) => void;
  onCancel: () => void;
  onRetry: () => void;
  onSave: () => void;
  saving: boolean;
  error?: string;
}

export function VoiceReview({
  value,
  onChange,
  onCancel,
  onRetry,
  onSave,
  saving,
  error,
}: VoiceReviewProps) {
  const mat = itemComposerMaterial.dark;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const canSave = value.trim().length > 0 && !saving;

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            color: mat.platinum,
            borderColor: mat.rim,
            backgroundColor: mat.surface,
          },
        ]}
        value={value}
        onChangeText={onChange}
        multiline
        accessibilityLabel="Voice capture transcript"
        accessibilityHint="Edit the transcribed text before saving"
        placeholderTextColor={mat.platinumMuted}
        placeholder="Transcribed text…"
        scrollEnabled
      />

      {error ? (
        <Text style={[styles.error, { color: '#ff5147' }]} accessibilityRole="alert">
          {error} — transcript preserved.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.btn, styles.btnSecondary, { borderColor: mat.rim }]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.platinumMuted }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRetry}
          style={[styles.btn, styles.btnSecondary, { borderColor: mat.rim }]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.platinumMuted }]}>Try again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={canSave ? onSave : undefined}
          style={[
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: canSave ? mat.accent : mat.accentSoft },
          ]}
          accessibilityRole="button"
          accessibilityLabel={error ? 'Retry save' : 'Save to Inbox'}
          accessibilityState={{ disabled: !canSave }}
          hitSlop={8}
          disabled={!canSave}
        >
          <Text style={[styles.btnText, { color: canSave ? mat.onAccent : mat.platinumMuted }]}>
            {saving ? 'Saving…' : error ? 'Retry save' : 'Save to Inbox'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    gap: spacing[4],
  },
  input: {
    flex: 1,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.normal,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    textAlignVertical: 'top',
    maxHeight: 260,
  },
  error: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
