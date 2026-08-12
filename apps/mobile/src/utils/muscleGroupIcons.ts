import type { ImageSourcePropType } from 'react-native';
import type { MuscleGroup } from './exerciseLibrary';

// Dedicated muscle-group destination artwork (anatomical 3D figure with the
// worked region highlighted), used by the Exercise Library's group cards on
// both native and web. Shared here so the two targets never drift.
//
// The art set also ships calves/glutes/hamstrings variants (and a flat `gold/`
// variant alongside `3d/`) under assets/icons/muscle-groups/ for when the
// MUSCLE_GROUPS taxonomy grows or a flatter treatment is wanted; only the
// current eight MUSCLE_GROUPS are mapped. `cardio` has no dedicated figure, so
// it reuses the full-body art.
const MUSCLE_GROUP_ICONS: Record<MuscleGroup, ImageSourcePropType> = {
  chest: require('../../assets/icons/muscle-groups/3d/chest.png'),
  back: require('../../assets/icons/muscle-groups/3d/back.png'),
  shoulders: require('../../assets/icons/muscle-groups/3d/shoulders.png'),
  arms: require('../../assets/icons/muscle-groups/3d/arms.png'),
  legs: require('../../assets/icons/muscle-groups/3d/legs.png'),
  core: require('../../assets/icons/muscle-groups/3d/core.png'),
  'full-body': require('../../assets/icons/muscle-groups/3d/full-body.png'),
  cardio: require('../../assets/icons/muscle-groups/3d/full-body.png'),
};

export function getMuscleGroupIcon(group: MuscleGroup): ImageSourcePropType {
  return MUSCLE_GROUP_ICONS[group] ?? MUSCLE_GROUP_ICONS['full-body'];
}
