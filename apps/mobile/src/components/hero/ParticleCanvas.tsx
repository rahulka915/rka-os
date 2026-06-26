import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Particle } from '../../hooks/useParticleSystem';
import { PARTICLE_CONFIG } from '../../utils/heroConfig';

interface Props {
  particles: Particle[];
}

export function ParticleCanvas({ particles }: Props) {
  return (
    <>
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            s.particle,
            {
              left: particle.x,
              top: particle.y,
              opacity: particle.opacity,
            },
          ]}
        />
      ))}
    </>
  );
}

const s = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: PARTICLE_CONFIG.size,
    height: PARTICLE_CONFIG.size,
    borderRadius: PARTICLE_CONFIG.size / 2,
    backgroundColor: '#fff',
  },
});
