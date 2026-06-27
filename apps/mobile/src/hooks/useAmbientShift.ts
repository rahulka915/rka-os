import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { AMBIENT_SHIFT_CONFIG } from '../utils/heroConfig';

interface AmbientState {
  overlayOpacity: Animated.Value;
  gradientOffset: Animated.Value;
}

export function useAmbientShift(): AmbientState {
  const overlayOpacity = useRef(new Animated.Value(0.2)).current;
  const gradientOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Cycle through gradient over 3 minutes (0 → 1 → 0)
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(gradientOffset, {
          toValue: 1,
          duration: AMBIENT_SHIFT_CONFIG.cycleDuration / 2,
          useNativeDriver: false,
        }),
        Animated.timing(gradientOffset, {
          toValue: 0,
          duration: AMBIENT_SHIFT_CONFIG.cycleDuration / 2,
          useNativeDriver: false,
        }),
      ])
    );

    cycle.start();

    return () => cycle.stop();
  }, []);

  return { overlayOpacity, gradientOffset };
}
