import { Image, type ImageStyle, type StyleProp } from 'react-native';

const workoutArtwork = require('../../../assets/icons/collections/workout-kettlebell.png');
const habitArtwork = require('../../../assets/icons/collections/habit-prayer-beads.png');
const toGetArtwork = require('../../../assets/icons/collections/to-get-furoshiki.png');
const archiveArtwork = require('../../../assets/icons/collections/archive-scroll-chest.png');

interface CollectionIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

function CollectionArtwork({ source, size, style }: CollectionIconProps & { source: number }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}

export function WorkoutTrainingIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={workoutArtwork} size={size} style={style} />;
}

export function HabitRitualIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={habitArtwork} size={size} style={style} />;
}

export function ToGetParcelIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={toGetArtwork} size={size} style={style} />;
}

export function ArchiveScrollChestIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={archiveArtwork} size={size} style={style} />;
}
