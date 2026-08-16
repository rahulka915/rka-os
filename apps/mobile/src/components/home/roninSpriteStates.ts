export type RoninSpriteState = 'idle' | 'walking' | 'tapReaction';

export interface SpriteStateConfig {
  frames: number[];
  intervalMs: number;
  loopMode: 'loop' | 'once';
}
