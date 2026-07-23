import { Image, type ImageStyle, type StyleProp } from 'react-native';

const medicationBottleArtwork = require('../../../assets/icons/medication/medication-bottle.png');

interface MedicationBottleIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

export function MedicationBottleIcon({
  size = 24,
  style,
}: MedicationBottleIconProps) {
  return (
    <Image
      source={medicationBottleArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
