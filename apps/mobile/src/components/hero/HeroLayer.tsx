import React from 'react';
import { Image, StyleSheet, Animated } from 'react-native';
import type { HeroLayer as HeroLayerConfig } from '../../utils/heroConfig';

interface Props {
  layer: HeroLayerConfig;
  source: any; // Image require()
  parallaxX: Animated.Value;
  parallaxY: Animated.Value;
  width: number;
  height: number;
}

export function HeroLayer({
  layer,
  source,
  parallaxX,
  parallaxY,
  width,
  height,
}: Props) {
  const animatedStyle = {
    transform: [
      {
        translateX: parallaxX.interpolate({
          inputRange: [-15, 0, 15],
          outputRange: [-layer.parallaxFactor * 20, 0, layer.parallaxFactor * 20],
        }),
      },
      {
        translateY: parallaxY.interpolate({
          inputRange: [-15, 0, 15],
          outputRange: [-layer.parallaxFactor * 20, 0, layer.parallaxFactor * 20],
        }),
      },
    ],
    opacity: layer.opacity ?? 1,
  };

  return (
    <Animated.Image
      source={source}
      style={[
        s.layer,
        { width, height },
        animatedStyle,
      ]}
    />
  );
}

const s = StyleSheet.create({
  layer: {
    position: 'absolute',
    resizeMode: 'cover',
  },
});
