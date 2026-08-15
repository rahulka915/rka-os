export const WALK_CYCLE_FRAME_COUNT = 8;
export const WALK_CYCLE_FRAME_INTERVAL_MS = 83; // ~12fps; one full 8-frame loop ≈ 660ms

export function getNextWalkCycleFrame(currentFrame: number, frameCount: number = WALK_CYCLE_FRAME_COUNT): number {
  return (currentFrame + 1) % frameCount;
}
