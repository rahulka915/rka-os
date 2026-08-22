import { Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useLoopingScroll } from '../../hooks/useLoopingScroll';
import { LAYER_SCROLL_CONFIG, RESET_CROSSFADE_MS, type SkyLayer } from '../../utils/loopingScroll';

interface SkyLayerViewProps {
  layer: SkyLayer;
  sourceA: ImageSourcePropType;
  sourceB: ImageSourcePropType;
  /** 0-1 time-of-day blend fraction from bucketA toward bucketB (see skyTimeOfDay.ts's getSkyBlend). */
  blend: number;
  containerWidth: number;
  containerHeight: number;
  reduceMotion: boolean;
  /** See useLoopingScroll's `active` param — defaults true (always drifting). */
  active?: boolean;
  /**
   * Divides loopDurationMs (i.e. multiplies scroll speed) — LAYER_SCROLL_CONFIG's
   * base durations (3-20min loops) are tuned for slow ambient drift, not an
   * actual "running" feel, so isWalking passes a much higher multiplier here
   * to make the ground layers move fast enough to match the walk-cycle
   * cadence instead of looking like the character is jogging in place
   * against a near-static world. Defaults 1 (unmodified ambient speed).
   */
  speedMultiplier?: number;
}

function useSingleLoopingImage(
  layer: SkyLayer,
  source: ImageSourcePropType,
  containerWidth: number,
  containerHeight: number,
  reduceMotion: boolean,
  active: boolean,
  speedMultiplier: number,
) {
  const config = LAYER_SCROLL_CONFIG[layer];
  const layerWidth = containerWidth * config.widthMultiplier;
  const scrollRangePx = layerWidth - containerWidth;
  const loopDurationMs = config.loopDurationMs / speedMultiplier;
  // RESET_CROSSFADE_MS (1500ms) is calibrated against the ambient loop
  // durations (3-20min) — at speedMultiplier's much shorter loops (e.g. a
  // 3s foreground loop while walking), a fixed 1500ms fade would eat half
  // the loop and read as a slow dissolve instead of a seamless scroll. Scale
  // it down by the same multiplier so the fade stays a small, constant
  // fraction of the loop at any speed; floor it so it's never so short it
  // snaps instead of dissolving.
  const resetCrossfadeMs = Math.max(80, RESET_CROSSFADE_MS / speedMultiplier);
  const { primaryStyle, resetStyle } = useLoopingScroll(loopDurationMs, resetCrossfadeMs, scrollRangePx, reduceMotion, active);
  const imageStyle = { width: layerWidth, height: containerHeight };
  return { primaryStyle, resetStyle, imageStyle, source };
}

export function SkyLayerView({ layer, sourceA, sourceB, blend, containerWidth, containerHeight, reduceMotion, active = true, speedMultiplier = 1 }: SkyLayerViewProps) {
  const a = useSingleLoopingImage(layer, sourceA, containerWidth, containerHeight, reduceMotion, active, speedMultiplier);
  const b = useSingleLoopingImage(layer, sourceB, containerWidth, containerHeight, reduceMotion, active, speedMultiplier);

  const bucketBStyle = useAnimatedStyle(() => ({ opacity: blend }), [blend]);

  return (
    <Animated.View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, a.primaryStyle]}>
        <Image source={a.source} resizeMode="cover" style={a.imageStyle} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, a.resetStyle]} pointerEvents="none">
        <Image source={a.source} resizeMode="cover" style={a.imageStyle} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bucketBStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, b.primaryStyle]}>
          <Image source={b.source} resizeMode="cover" style={b.imageStyle} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, b.resetStyle]} pointerEvents="none">
          <Image source={b.source} resizeMode="cover" style={b.imageStyle} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
