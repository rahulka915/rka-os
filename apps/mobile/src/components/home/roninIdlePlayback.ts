import type { RoninIdleClip } from '../../utils/roninIdleScheduler';
import type { RoninSpriteState } from './roninSpriteStates';

export type RoninAction = 'jump' | 'bow';

interface RoninPlaybackState {
  activeAction: RoninAction | null;
  activeIdle: RoninIdleClip | null;
}

export function resolveRoninSpriteState(options: RoninPlaybackState & { isWalking: boolean }): RoninSpriteState {
  if (options.activeAction) return options.activeAction;
  if (options.isWalking) return 'walking';
  return options.activeIdle ?? 'idle';
}

export function finishRoninPlayback(state: RoninPlaybackState): RoninPlaybackState {
  if (state.activeAction) return { ...state, activeAction: null };
  if (state.activeIdle) return { ...state, activeIdle: null };
  return state;
}
