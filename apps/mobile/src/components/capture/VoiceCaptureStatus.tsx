import { useEffect } from 'react';
import { Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing } from '../../theme/spacing';
import type { VoiceCaptureState } from '../../state/voiceCaptureReducer';

interface VoiceCaptureStatusProps {
  state: VoiceCaptureState;
}

function labelForState(state: VoiceCaptureState): string | null {
  switch (state) {
    case 'opening':
    case 'requesting-permission':
      return 'Starting…';
    case 'listening':
      return 'Listening…';
    case 'speech-detected':
      return 'Hearing you…';
    case 'processing':
      return 'Finalizing…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Added to Inbox';
    case 'no-speech':
      return 'No speech detected';
    case 'permission-denied':
      return 'Microphone access required';
    case 'error':
      return 'Something went wrong';
    default:
      return null;
  }
}

const ANNOUNCE_STATES: VoiceCaptureState[] = [
  'listening', 'speech-detected', 'processing', 'saved',
  'no-speech', 'permission-denied', 'error',
];

export function VoiceCaptureStatus({ state }: VoiceCaptureStatusProps) {
  const mat = itemComposerMaterial.dark;
  const label = labelForState(state);

  useEffect(() => {
    if (label && ANNOUNCE_STATES.includes(state)) {
      AccessibilityInfo.announceForAccessibility(label);
    }
  }, [state, label]);

  if (!label) return null;

  return (
    <Text style={[styles.label, { color: mat.platinumMuted }]} accessibilityLiveRegion="polite">
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing[2],
    letterSpacing: 0.2,
  },
});
