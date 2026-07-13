import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

interface TimeBlockIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// River stone silhouette — the "anytime" motif, echoing the same calm/neutral
// association as ZenGardenIcon's stone rather than a generic clock face.
export function StoneIcon({ size = 13, color = '#6E6E6E', strokeWidth = 1.6 }: TimeBlockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse cx={12} cy={14} rx={9} ry={6} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M6 12 Q9 9 12 12 Q15 9 18 12" stroke={color} strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
    </Svg>
  );
}

// Sunrise disc with rays — the "morning" motif, distinct from the sundial
// used on the Calendar dock icon but sharing its ritual-gold color family.
export function SunriseIcon({ size = 13, color = '#E0A73D', strokeWidth = 1.6 }: TimeBlockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 3v3M12 18v3M4 12H1M23 12h-3M6 6l-2-2M20 6l-2-2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Folded paper fan (uchiwa) silhouette — the "afternoon" motif.
export function FanIcon({ size = 13, color = '#D65A2E', strokeWidth = 1.6 }: TimeBlockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21V4M4 20c2-6 6-9 8-9s6 3 8 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// Crescent moon with a single star — the "evening" motif.
export function MoonStarIcon({ size = 13, color = '#2A2A72', strokeWidth = 1.6 }: TimeBlockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 13.5A7 7 0 0 1 9.5 6a7 7 0 1 0 7.5 7.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M19 4l0.6 1.4L21 6l-1.4 0.6L19 8l-0.6-1.4L17 6l1.4-0.6Z" fill={color} />
    </Svg>
  );
}
