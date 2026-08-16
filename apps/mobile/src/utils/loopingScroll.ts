export type SkyLayer = 'sky' | 'midground' | 'foreground';

export const RESET_CROSSFADE_MS = 1500;

export const LAYER_SCROLL_CONFIG: Record<SkyLayer, { loopDurationMs: number; widthMultiplier: number }> = {
  sky: { loopDurationMs: 20 * 60 * 1000, widthMultiplier: 2 },
  midground: { loopDurationMs: 8 * 60 * 1000, widthMultiplier: 2.5 },
  foreground: { loopDurationMs: 3 * 60 * 1000, widthMultiplier: 3 },
};

// A layer's loop is one continuously-scrolling "primary" copy (0 -> 1 over
// loopDurationMs, then it must jump back to 0 — the seam this whole scheme
// exists to hide, since the art isn't a perfect tileable loop) plus a
// second static "reset" copy sitting at the start position, which fades in
// during the last `resetFraction` of the cycle and fades back out right
// after the jump. See docs/superpowers/specs/2026-08-16-scrolling-parallax-sky-design.md §4.
export function computeLoopFrame(
  t: number,
  resetFraction: number,
): { scrollFraction: number; primaryOpacity: number; resetOpacity: number } {
  const clampedT = Math.min(1, Math.max(0, t));
  const crossfadeStart = 1 - resetFraction;
  const primaryOpacity = clampedT < crossfadeStart ? 1 : 1 - (clampedT - crossfadeStart) / resetFraction;
  return { scrollFraction: clampedT, primaryOpacity, resetOpacity: 1 - primaryOpacity };
}
