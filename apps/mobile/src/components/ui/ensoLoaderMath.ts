export const ENSO_VIEWBOX_SIZE = 100;
export const ENSO_RADIUS = 40;
export const ENSO_STROKE_WIDTH = 5;

const ENSO_MIN_DASH_RATIO = 0.16;

export function ensoCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

export function ensoDashOffset(phase: number, circumference: number): number {
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2; // 0 -> 1 -> 0
  const minOffset = circumference * ENSO_MIN_DASH_RATIO;
  return circumference - (circumference - minOffset) * triangle;
}

export function ensoRotationDegrees(phase: number): number {
  return phase * 360;
}
