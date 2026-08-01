import type { Item } from '../db/types';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full-body' | 'cardio';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export interface ExerciseMeta {
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  imageKey?: string;
}

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full-body', 'cardio'];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  'full-body': 'Full Body',
  cardio: 'Cardio',
};

export const EQUIPMENT_OPTIONS: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};

const DEFAULT_META: ExerciseMeta = { muscleGroup: 'full-body' };

export function parseExerciseMeta(metadata?: string): ExerciseMeta {
  if (!metadata) return DEFAULT_META;
  try {
    const parsed = JSON.parse(metadata);
    const muscleGroup: MuscleGroup = MUSCLE_GROUPS.includes(parsed.muscleGroup) ? parsed.muscleGroup : 'full-body';
    const meta: ExerciseMeta = { muscleGroup };
    if (EQUIPMENT_OPTIONS.includes(parsed.equipment)) meta.equipment = parsed.equipment;
    if (typeof parsed.notes === 'string' && parsed.notes.trim()) meta.notes = parsed.notes;
    if (typeof parsed.imageKey === 'string' && parsed.imageKey.trim()) meta.imageKey = parsed.imageKey;
    return meta;
  } catch {
    return DEFAULT_META;
  }
}

export function formatExerciseSubtitle(meta: ExerciseMeta): string {
  const parts = [MUSCLE_GROUP_LABELS[meta.muscleGroup]];
  if (meta.equipment) parts.push(EQUIPMENT_LABELS[meta.equipment]);
  return parts.join(' · ');
}

export interface ExerciseGroup {
  muscleGroup: MuscleGroup;
  label: string;
  exercises: Item[];
}

export function groupExercisesByMuscle(exercises: Item[]): ExerciseGroup[] {
  const buckets = new Map<MuscleGroup, Item[]>(MUSCLE_GROUPS.map((mg) => [mg, []]));
  for (const exercise of exercises) {
    const meta = parseExerciseMeta(exercise.metadata);
    buckets.get(meta.muscleGroup)!.push(exercise);
  }
  return MUSCLE_GROUPS
    .map((muscleGroup) => ({
      muscleGroup,
      label: MUSCLE_GROUP_LABELS[muscleGroup],
      exercises: [...buckets.get(muscleGroup)!].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((group) => group.exercises.length > 0);
}

export function pickGroupThumbnailImageKey(group: ExerciseGroup): string | undefined {
  for (const exercise of group.exercises) {
    const imageKey = parseExerciseMeta(exercise.metadata).imageKey;
    if (imageKey) return imageKey;
  }
  return undefined;
}

export function filterExercisesByQuery(exercises: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return exercises;
  return exercises.filter((exercise) => exercise.title.toLowerCase().includes(q));
}
