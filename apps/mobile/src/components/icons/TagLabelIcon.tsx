import { Image, type ImageStyle, type StyleProp } from 'react-native';

const tagLabelArtwork = require('../../../assets/icons/secondary/tag-label.png');

interface TagLabelIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function TagLabelIcon({ size = 32, style }: TagLabelIconProps) {
  return (
    <Image
      source={tagLabelArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
