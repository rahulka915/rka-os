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
}

function useSingleLoopingImage(
  layer: SkyLayer,
  source: ImageSourcePropType,
  containerWidth: number,
  containerHeight: number,
  reduceMotion: boolean,
) {
  const config = LAYER_SCROLL_CONFIG[layer];
  const layerWidth = containerWidth * config.widthMultiplier;
  const scrollRangePx = layerWidth - containerWidth;
  const { primaryStyle, resetStyle } = useLoopingScroll(config.loopDurationMs, RESET_CROSSFADE_MS, scrollRangePx, reduceMotion);
  const imageStyle = { width: layerWidth, height: containerHeight };
  return { primaryStyle, resetStyle, imageStyle, source };
}

export function SkyLayerView({ layer, sourceA, sourceB, blend, containerWidth, containerHeight, reduceMotion }: SkyLayerViewProps) {
  const a = useSingleLoopingImage(layer, sourceA, containerWidth, containerHeight, reduceMotion);
  const b = useSingleLoopingImage(layer, sourceB, containerWidth, containerHeight, reduceMotion);

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
