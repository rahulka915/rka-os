import { Image, type ImageStyle, type StyleProp } from 'react-native';

const areaBonsaiArtwork = require('../../../assets/icons/area-bonsai.png');

interface AreaBonsaiIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

export function AreaBonsaiIcon({ size = 24, style }: AreaBonsaiIconProps) {
  return (
    <Image
      source={areaBonsaiArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
