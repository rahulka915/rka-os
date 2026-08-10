import type { RoninCatState, RoninMood, RoninOutfit } from './types';

export const RONIN_JOURNEY_ACTIVITIES = [
  'journey',
  'idle',
  'meditating',
  'sleeping',
  'working',
  'reading',
  'training',
  'stretching',
  'teaBreak',
  'tired',
  'celebrating',
  'companion',
] as const;

export type RoninJourneyActivity = (typeof RONIN_JOURNEY_ACTIVITIES)[number];

export const RONIN_JOURNEY_RIVE_CONTRACT = {
  artboard: 'Journey',
  stateMachine: 'Journey Controller',
  viewModel: 'Journey',
  properties: {
    activity: 'activity',
    mood: 'mood',
    outfit: 'outfit',
    catState: 'catState',
    progress: 'progress',
    reducedMotion: 'reducedMotion',
    tap: 'tap',
    complete: 'complete',
  },
} as const;

export interface RoninJourneyPresentation {
  activity: RoninJourneyActivity;
  mood: RoninMood;
  outfit: RoninOutfit;
  catState: RoninCatState;
  progress: number;
  reducedMotion: boolean;
}

export function createRoninJourneyPresentation(
  input: Partial<RoninJourneyPresentation> = {},
): RoninJourneyPresentation {
  return {
    activity: input.activity ?? 'journey',
    mood: input.mood ?? 'normal',
    outfit: input.outfit ?? 'journey',
    catState: input.catState ?? 'calm',
    progress: normalizeProgress(input.progress),
    reducedMotion: input.reducedMotion ?? false,
  };
}

function normalizeProgress(progress: number | undefined): number {
  if (progress === undefined || !Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}
