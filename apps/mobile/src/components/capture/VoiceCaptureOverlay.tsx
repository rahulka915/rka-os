import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { VoiceCaptureVisual } from './VoiceCaptureVisual';
import { LiveTranscript } from './LiveTranscript';
import { VoiceReview } from './VoiceReview';
import { VoiceCaptureStatus } from './VoiceCaptureStatus';
import { VoiceCaptureError } from './VoiceCaptureError';
import { X } from '../../icons';
import MicrophoneIcon from 'react-native-heroicons/outline/MicrophoneIcon';
import { StopCircle } from '../../icons';

interface VoiceCaptureOverlayProps {
  onSaved: () => void;
  onClose: () => void;
  onTypeInstead: () => void;
}

export function VoiceCaptureOverlay({ onSaved, onClose, onTypeInstead }: VoiceCaptureOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { state, open, stop, save, edit, retry, cancel } = useVoiceCapture();
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningHapticFired = useRef(false);

  // Animate overlay in
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.97);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: reducedMotion ? 120 : 220 });
    if (!reducedMotion) scale.value = withTiming(1, { duration: 220 });
  }, [opacity, scale, reducedMotion]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Open speech recognition on mount
  useEffect(() => {
    open();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Haptic when recording begins
  useEffect(() => {
    if (
      (state.status === 'listening' || state.status === 'speech-detected') &&
      !listeningHapticFired.current
    ) {
      listeningHapticFired.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [state.status]);

  // Auto-dismiss after saved
  useEffect(() => {
    if (state.status === 'saved') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      savedTimeoutRef.current = setTimeout(() => {
        onSaved();
        onClose();
      }, 900);
    }
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, [state.status, onSaved, onClose]);

  const handleCancel = async () => {
    await cancel();
    onClose();
  };

  const handleTypeInstead = () => {
    cancel().catch(() => {});
    onClose();
    onTypeInstead();
  };

  const handleSave = () => {
    save(state.transcript);
  };

  const handleRetry = async () => {
    await retry();
  };

  const isListening = state.status === 'listening' || state.status === 'speech-detected';
  const isReview = state.status === 'review';
  const isSaving = state.status === 'saving';
  const isSaved = state.status === 'saved';
  const isNoSpeech = state.status === 'no-speech';
  const isPermissionDenied = state.status === 'permission-denied';
  const isError = state.status === 'error';
  const isSaveError = isError && state.errorKind === 'save';
  const isNonSaveError = isError && state.errorKind !== 'save';

  // Save-error is handled inside VoiceReview (transcript preserved)
  const showReview = isReview || isSaving || isSaved || isSaveError;
  const showLive = !showReview && !isNoSpeech && !isPermissionDenied && !isNonSaveError;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: mat.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        overlayStyle,
      ]}
      accessibilityViewIsModal
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: mat.platinumMuted }]}>Voice Capture</Text>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel voice capture"
          hitSlop={12}
        >
          <X size={20} color={mat.platinum} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Main content area */}
      <View style={styles.content}>
        {showReview ? (
          <VoiceReview
            value={state.transcript}
            onChange={edit}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onSave={handleSave}
            saving={isSaving}
            error={isSaveError ? (state.errorMessage ?? 'Save failed') : undefined}
          />
        ) : isNoSpeech ? (
          <VoiceCaptureError.NoSpeech
            onRetry={handleRetry}
            onTypeInstead={handleTypeInstead}
            onCancel={handleCancel}
          />
        ) : isPermissionDenied ? (
          <VoiceCaptureError.PermissionDenied
            onRetry={handleRetry}
            onTypeInstead={handleTypeInstead}
            onCancel={handleCancel}
          />
        ) : isNonSaveError ? (
          <VoiceCaptureError
            kind={state.errorKind}
            message={state.errorMessage}
            onRetry={handleRetry}
            onTypeInstead={handleTypeInstead}
            onCancel={handleCancel}
          />
        ) : showLive ? (
          <LiveTranscript
            interim={state.interimTranscript}
            transcript={state.transcript}
            state={state.status}
          />
        ) : null}
      </View>

      {/* Bottom: visual + stop button (only while listening) */}
      {showLive ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + spacing[4], spacing[8]) }]}>
          <VoiceCaptureVisual state={state.status} audioLevel={state.audioLevel} />
          <VoiceCaptureStatus state={state.status} />

          {isListening ? (
            <TouchableOpacity
              onPress={stop}
              style={[styles.stopBtn, { backgroundColor: mat.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              hitSlop={8}
            >
              <StopCircle size={20} color={mat.onAccent} strokeWidth={1.75} />
              <Text style={[styles.stopBtnText, { color: mat.onAccent }]}>Stop</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : isSaved ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + spacing[4], spacing[8]) }]}>
          <VoiceCaptureStatus state={state.status} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  title: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  bottom: {
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 52,
    paddingHorizontal: spacing[7],
    borderRadius: radius.pill,
    marginTop: spacing[3],
  },
  stopBtnText: {
    fontSize: fontSize.base,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
