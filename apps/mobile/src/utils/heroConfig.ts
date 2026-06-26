export interface HeroLayer {
  id: string;
  assetName: string; // 'background', 'midground', 'foreground', etc.
  parallaxFactor: number; // 0 = no parallax, 1 = full tilt response
  opacity?: number;
  scale?: number;
}

export const HERO_LAYERS: HeroLayer[] = [
  { id: 'bg-sky', assetName: 'background', parallaxFactor: 0.1, opacity: 1 },
  { id: 'bg-mountains', assetName: 'midground-1', parallaxFactor: 0.3, opacity: 1 },
  { id: 'fg-trees', assetName: 'midground-2', parallaxFactor: 0.6, opacity: 1 },
  { id: 'fg-character', assetName: 'foreground', parallaxFactor: 0.9, opacity: 1 },
];

export const AMBIENT_SHIFT_CONFIG = {
  cycleDuration: 180000, // 3 minutes in ms
  gradientStops: [
    { offset: 0, color: '#FFA500' },    // dawn: warm orange
    { offset: 0.33, color: '#87CEEB' }, // day: light blue
    { offset: 0.66, color: '#FF6B35' }, // ember: warm red-orange
    { offset: 1, color: '#1a1a2e' },    // night: deep blue
  ],
};

export const PARTICLE_CONFIG = {
  count: 20,
  minVelocity: 0.1,
  maxVelocity: 0.5,
  lifetime: 8000, // ms
  size: 2,
  opacity: 0.3,
};

export const TILT_CALIBRATION = {
  maxTiltX: 15, // degrees
  maxTiltY: 15,
  smoothing: 0.1, // lerp factor
};
