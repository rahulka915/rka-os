// scripts/repcount-import/musclegroups.mjs
// Mirrors apps/mobile/src/utils/exerciseLibrary.ts's MuscleGroup union so
// imported exercises are classified the same way the app classifies its own.
// Kept as a manual copy (see movementFamily.mjs) since this script can't
// import across the apps/mobile module boundary.

const CATEGORY_TO_MUSCLE_GROUP = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  arms: 'arms',
  forearms: 'arms',
  legs: 'legs',
  quads: 'legs',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abs: 'core',
  core: 'core',
  cardio: 'cardio',
  'full body': 'full-body',
  'full-body': 'full-body',
};

export function mapCategoryToMuscleGroup(category) {
  if (!category) return 'full-body';
  const key = category.trim().toLowerCase();
  return CATEGORY_TO_MUSCLE_GROUP[key] ?? 'full-body';
}
