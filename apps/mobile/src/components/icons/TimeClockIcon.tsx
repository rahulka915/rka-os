import { Image, type ImageStyle, type StyleProp } from 'react-native';

const timeClockArtwork = require('../../../assets/icons/secondary/time-clock.png');

interface TimeClockIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function TimeClockIcon({ size = 32, style }: TimeClockIconProps) {
  return (
    <Image
      source={timeClockArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
