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

// A secondary muscle-group assignment: the group itself plus an optional
// free-text sub-region label (e.g. "long head", "upper"). The label is
// descriptive only — it never creates a new bucket in the Muscle Balance
// chart, which stays at the 8 MUSCLE_GROUPS regardless of how much detail an
// exercise records.
export interface MuscleGroupAssignment {
  group: MuscleGroup;
  detail?: string;
}

export interface ExerciseMeta {
  muscleGroup: MuscleGroup; // primary group — unchanged field/semantics, full back-compat with every existing exercise
  muscleGroupDetail?: string; // optional sub-region label on the primary group
  secondaryMuscleGroups?: MuscleGroupAssignment[]; // zero or more secondary groups; absent/empty = single-primary, unchanged behavior
  equipment?: Equipment;
  movementFamily?: MovementFamily;
  notes?: string;
  imageKey?: string;
}

// Primary gets the larger, fixed share of a set's volume; any secondary
// groups split the remainder evenly. An exercise with no secondaries (the
// default for every existing/imported exercise) is unaffected — primary
// gets the full 1.0 weight, identical to today's single-muscle-group
// behavior.
const PRIMARY_VOLUME_WEIGHT = 0.7;

export interface MuscleGroupWeight {
  group: MuscleGroup;
  weight: number;
}

export function getMuscleGroupWeights(meta: ExerciseMeta): MuscleGroupWeight[] {
  const secondaries = meta.secondaryMuscleGroups ?? [];
  if (secondaries.length === 0) return [{ group: meta.muscleGroup, weight: 1 }];
  const secondaryWeight = (1 - PRIMARY_VOLUME_WEIGHT) / secondaries.length;
  return [
    { group: meta.muscleGroup, weight: PRIMARY_VOLUME_WEIGHT },
    ...secondaries.map((s) => ({ group: s.group, weight: secondaryWeight })),
  ];
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
    if (typeof parsed.muscleGroupDetail === 'string' && parsed.muscleGroupDetail.trim()) {
      meta.muscleGroupDetail = parsed.muscleGroupDetail.trim();
    }
    if (Array.isArray(parsed.secondaryMuscleGroups)) {
      const secondaries: MuscleGroupAssignment[] = parsed.secondaryMuscleGroups
        .filter((s: unknown): s is { group: unknown; detail?: unknown } => typeof s === 'object' && s !== null)
        .filter((s: { group: unknown }) => MUSCLE_GROUPS.includes(s.group as MuscleGroup) && s.group !== muscleGroup)
        .map((s: { group: unknown; detail?: unknown }) => ({
          group: s.group as MuscleGroup,
          ...(typeof s.detail === 'string' && s.detail.trim() ? { detail: s.detail.trim() } : {}),
        }));
      if (secondaries.length > 0) meta.secondaryMuscleGroups = secondaries;
    }
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
  const primaryLabel = meta.muscleGroupDetail
    ? `${MUSCLE_GROUP_LABELS[meta.muscleGroup]} (${meta.muscleGroupDetail})`
    : MUSCLE_GROUP_LABELS[meta.muscleGroup];
  const parts = [primaryLabel];
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
