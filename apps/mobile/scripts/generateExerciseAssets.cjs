// One-off codegen: reads assets/exercises/*.png and writes
// src/utils/exerciseImages.ts (static require() registry) and
// src/utils/starterExercises.ts (full starter catalog with inferred
// title/muscleGroup/equipment/imageKey). Re-run after adding new PNGs
// to assets/exercises/ and commit the regenerated output.
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../assets/exercises');
const IMAGES_OUT = path.join(__dirname, '../src/utils/exerciseImages.ts');
const STARTERS_OUT = path.join(__dirname, '../src/utils/starterExercises.ts');

const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.png')).sort();

function splitPascal(stem) {
  // Two-pass acronym-aware split: lower/digit->upper boundaries first (most
  // filenames), then "run of capitals followed by a new capitalized word"
  // (e.g. "TRXCloseGripPushUps" -> "TRX Close Grip Push Ups", not
  // "T R X Close Grip Push Ups").
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Vocabulary harvested from filenames that already split cleanly (have
// internal capitals) — reused to segment the ~20% of filenames that are
// all-lowercase and would otherwise produce one unreadable run-on word.
const vocab = new Set();
for (const file of files) {
  const stem = file.replace(/\.png$/i, '');
  const words = splitPascal(stem);
  if (words.length > 1) {
    for (const w of words) vocab.add(w.toLowerCase());
  }
}

// Supplement words the harvested vocabulary doesn't cover (validated by
// running this script and checking no filename still produces a single
// run-on word longer than 12 characters).
const SUPPLEMENT_VOCAB = [
  'biceps', 'triceps', 'good', 'morning', 'face', 'shrug', 'skull', 'crusher',
  'hyper', 'extension', 'cross', 'body', 'concentration', 'pseudo', 'planche',
  'push', 'up', 'rear', 'delt', 'rope', 'straight', 'arm', 'sumo', 'wrist',
  'adduction', 'lat', 'pulldown', 'seated', 'deadlift', 'renegade', 'rows', 'trap',
];
for (const w of SUPPLEMENT_VOCAB) vocab.add(w);

function segmentWords(s, vocabSet) {
  const n = s.length;
  const dp = new Array(n + 1).fill(null);
  const wordCount = new Array(n + 1).fill(Infinity);
  wordCount[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < i; j++) {
      const sub = s.slice(j, i);
      if (sub.length >= 2 && vocabSet.has(sub) && wordCount[j] + 1 < wordCount[i]) {
        wordCount[i] = wordCount[j] + 1;
        dp[i] = j;
      }
    }
  }
  if (wordCount[n] === Infinity) return null;
  const words = [];
  let i = n;
  while (i > 0) {
    const j = dp[i];
    words.unshift(s.slice(j, i));
    i = j;
  }
  return words;
}

function capitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function formatTitle(file) {
  // Title formatting strips "final"/"image"/"img" filename suffixes (a few
  // source files have them, e.g. "CableSeatedRowimage.png"); imageKey below
  // uses the *raw* stem unchanged so it still matches the real filename.
  const rawStem = file.replace(/\.png$/i, '');
  const cleanedStem = rawStem.replace(/final/gi, '').replace(/image/gi, '').replace(/img/gi, '');
  let words = splitPascal(cleanedStem);
  if (words.length === 1) {
    const seg = segmentWords(cleanedStem.toLowerCase(), vocab);
    if (seg) words = seg;
  }
  return words.map(capitalize).join(' ');
}

function inferEquipment(stem) {
  const n = stem.toLowerCase();
  if (n.includes('dumbbell')) return 'dumbbell';
  if (n.includes('barbell') || n.includes('ezbar') || n.includes('smith')) return 'barbell';
  if (n.includes('cable')) return 'cable';
  if (n.includes('machine')) return 'machine';
  if (n.includes('band')) return 'band';
  if (n.includes('kettlebell')) return 'kettlebell';
  return 'bodyweight';
}

function inferMuscleGroup(stem) {
  const n = stem.toLowerCase();
  if (n.includes('goodmorning') || n.includes('sumo')) return 'legs';
  if ((n.includes('curl') && !n.includes('leg') && !n.includes('wrist')) || n.includes('tricep') || n.includes('bicep') || n.includes('skull') || n.includes('wrist') || n.includes('forearm')) return 'arms';
  if (n.includes('chest')) return 'chest';
  if ((n.includes('push') || n.includes('press') || n.includes('dip') || n.includes('fly')) && !n.includes('leg') && !n.includes('shoulder') && !n.includes('overhead') && !n.includes('delt')) return 'chest';
  if (n.includes('shoulder') || n.includes('delt') || n.includes('raise') || n.includes('shrug') || n.includes('overhead')) return 'shoulders';
  if (n.includes('row') || n.includes('pull') || n.includes('chin') || n.includes('lat')) return 'back';
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('calf') || n.includes('deadlift')) return 'legs';
  if (n.includes('plank') || n.includes('core') || n.includes('abs') || n.includes('bird') || n.includes('adduction') || n.includes('hyperextension')) return 'core';
  return 'full-body';
}

const entries = files.map((file) => {
  const stem = file.replace(/\.png$/i, '');
  return {
    file,
    imageKey: stem,
    title: formatTitle(file),
    equipment: inferEquipment(stem),
    muscleGroup: inferMuscleGroup(stem),
  };
});

// Sanity checks — fail loudly rather than silently emit bad data. A
// single-word title is usually a sign segmentation failed to fully break up
// a run-on filename; a few titles are legitimately one word, so those are
// allowlisted explicitly rather than filtered by a length threshold (a
// length threshold previously let two real bugs slip through at exactly the
// cutoff length).
const ALLOWED_SINGLE_WORD_TITLES = new Set(['Burpees', 'Wrist']);
const uglyTitles = entries.filter((e) => !e.title.includes(' ') && !ALLOWED_SINGLE_WORD_TITLES.has(e.title));
if (uglyTitles.length > 0) {
  console.error('Un-segmented titles (add words to SUPPLEMENT_VOCAB, or allowlist if legitimate):', uglyTitles.map((e) => `${e.file} -> ${e.title}`));
  process.exit(1);
}
const dupeTitles = entries.map((e) => e.title).filter((t, i, arr) => arr.indexOf(t) !== i);
if (dupeTitles.length > 0) {
  console.error('Duplicate titles:', dupeTitles);
  process.exit(1);
}

// --- Write src/utils/exerciseImages.ts ---
const imagesSorted = [...entries].sort((a, b) => a.imageKey.localeCompare(b.imageKey));
const imagesBody = imagesSorted
  .map((e) => `  '${e.imageKey}': require('../../assets/exercises/${e.file}'),`)
  .join('\n');
const imagesFile = `import type { ImageSourcePropType } from 'react-native';

// Generated by scripts/generateExerciseAssets.cjs — do not hand-edit.
// Static require() registry: Metro cannot resolve a dynamically-computed
// require() path, so every bundled exercise image needs a literal entry
// here (same pattern as src/domain/ronin/roninAssets.ts).
export const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
${imagesBody}
};
`;
fs.writeFileSync(IMAGES_OUT, imagesFile);

// --- Write src/utils/starterExercises.ts ---
const startersSorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));
const startersBody = startersSorted
  .map((e) => `  { title: '${e.title.replace(/'/g, "\\'")}', muscleGroup: '${e.muscleGroup}', equipment: '${e.equipment}', imageKey: '${e.imageKey}' },`)
  .join('\n');
const startersFile = `import type { MuscleGroup, Equipment } from './exerciseLibrary';

export interface StarterExercise {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  imageKey?: string;
}

// Generated by scripts/generateExerciseAssets.cjs from assets/exercises/ —
// do not hand-edit; re-run the script after adding new images.
export const STARTER_EXERCISES: StarterExercise[] = [
${startersBody}
];
`;
fs.writeFileSync(STARTERS_OUT, startersFile);

console.log(`Wrote ${entries.length} entries to ${path.relative(process.cwd(), IMAGES_OUT)} and ${path.relative(process.cwd(), STARTERS_OUT)}`);
