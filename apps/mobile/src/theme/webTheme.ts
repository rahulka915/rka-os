// Warm-minimal palette for the desktop web app only — see
// docs/superpowers/specs/2026-07-30-desktop-warm-minimal-design.md.
// Mobile keeps its own theme (theme/colors.ts) untouched; nothing here is
// imported by any mobile screen.
export const webColors = {
  background: '#FFFBEB',
  foreground: '#0F172A',
  primary: '#78716C',
  accent: '#D97706',
  card: '#FFFFFF',
  muted: '#F6F6F6',
  mutedForeground: '#64748B',
  border: '#EEEDED',
  destructive: '#DC2626',
} as const;

export const webSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const webRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const webFontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
} as const;
