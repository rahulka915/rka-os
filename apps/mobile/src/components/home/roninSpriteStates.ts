import type { RoninIdleClip } from '../../utils/roninIdleScheduler';

export type RoninSpriteState = 'idle' | 'walking' | 'jump' | 'bow' | RoninIdleClip;

export interface SpriteStateConfig {
  frames: number[];
  intervalMs: number;
  loopMode: 'loop' | 'once';
}
