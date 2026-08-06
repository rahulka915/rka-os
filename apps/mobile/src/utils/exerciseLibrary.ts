import type { Item } from '../db/types';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full-body' | 'cardio';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export const MOVEMENT_FAMILY_LABELS = {
  'push-up': 'Push-Up',
  'chest-press': 'Chest Press',
  'chest-fly': 'Chest Fly',
  dip: 'Dip',
  pullover: 'Pullover',
  row: 'Row',
  'inverted-row': 'Inverted Row',
  'renegade-row': 'Renegade Row',
  'pull-up': 'Pull-Up / Chin-Up',
  'lat-pulldown': 'Lat Pulldown',
  'face-pull': 'Face Pull / Rear Delt Fly',
  shrug: 'Shrug',
  'biceps-curl': 'Biceps Curl',
  'wrist-curl': 'Wrist Curl',
  'wrist-mobility': 'Wrist Mobility',
  'triceps-pushdown': 'Triceps Pushdown',
  'triceps-kickback': 'Triceps Kickback',
  'triceps-extension': 'Triceps Extension',
  deadlift: 'Deadlift / Rack Pull',
  squat: 'Squat',
  lunge: 'Lunge',
  'good-morning': 'Good Morning',
  'back-extension': 'Back Extension',
  plank: 'Plank',
  'bird-dog': 'Bird Dog',
  burpee: 'Burpee',
  'crab-walk': 'Crab Walk',
  'chest-stretch': 'Chest Stretch',
  'triceps-stretch': 'Triceps Stretch',
  'forearm-stretch': 'Forearm Stretch',
  mobility: 'Mobility',
  'arm-bar': 'Arm Bar',
} as const;

export type MovementFamily = keyof typeof MOVEMENT_FAMILY_LABELS;

const MOVEMENT_FAMILY_RULES: Array<[MovementFamily, RegExp]> = [
  ['chest-stretch', /chest stretch/i],
  ['triceps-stretch', /triceps stretch/i],
  ['forearm-stretch', /forearm stretch/i],
  ['arm-bar', /arm bar/i],
  ['mobility', /childs pose|arm swings/i],
  ['renegade-row', /renegade row/i],
  ['inverted-row', /inverted row/i],
  ['face-pull', /face pull|reverse fly|rear delt fly/i],
  ['lat-pulldown', /lat pulldown/i],
  ['pull-up', /pull up|pull ups|chin up/i],
  ['triceps-pushdown', /tricep pushdown|triceps pushdown/i],
  ['triceps-kickback', /tricep kickback/i],
  ['wrist-curl', /wrist curl|finger curl/i],
  ['wrist-mobility', /^wrist$|wrist twist|wrist adduction/i],
  ['lunge', /lunge/i],
  ['biceps-curl', /curl/i],
  ['triceps-extension', /tricep|triceps|skull crusher|seated cable extension/i],
  ['push-up', /push up|push ups/i],
  ['chest-press', /bench press|chest press|incline machine press|close grip press|floor press|svend press|tate press/i],
  ['chest-fly', /fly|crossover/i],
  ['dip', /\bdip\b|\bdips\b/i],
  ['pullover', /pullover/i],
  ['row', /\brow\b|\brows\b/i],
  ['shrug', /shrug/i],
  ['deadlift', /deadlift|rack pull/i],
  ['squat', /squat/i],
  ['good-morning', /good morning/i],
  ['back-extension', /hyper extension/i],
  ['plank', /plank/i],
  ['bird-dog', /bird dog/i],
  ['burpee', /burpees?/i],
  ['crab-walk', /crab walk/i],
];

export function inferMovementFamily(title: string): MovementFamily | 'other' {
  return MOVEMENT_FAMILY_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'other';
}

export interface ExerciseMeta {
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  movementFamily?: MovementFamily;
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
    if (typeof parsed.movementFamily === 'string' && parsed.movementFamily in MOVEMENT_FAMILY_LABELS) {
      meta.movementFamily = parsed.movementFamily as MovementFamily;
    }
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

export interface MovementFamilyGroup {
  movementFamily: MovementFamily | 'other';
  label: string;
  exercises: Item[];
}

export function getExerciseMovementFamily(exercise: Pick<Item, 'title' | 'metadata'>): MovementFamily | 'other' {
  return parseExerciseMeta(exercise.metadata).movementFamily ?? inferMovementFamily(exercise.title);
}

export function groupExercisesByMovementFamily(exercises: Item[]): MovementFamilyGroup[] {
  const buckets = new Map<MovementFamily | 'other', Item[]>();
  for (const exercise of exercises) {
    const family = getExerciseMovementFamily(exercise);
    const bucket = buckets.get(family);
    if (bucket) bucket.push(exercise);
    else buckets.set(family, [exercise]);
  }
  return [...buckets.entries()]
    .map(([movementFamily, items]) => ({
      movementFamily,
      label: movementFamily === 'other' ? 'Other' : MOVEMENT_FAMILY_LABELS[movementFamily],
      exercises: [...items].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
  return exercises.filter((exercise) => {
    if (exercise.title.toLowerCase().includes(q)) return true;
    const family = getExerciseMovementFamily(exercise);
    return family !== 'other' && MOVEMENT_FAMILY_LABELS[family].toLowerCase().includes(q);
  });
}
