import { Image, type ImageStyle, type StyleProp } from 'react-native';

const settingsMedallionArtwork = require('../../../assets/icons/header-v2/settings.png');

interface SettingsMedallionIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function SettingsMedallionIcon({ size = 36, style }: SettingsMedallionIconProps) {
  return (
    <Image
      source={settingsMedallionArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
