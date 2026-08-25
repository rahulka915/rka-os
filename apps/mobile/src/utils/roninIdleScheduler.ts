export type RoninIdleClip =
  | 'lookAround'
  | 'blinkDip'
  | 'yawn'
  | 'adjustWrap'
  | 'shoulderStretch';

const MIN_IDLE_DELAY_MS = 8_000;
const MAX_IDLE_DELAY_MS = 18_000;

const IDLE_CLIP_WEIGHTS: ReadonlyArray<readonly [RoninIdleClip, number]> = [
  ['lookAround', 3],
  ['blinkDip', 3],
  ['adjustWrap', 3],
  ['yawn', 1],
  ['shoulderStretch', 1],
];

export function nextIdleDelayMs(random: () => number = Math.random): number {
  return Math.round(MIN_IDLE_DELAY_MS + (MAX_IDLE_DELAY_MS - MIN_IDLE_DELAY_MS) * random());
}

export function selectIdleClip(options: {
  random?: () => number;
  previous: RoninIdleClip | null;
  reduceMotion: boolean;
}): RoninIdleClip {
  const eligible = IDLE_CLIP_WEIGHTS.filter(([clip]) => (
    clip !== options.previous
    && (!options.reduceMotion || (clip !== 'yawn' && clip !== 'shoulderStretch'))
  ));
  const totalWeight = eligible.reduce((total, [, weight]) => total + weight, 0);
  let selection = Math.min(Math.max(options.random?.() ?? Math.random(), 0), 1) * totalWeight;

  for (const [clip, weight] of eligible) {
    selection -= weight;
    if (selection < 0) return clip;
  }

  return eligible[eligible.length - 1][0];
}
