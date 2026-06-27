import React from 'react';
import { View, StyleSheet, Dimensions, Animated, Image } from 'react-native';
import { useParallaxLayers } from '../../hooks/useParallaxLayers';
import { useAmbientShift } from '../../hooks/useAmbientShift';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import { ParticleCanvas } from './ParticleCanvas';

interface Props {
  timeOfDay: 'dawn' | 'day' | 'ember' | 'night';
}

export function HeroSection({ timeOfDay }: Props) {
  const { width, height } = Dimensions.get('window');
  const { tiltX, tiltY } = useParallaxLayers();
  const { overlayOpacity, gradientOffset } = useAmbientShift();
  const particles = useParticleSystem();

  const assetMap: Record<string, any> = {
    dawn: require('../../../assets/hero-dawn.png'),
    day: require('../../../assets/hero-day.png'),
    ember: require('../../../assets/hero-ember.png'),
    night: require('../../../assets/hero-night.png'),
  };

  const heroAsset = assetMap[timeOfDay];

  const backgroundColor = gradientOffset.interpolate({
    inputRange: [0, 1],
    outputRange: ['#87CEEB', '#FF6B35'],
  });

  const animatedStyle = {
    transform: [
      {
        translateX: tiltX.interpolate({
          inputRange: [-15, 0, 15],
          outputRange: [-10, 0, 10],
        }),
      },
      {
        translateY: tiltY.interpolate({
          inputRange: [-15, 0, 15],
          outputRange: [-10, 0, 10],
        }),
      },
    ],
  };

  return (
    <View style={[s.container, { width, height }]}>
      <Image
        source={heroAsset}
        style={[s.image, { width, height }]}
        resizeMode="cover"
      />

      <Animated.View
        style={[
          s.overlay,
          {
            backgroundColor,
            opacity: overlayOpacity,
          },
        ]}
      />

      <View style={s.particleContainer} pointerEvents="none">
        <ParticleCanvas particles={particles} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  particleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
});
