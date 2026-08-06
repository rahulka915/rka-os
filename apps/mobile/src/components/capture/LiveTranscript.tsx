import { View, Text, StyleSheet } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, lineHeight, spacing } from '../../theme/spacing';
import type { VoiceCaptureState } from '../../state/voiceCaptureReducer';

interface LiveTranscriptProps {
  interim: string;
  transcript: string;
  state: VoiceCaptureState;
}

export function LiveTranscript({ interim, transcript, state }: LiveTranscriptProps) {
  const mat = itemComposerMaterial.dark;

  const showPlaceholder =
    !interim && !transcript && (state === 'listening' || state === 'opening' || state === 'requesting-permission');

  const displayText = transcript || interim;

  return (
    <View style={styles.container}>
      {showPlaceholder ? (
        <Text style={[styles.placeholder, { color: mat.platinumMuted }]}>
          Listening…
        </Text>
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: transcript ? mat.platinum : mat.platinumMuted,
            },
          ]}
        >
          {displayText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  text: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  placeholder: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
