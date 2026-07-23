import { Image, type StyleProp, type ImageStyle } from 'react-native';

const TIME_ICONS = {
  anytime: require('../../../assets/icons/time/time-anytime.png'),
  morning: require('../../../assets/icons/time/time-morning.png'),
  afternoon: require('../../../assets/icons/time/time-afternoon.png'),
  evening: require('../../../assets/icons/time/time-evening.png'),
  timeblocking: require('../../../assets/icons/time/time-timeblocking.png'),
} as const;

export type TimePeriod = keyof typeof TIME_ICONS;

interface TimeIconProps {
  period: TimePeriod;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

// Painted illustrations (cropped from the "Time of Day" reference sheet)
// replacing the old flat line icons — these already carry their own color
// and depth, so callers should NOT wrap them in a colored badge/tint the
// way the old line icons were.
export function TimeIcon({ period, size = 20, style }: TimeIconProps) {
  return (
    <Image
      source={TIME_ICONS[period]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
