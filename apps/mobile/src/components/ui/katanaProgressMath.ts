export const KATANA_ASPECT_RATIO = 5;
export const KATANA_HERO_HEIGHT = 48;

export type KatanaPixelSize = 16 | 20 | 24 | 32 | 48 | 64;
export type KatanaProgressSize = KatanaPixelSize | `${KatanaPixelSize}` | 'hero';

export function clampKatanaProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function resolveKatanaHeight(size: KatanaProgressSize): number {
  if (size === 'hero') return KATANA_HERO_HEIGHT;
  return typeof size === 'number' ? size : Number(size);
}

export function resolveKatanaWidth(size: KatanaProgressSize): number | '100%' {
  if (size === 'hero') return '100%';
  return resolveKatanaHeight(size) * KATANA_ASPECT_RATIO;
}
