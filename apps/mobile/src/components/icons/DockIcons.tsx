import Svg, { Circle, Path } from 'react-native-svg';

interface DockIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Custom dock icon set, handed off from a design session (see
// ~/.codex/visualizations/.../RKA_OS_ICON_MOCKUP_HANDOFF.md). Approved
// direction: simple standard-navigation-icon silhouettes carrying the
// Moonly/Ronin section personality through color, not through illustration
// detail. Each of these renders at 22-30pt like any other nav icon — they
// are not miniature illustrations.

export function TorriHomeIcon({ size = 22, color = '#C44545', strokeWidth = 1.8 }: DockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6c4 1 14 1 18 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 9c3 .7 11 .7 14 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 9v11M18 9v11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 10v10M15 10v10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={0.42} />
    </Svg>
  );
}

export function SunDialCalendarIcon({ size = 22, color = '#D4B078', strokeWidth = 1.7 }: DockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={6.2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 12V8.7M12 12l2.8 1.7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LayersMoreIcon({ size = 22, color = '#4E9E86', strokeWidth = 1.7 }: DockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h13v13H5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 4h12v13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 10h7M8 13h5M8 16h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PersonalSealMeIcon({ size = 22, color = '#2b7ff0', strokeWidth = 1.7 }: DockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2 18.5 7v5.4c0 4.1-2.5 6.7-6.5 8.5-4-1.8-6.5-4.4-6.5-8.5V7Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={2.1} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8.7 16c.7-2 1.8-3 3.3-3s2.6 1 3.3 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Calligraphy brush for the Create FAB. Body/bristle color is themeable
// (white on the blue FAB); the small ferrule accent stays the fixed lacquer
// red from the approved asset — "refined, not reimagined," no new color
// decisions on top of the handoff.
export function CalligraphyBrushIcon({ size = 22, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m10.5 10.5 8-8a2.3 2.3 0 0 1 3.2 0 2.3 2.3 0 0 1 0 3.2l-8 8Z" fill={color} />
      <Path d="m8 15.6 3.2-5.1 3 3-5.1 3.2Z" fill={color} />
      <Path d="m9 15.1 2.3-3.7 1.5 1.5-3.7 2.3Z" fill="#C44545" />
      <Path d="M8.1 15.3c-1.5-.4-3 .2-3.9 1.5-.9 1.3-1.1 3.1-.9 4.7 1.7-.1 3.6-.6 4.9-1.6 1.1-.9 1.7-2 1.6-3.1-.1-.8-.6-1.2-1.7-1.5Z" fill={color} />
    </Svg>
  );
}
