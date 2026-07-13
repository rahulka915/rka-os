import Svg, { Path, Rect } from 'react-native-svg';

interface ScrollIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Rolled hanging-scroll silhouette — capped rod ends top and bottom, a tie
// band across the middle reading "closed/unopened". Matches the copy used
// on InboxScrollCard ("N unopened scrolls") rather than a generic inbox
// tray icon that had no actual scroll motif.
export function ScrollIcon({ size = 18, color = '#2b7ff0', strokeWidth = 1.6 }: ScrollIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={2} width={6} height={2.2} rx={1.1} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={9} y={19.8} width={6} height={2.2} rx={1.1} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M10 4.2v15.6M14 4.2v15.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8.5 10.5h7" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}
