import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

export type TimelinePaperVariant = 'A' | 'B' | 'C';
export type TimelinePaperMode = 'dark' | 'light';

interface TimelinePaperProps {
  variant: TimelinePaperVariant;
  mode: TimelinePaperMode;
  seed: string;
}

interface PaperProfile {
  base: string;
  raised: string;
  deep: string;
  fibre: string;
  grain: string;
  primaryInk: string;
  minuteInk: string;
  rule: string;
  ruleStrong: string;
  addInk: string;
  cloudOpacity: number;
  fibreOpacity: number;
  grainOpacity: number;
  textureOpacity: number;
  reliefOpacity: number;
  fibreCount: number;
  grainCount: number;
}

const PROFILES: Record<TimelinePaperVariant, Record<TimelinePaperMode, PaperProfile>> = {
  A: {
    light: {
      base: '#F2EBDD',
      raised: '#F7F1E6',
      deep: '#DED4C2',
      fibre: '#8E826F',
      grain: '#6E6457',
      primaryInk: 'rgba(63,58,50,0.78)',
      minuteInk: 'rgba(76,69,59,0.43)',
      rule: 'rgba(91,82,69,0.11)',
      ruleStrong: 'rgba(91,82,69,0.17)',
      addInk: 'rgba(69,64,56,0.58)',
      cloudOpacity: 0.022,
      fibreOpacity: 0.01,
      grainOpacity: 0.008,
      textureOpacity: 0.28,
      reliefOpacity: 0.026,
      fibreCount: 18,
      grainCount: 48,
    },
    dark: {
      base: '#181A1E',
      raised: '#22252A',
      deep: '#0F1114',
      fibre: '#A6A4A0',
      grain: '#8B8985',
      primaryInk: 'rgba(207,204,197,0.78)',
      minuteInk: 'rgba(166,166,170,0.36)',
      rule: 'rgba(144,144,150,0.075)',
      ruleStrong: 'rgba(144,144,150,0.13)',
      addInk: 'rgba(188,185,180,0.50)',
      cloudOpacity: 0.022,
      fibreOpacity: 0.011,
      grainOpacity: 0.008,
      textureOpacity: 0.34,
      reliefOpacity: 0.024,
      fibreCount: 20,
      grainCount: 54,
    },
  },
  B: {
    light: {
      base: '#EEE4D0',
      raised: '#F5EDDD',
      deep: '#D8CCB5',
      fibre: '#776B58',
      grain: '#655A4B',
      primaryInk: 'rgba(58,53,45,0.80)',
      minuteInk: 'rgba(72,65,54,0.45)',
      rule: 'rgba(86,75,60,0.12)',
      ruleStrong: 'rgba(86,75,60,0.19)',
      addInk: 'rgba(65,59,50,0.60)',
      cloudOpacity: 0.032,
      fibreOpacity: 0.046,
      grainOpacity: 0.023,
      textureOpacity: 0.56,
      reliefOpacity: 0.034,
      fibreCount: 34,
      grainCount: 64,
    },
    dark: {
      base: '#1C1A17',
      raised: '#28251F',
      deep: '#10110E',
      fibre: '#B8AB91',
      grain: '#D2C4A9',
      primaryInk: 'rgba(231,222,204,0.76)',
      minuteInk: 'rgba(218,207,187,0.36)',
      rule: 'rgba(232,219,195,0.08)',
      ruleStrong: 'rgba(232,219,195,0.14)',
      addInk: 'rgba(231,222,204,0.50)',
      cloudOpacity: 0.036,
      fibreOpacity: 0.052,
      grainOpacity: 0.027,
      textureOpacity: 0.66,
      reliefOpacity: 0.038,
      fibreCount: 38,
      grainCount: 72,
    },
  },
  C: {
    light: {
      base: '#F3EEE5',
      raised: '#F8F4EC',
      deep: '#E1DAD0',
      fibre: '#948A7D',
      grain: '#776E63',
      primaryInk: 'rgba(58,55,50,0.78)',
      minuteInk: 'rgba(69,65,59,0.41)',
      rule: 'rgba(77,72,65,0.095)',
      ruleStrong: 'rgba(77,72,65,0.15)',
      addInk: 'rgba(63,60,55,0.56)',
      cloudOpacity: 0.015,
      fibreOpacity: 0.014,
      grainOpacity: 0.012,
      textureOpacity: 0.28,
      reliefOpacity: 0.018,
      fibreCount: 10,
      grainCount: 34,
    },
    dark: {
      base: '#1A1A19',
      raised: '#222220',
      deep: '#111110',
      fibre: '#B9B4AA',
      grain: '#D0CAC0',
      primaryInk: 'rgba(226,222,214,0.74)',
      minuteInk: 'rgba(210,205,196,0.33)',
      rule: 'rgba(225,220,211,0.07)',
      ruleStrong: 'rgba(225,220,211,0.12)',
      addInk: 'rgba(226,222,214,0.47)',
      cloudOpacity: 0.018,
      fibreOpacity: 0.018,
      grainOpacity: 0.016,
      textureOpacity: 0.34,
      reliefOpacity: 0.02,
      fibreCount: 12,
      grainCount: 40,
    },
  },
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTimelinePaperPalette(
  variant: TimelinePaperVariant,
  mode: TimelinePaperMode,
) {
  return PROFILES[variant][mode];
}

function TimelinePaperComponent({ variant, mode, seed }: TimelinePaperProps) {
  const profile = getTimelinePaperPalette(variant, mode);
  const marks = useMemo(() => {
    const random = randomFrom(hashSeed(`${variant}-${mode}-${seed}`));
    const fibres = Array.from({ length: profile.fibreCount }, (_, index) => {
      const x = random() * 390;
      const y = random() * 1500;
      const length = 22 + random() * 50;
      const drift = (random() - 0.5) * 18;
      return {
        id: `f-${index}`,
        path: `M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + length * 0.45).toFixed(1)} ${(y + drift).toFixed(1)} ${(x + length).toFixed(1)} ${(y + drift * 0.35).toFixed(1)}`,
        width: 0.35 + random() * 0.45,
        opacity: 0.55 + random() * 0.45,
      };
    });
    const grain = Array.from({ length: profile.grainCount }, (_, index) => ({
      id: `g-${index}`,
      x: random() * 390,
      y: random() * 1500,
      radius: 0.35 + random() * 0.9,
      opacity: 0.45 + random() * 0.55,
    }));
    return { fibres, grain };
  }, [mode, profile.fibreCount, profile.grainCount, seed, variant]);

  const id = `${variant}-${mode}-${hashSeed(seed)}`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: profile.base }]}>
      <Image
        source={
          mode === 'dark'
            ? require('../../../assets/textures/timeline-paper-dark.png')
            : require('../../../assets/textures/timeline-paper-light.png')
        }
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity: profile.textureOpacity }]}
      />
      <Svg width="100%" height="100%" viewBox="0 0 390 1500" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`cloud-${id}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={profile.raised} stopOpacity="1" />
            <Stop offset="1" stopColor={profile.raised} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`relief-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={profile.raised} stopOpacity="1" />
            <Stop offset="0.48" stopColor={profile.raised} stopOpacity="0" />
            <Stop offset="1" stopColor={profile.deep} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        <Ellipse cx="82" cy="210" rx="155" ry="250" fill={`url(#cloud-${id})`} opacity={profile.cloudOpacity} />
        <Ellipse cx="326" cy="720" rx="205" ry="310" fill={`url(#cloud-${id})`} opacity={profile.cloudOpacity * 0.82} />
        <Ellipse cx="112" cy="1280" rx="188" ry="230" fill={`url(#cloud-${id})`} opacity={profile.cloudOpacity * 0.68} />

        {marks.fibres.map((fibre) => (
          <Path
            key={fibre.id}
            d={fibre.path}
            fill="none"
            stroke={profile.fibre}
            strokeWidth={fibre.width}
            strokeLinecap="round"
            opacity={profile.fibreOpacity * fibre.opacity}
          />
        ))}

        {marks.grain.map((grain) => (
          <Circle
            key={grain.id}
            cx={grain.x}
            cy={grain.y}
            r={grain.radius}
            fill={profile.grain}
            opacity={profile.grainOpacity * grain.opacity}
          />
        ))}

        <Rect
          x="0"
          y="0"
          width="390"
          height="1500"
          fill={`url(#relief-${id})`}
          opacity={profile.reliefOpacity}
        />
      </Svg>
    </View>
  );
}

export const TimelinePaper = memo(TimelinePaperComponent);
