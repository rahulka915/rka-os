import { Image, type ImageStyle, type StyleProp } from 'react-native';

const taskNoteArtwork = require('../../../assets/icons/domains/collection-tasks-clipboard.png');

interface TaskNoteIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

export function TaskNoteIcon({ size = 24, style }: TaskNoteIconProps) {
  return (
    <Image
      source={taskNoteArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
