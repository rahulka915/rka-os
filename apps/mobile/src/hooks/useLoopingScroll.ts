import { useEffect } from 'react';
import { Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

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
  // Product decision (2026-08-16): unlike reduceMotion (which freezes at the
  // start position), `active=false` freezes the layer wherever its scroll
  // currently is — used to pause midground/foreground while the ronin sprite
  // is idle and only resume while it's walking, so the scene doesn't drift
  // when nothing on screen is moving. Defaults true for layers (like sky)
  // that should always keep drifting regardless of walking state.
  active: boolean = true,
) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !active) {
      cancelAnimation(t);
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
  }, [loopDurationMs, reduceMotion, active, t]);

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
