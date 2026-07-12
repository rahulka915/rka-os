export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  sheetHeaderBottom: 14,
  compact: 10,
} as const;

export const radius = {
  control: 10,
  card: 12,
  surface: 18,
  floating: 24,
  sheet: 28,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  title: 24,
} as const;

// Multipliers — multiply by a fontSize value to get an actual line-height in px.
// e.g. fontSize.title * lineHeight.tight = 24 * 1.15 = 27.6
export const lineHeight = {
  tight: 1.15,   // large titles (fontSize.xl and up)
  snug: 1.3,     // headings (fontSize.lg)
  normal: 1.5,   // body copy (fontSize.base, fontSize.sm)
  relaxed: 1.6,  // dense paragraph text needing extra readability
} as const;

// Absolute px values (not multipliers) — apply directly to `letterSpacing`.
export const letterSpacing = {
  tight: -0.4,  // large titles (fontSize.xl and up)
  normal: 0,    // everything else
} as const;

export const shadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 25,
    elevation: 8,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 12,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
} as const;
