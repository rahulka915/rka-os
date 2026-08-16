export const WALK_CYCLE_FRAME_COUNT = 8;
export const WALK_CYCLE_FRAME_INTERVAL_MS = 83; // ~12fps; one full 8-frame loop ≈ 660ms

export function getNextWalkCycleFrame(currentFrame: number, frameCount: number = WALK_CYCLE_FRAME_COUNT): number {
  return (currentFrame + 1) % frameCount;
}

export function getNextSpriteFrame(
  currentFrame: number,
  frameCount: number,
  loopMode: 'loop' | 'once',
): { frame: number; didComplete: boolean } {
  if (loopMode === 'once' && currentFrame >= frameCount - 1) {
    return { frame: frameCount - 1, didComplete: true };
  }
  return { frame: getNextWalkCycleFrame(currentFrame, frameCount), didComplete: false };
}
