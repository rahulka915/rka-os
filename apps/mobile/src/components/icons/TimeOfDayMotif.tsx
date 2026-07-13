import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { RoninTimeOfDay } from '../../domain/ronin/types';

interface TimeOfDayMotifProps {
  timeOfDay: RoninTimeOfDay;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// Corner decoration for RoninGreetingCard, tied to the same RoninTimeOfDay
// value driving the greeting text and gradient tint — a sun with rays for
// morning, a plain high-sun disc for day, a crescent + stars for night.
// Always rendered in a single low-opacity color (passed in), since it sits
// on top of a gradient rather than a flat theme surface.
export function TimeOfDayMotif({ timeOfDay, size = 140, color = 'rgba(255,255,255,0.12)', style }: TimeOfDayMotifProps) {
  if (timeOfDay === 'morning') {
    return (
      <Svg width={size} height={size * 0.86} viewBox="0 0 140 120" style={style}>
        <Circle cx={95} cy={70} r={26} fill={color} />
        <Line x1={95} y1={20} x2={95} y2={8} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <Line x1={140} y1={70} x2={128} y2={70} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <Line x1={130} y1={30} x2={122} y2={38} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={30} x2={68} y2={38} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    );
  }

  if (timeOfDay === 'day') {
    return (
      <Svg width={size} height={size * 0.86} viewBox="0 0 140 120" style={style}>
        <Circle cx={95} cy={60} r={30} fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size * 0.86} viewBox="0 0 140 120" style={style}>
      <Path d="M110 30 A 40 40 0 1 0 108 100 A 32 32 0 1 1 110 30 Z" fill={color} />
      <Circle cx={55} cy={35} r={2.4} fill={color} />
      <Circle cx={45} cy={55} r={1.6} fill={color} />
    </Svg>
  );
}
