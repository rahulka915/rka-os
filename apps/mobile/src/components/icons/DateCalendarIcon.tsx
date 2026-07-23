import { Image, type ImageStyle, type StyleProp } from 'react-native';

const dateCalendarArtwork = require('../../../assets/icons/secondary/date-calendar.png');

interface DateCalendarIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function DateCalendarIcon({ size = 32, style }: DateCalendarIconProps) {
  return (
    <Image
      source={dateCalendarArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
