import { Image, type ImageStyle, type StyleProp } from 'react-native';

const workoutArtwork = require('../../../assets/icons/domains/collection-workouts-dumbbell.png');
const habitArtwork = require('../../../assets/icons/domains/collection-habits-repeat.png');
const toGetArtwork = require('../../../assets/icons/domains/collection-to-get-shopping-trolley.png');
const archiveArtwork = require('../../../assets/icons/collections/archive-scroll-chest.png');
const routineStepsArtwork = require('../../../assets/icons/domains/collection-routines-stone-ring.png');
const skillsNodesArtwork = require('../../../assets/icons/domains/collection-skills-skill-tree.png');
const potentialCoreArtwork = require('../../../assets/icons/collections/potential-core.png');
const achievementMedalArtwork = require('../../../assets/icons/collections/achievement-medal.png');

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

export function RoutineStepsArtworkIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={routineStepsArtwork} size={size} style={style} />;
}

export function SkillsNodesArtworkIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={skillsNodesArtwork} size={size} style={style} />;
}

export function PotentialCoreArtworkIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={potentialCoreArtwork} size={size} style={style} />;
}

export function AchievementMedalArtworkIcon({ size = 28, style }: CollectionIconProps) {
  return <CollectionArtwork source={achievementMedalArtwork} size={size} style={style} />;
}
