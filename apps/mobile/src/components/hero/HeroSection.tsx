import React from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { useParallaxLayers } from '../../hooks/useParallaxLayers';
import { useAmbientShift } from '../../hooks/useAmbientShift';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import { HeroLayer } from './HeroLayer';
import { ParticleCanvas } from './ParticleCanvas';
import { HERO_LAYERS } from '../../utils/heroConfig';

interface Props {
  timeOfDay: 'dawn' | 'day' | 'ember' | 'night';
}

export function HeroSection({ timeOfDay }: Props) {
  const { width, height } = Dimensions.get('window');
  const { tiltX, tiltY } = useParallaxLayers();
  const { overlayOpacity, gradientOffset } = useAmbientShift();
  const particles = useParticleSystem();

  // Map time-of-day to asset set
  const assetMap: Record<string, any> = {
    dawn: require('../../../assets/hero-dawn.png'),
    day: require('../../../assets/hero-day.png'),
    ember: require('../../../assets/hero-ember.png'),
    night: require('../../../assets/hero-night.png'),
  };

  // For now, use single composite asset. Later, split into layers.
  const heroAsset = assetMap[timeOfDay];

  // Interpolate gradient based on ambient cycle
  const backgroundColor = gradientOffset.interpolate({
    inputRange: [0, 1],
    outputRange: ['#87CEEB', '#FF6B35'], // day blue → ember orange (simplified)
  });

  return (
    <View style={[s.container, { width, height }]}>
      {/* Background gradient overlay */}
      <Animated.View
        style={[
          s.overlay,
          {
            backgroundColor,
            opacity: overlayOpacity,
          },
        ]}
      />

      {/* Hero layers with parallax */}
      {HERO_LAYERS.map((layer) => (
        <HeroLayer
          key={layer.id}
          layer={layer}
          source={heroAsset}
          parallaxX={tiltX}
          parallaxY={tiltY}
          width={width}
          height={height}
        />
      ))}

      {/* Particles */}
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
