import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, lineHeight, spacing, radius } from '../../theme/spacing';
import type { VoiceErrorKind } from '../../state/voiceCaptureReducer';

interface VoiceCaptureErrorProps {
  kind: VoiceErrorKind | undefined;
  message?: string;
  onRetry: () => void;
  onTypeInstead: () => void;
  onCancel: () => void;
}

function errorContent(kind: VoiceErrorKind | undefined) {
  switch (kind) {
    case 'unsupported':
      return {
        title: 'Speech not available',
        body: "This device can't transcribe speech. You can still type your capture instead.",
        showRetry: false,
      };
    case 'transcription':
      return {
        title: 'Recognition failed',
        body: 'Speech recognition encountered an error. You can retry or switch to typing.',
        showRetry: true,
      };
    case 'unknown':
    default:
      return {
        title: 'Something went wrong',
        body: 'An unexpected error occurred. You can retry or type your capture instead.',
        showRetry: true,
      };
  }
}

export function VoiceCaptureError({
  kind,
  message,
  onRetry,
  onTypeInstead,
  onCancel,
}: VoiceCaptureErrorProps) {
  const mat = itemComposerMaterial.dark;
  const { title, body, showRetry } = errorContent(kind);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: mat.platinum }]}>{title}</Text>
      <Text style={[styles.body, { color: mat.platinumMuted }]}>{body}</Text>
      {message ? (
        <Text style={[styles.detail, { color: mat.platinumMuted }]}>{message}</Text>
      ) : null}

      <View style={styles.actions}>
        {showRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.btn, { backgroundColor: mat.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Retry voice capture"
            hitSlop={8}
          >
            <Text style={[styles.btnText, { color: mat.onAccent }]}>Retry</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onTypeInstead}
          style={[styles.btn, { borderWidth: 1, borderColor: mat.rim }]}
          accessibilityRole="button"
          accessibilityLabel="Type instead"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.platinum }]}>Type instead</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
        >
          <Text style={[styles.cancelText, { color: mat.platinumMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NoSpeechError({
  onRetry,
  onTypeInstead,
  onCancel,
}: Pick<VoiceCaptureErrorProps, 'onRetry' | 'onTypeInstead' | 'onCancel'>) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: mat.platinum }]}>No speech detected</Text>
      <Text style={[styles.body, { color: mat.platinumMuted }]}>
        Nothing was heard. Try speaking closer to the microphone.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.btn, { backgroundColor: mat.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.onAccent }]}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onTypeInstead}
          style={[styles.btn, { borderWidth: 1, borderColor: mat.rim }]}
          accessibilityRole="button"
          accessibilityLabel="Type instead"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.platinum }]}>Type instead</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
        >
          <Text style={[styles.cancelText, { color: mat.platinumMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PermissionDeniedError({
  onRetry,
  onTypeInstead,
  onCancel,
}: Pick<VoiceCaptureErrorProps, 'onRetry' | 'onTypeInstead' | 'onCancel'>) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: mat.platinum }]}>Microphone access needed</Text>
      <Text style={[styles.body, { color: mat.platinumMuted }]}>
        RKA OS needs microphone access to capture voice notes. Enable it in Settings → RKA OS → Microphone.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.btn, { backgroundColor: mat.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.onAccent }]}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onTypeInstead}
          style={[styles.btn, { borderWidth: 1, borderColor: mat.rim }]}
          accessibilityRole="button"
          accessibilityLabel="Type instead"
          hitSlop={8}
        >
          <Text style={[styles.btnText, { color: mat.platinum }]}>Type instead</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
        >
          <Text style={[styles.cancelText, { color: mat.platinumMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

VoiceCaptureError.NoSpeech = NoSpeechError;
VoiceCaptureError.PermissionDenied = PermissionDeniedError;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
    gap: spacing[4],
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: fontSize.lg * lineHeight.snug,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
    textAlign: 'center',
  },
  detail: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  btn: {
    height: 48,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: fontSize.base,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  cancelBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: fontSize.base,
  },
});
