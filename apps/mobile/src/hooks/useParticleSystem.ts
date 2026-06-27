import { useState, useEffect } from 'react';
import { Animated, Dimensions } from 'react-native';
import { PARTICLE_CONFIG } from '../utils/heroConfig';

export interface Particle {
  id: string;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  lifetime: number; // ms
  createdAt: number;
}

export function useParticleSystem() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const { height } = Dimensions.get('window');

  useEffect(() => {
    const interval = setInterval(() => {
      const newParticle: Particle = {
        id: `particle-${Date.now()}-${Math.random()}`,
        x: new Animated.Value(Math.random() * 400),
        y: new Animated.Value(height),
        opacity: new Animated.Value(PARTICLE_CONFIG.opacity),
        lifetime: PARTICLE_CONFIG.lifetime,
        createdAt: Date.now(),
      };

      // Animate particle upward and fade out
      const duration = PARTICLE_CONFIG.lifetime;
      Animated.parallel([
        Animated.timing(newParticle.y, {
          toValue: -50,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(newParticle.opacity, {
          toValue: 0,
          duration,
          useNativeDriver: false,
        }),
      ]).start();

      setParticles((prev) => [...prev, newParticle]);

      // Remove particle after lifetime expires
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
      }, duration);
    }, 500); // Spawn particle every 500ms

    return () => clearInterval(interval);
  }, [height]);

  return particles;
}
