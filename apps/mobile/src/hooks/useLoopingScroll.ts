import { useEffect } from 'react';
import { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Mirrors utils/loopingScroll.ts's computeLoopFrame formula, reimplemented
// inline here because Reanimated worklets (the useAnimatedStyle callback
// below, which runs on the UI thread) need every function they call to be
// a worklet — importing a plain utils function across that boundary is a
// common source of subtle bugs in this ecosystem, so the tiny formula is
// duplicated on purpose. computeLoopFrame itself stays the source of truth
// for correctness, verified by loopingScroll.test.ts.
export function useLoopingScroll(
  loopDurationMs: number,
  resetCrossfadeMs: number,
  scrollRangePx: number,
  reduceMotion: boolean,
) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: loopDurationMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [loopDurationMs, reduceMotion, t]);

  const resetFraction = resetCrossfadeMs / loopDurationMs;

  const primaryStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { transform: [{ translateX: 0 }], opacity: 1 };
    }
    const crossfadeStart = 1 - resetFraction;
    const primaryOpacity = t.value < crossfadeStart ? 1 : 1 - (t.value - crossfadeStart) / resetFraction;
    return {
      transform: [{ translateX: -t.value * scrollRangePx }],
      opacity: primaryOpacity,
    };
  }, [scrollRangePx, resetFraction, reduceMotion]);

  const resetStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0 };
    }
    const crossfadeStart = 1 - resetFraction;
    const primaryOpacity = t.value < crossfadeStart ? 1 : 1 - (t.value - crossfadeStart) / resetFraction;
    return { opacity: 1 - primaryOpacity };
  }, [resetFraction, reduceMotion]);

  return { primaryStyle, resetStyle };
}
