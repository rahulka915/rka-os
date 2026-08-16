export type RoninSpriteState = 'idle' | 'walking' | 'jump' | 'bow';

export interface SpriteStateConfig {
  frames: number[];
  intervalMs: number;
  loopMode: 'loop' | 'once';
}
