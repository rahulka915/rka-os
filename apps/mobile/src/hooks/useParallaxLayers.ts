import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { TILT_CALIBRATION } from '../utils/heroConfig';

interface ParallaxState {
  tiltX: Animated.Value;
  tiltY: Animated.Value;
}

export function useParallaxLayers(): ParallaxState {
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Device motion is limited in some runtimes, so keep a lightweight fallback.
    // For now, we'll use a simple oscillation as placeholder (will wire to real motion later).

    const oscillation = Animated.loop(
      Animated.sequence([
        Animated.timing(tiltX, {
          toValue: TILT_CALIBRATION.maxTiltX * 0.3,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(tiltX, {
          toValue: -TILT_CALIBRATION.maxTiltX * 0.3,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    );

    oscillation.start();

    return () => oscillation.stop();
  }, []);

  return { tiltX, tiltY };
}
