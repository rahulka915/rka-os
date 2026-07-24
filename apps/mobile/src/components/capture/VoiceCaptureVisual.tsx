import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { itemComposerMaterial } from '../../theme/itemComposer';
import type { VoiceCaptureState } from '../../state/voiceCaptureReducer';

interface VoiceCaptureVisualProps {
  state: VoiceCaptureState;
  audioLevel: number;
}

const RING_SIZE = 120;
const ORB_BASE = 60;

export function VoiceCaptureVisual({ state, audioLevel }: VoiceCaptureVisualProps) {
  const mat = itemComposerMaterial.dark;
  const reducedMotion = useReducedMotion();

  const breathScale = useSharedValue(1);
  const orbScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  const isListening = state === 'listening' || state === 'speech-detected';

  useEffect(() => {
    if (reducedMotion || !isListening) {
      breathScale.value = withTiming(1, { duration: 200 });
      ringOpacity.value = withTiming(isListening ? 0.8 : 0.4, { duration: 200 });
      return;
    }
    breathScale.value = withRepeat(
      withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    ringOpacity.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [isListening, reducedMotion, breathScale, ringOpacity]);

  useEffect(() => {
    if (reducedMotion) return;
    if (state === 'speech-detected') {
      const scale = 1 + audioLevel * 0.22;
      orbScale.value = withTiming(scale, { duration: 80 });
    } else {
      orbScale.value = withTiming(1, { duration: 200 });
    }
  }, [audioLevel, state, reducedMotion, orbScale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: breathScale.value }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const ringColor = isListening ? mat.accent : mat.rim;
  const orbColor = isListening ? mat.accentSoft : mat.fill;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.ring,
          { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderColor: ringColor },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          { width: ORB_BASE, height: ORB_BASE, borderRadius: ORB_BASE / 2, backgroundColor: orbColor },
          orbStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  orb: {
    position: 'absolute',
  },
});
