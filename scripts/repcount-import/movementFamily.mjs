// scripts/repcount-import/movementFamily.mjs
// Ported copy of apps/mobile/src/utils/exerciseLibrary.ts's
// MOVEMENT_FAMILY_RULES/inferMovementFamily. Any future change to the app's
// classifier won't automatically propagate here — acceptable since this
// script is a one-time-use import tool, not a long-lived shared surface.

const MOVEMENT_FAMILY_RULES = [
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

export function inferMovementFamily(title) {
  return MOVEMENT_FAMILY_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'other';
}
