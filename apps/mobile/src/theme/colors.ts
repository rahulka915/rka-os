export const colors = {
  bg: '#f6f5f1',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: 'rgba(255,255,255,0.94)',
  surfaceHover: 'rgba(0,0,0,0.035)',
  fill: 'rgba(118,118,128,0.12)',
  fillStrong: 'rgba(13,13,13,0.08)',
  separator: 'rgba(60,60,67,0.16)',
  separatorStrong: 'rgba(60,60,67,0.24)',
  backdrop: 'rgba(0,0,0,0.42)',
  handle: 'rgba(60,60,67,0.18)',
  iconMuted: 'rgba(13,13,13,0.32)',

  text: '#1c1c1e',
  textSecondary: 'rgba(60,60,67,0.66)',
  textTertiary: 'rgba(60,60,67,0.42)',
  textMuted: 'rgba(60,60,67,0.52)',

  // Accent palette — silver (neutral/secondary), deeper blue (primary),
  // pastel pink (warm accent), bridging purple (balances blue and pink).
  // Same hex values in light and dark mode; only bg/surface differ by mode.
  silver: '#808080',
  silverSoft: 'rgba(128,128,128,0.12)',
  deeperBlue: '#2b7ff0',
  deeperBlueSoft: 'rgba(43,127,240,0.12)',
  pink: '#ffb8d1',
  pinkSoft: 'rgba(255,184,209,0.14)',
  purple: '#d4a8ff',
  purpleSoft: 'rgba(212,168,255,0.14)',

  // Alias — `blue` was the old single-accent token, still referenced across
  // several call sites. Points at the unified deeper-blue accent rather than
  // being migrated call-site by call-site, since the visual outcome (one
  // primary accent color everywhere) is identical either way.
  blue: '#2b7ff0',
  blueSoft: 'rgba(43,127,240,0.12)',

  green: '#34a853',
  greenSoft: 'rgba(52,168,83,0.14)',
  red: '#ff3b30',
  redSoft: 'rgba(255,59,48,0.12)',
  orange: '#ff9500',
  orangeSoft: 'rgba(255,149,0,0.14)',

  // River Stone surface base — deliberately neutral/warm-gray, distinct from
  // `surface` (which is blue-tinted to match the night palette). Used by
  // RiverStoneSurface for components that don't already carry their own
  // deliberate color (hero gradients, scene photos, etc. keep their own).
  stoneSurface: '#f3efe4',

  // App-wide-refinement-v1 accents (2026-08-05): warm ivory/greige text for
  // River Stone surfaces, antique brass for selection/important-action
  // emphasis (matches `itemComposer.ts`'s existing brass accent), restrained
  // vermilion for active-navigation/brand emphasis — replaces the teal More-
  // tab active color. Same family as the existing torii-red (`#C44545`) but
  // its own token since it's now used for selection/badges too, not just
  // one icon.
  ivory: '#2b2620',
  greige: 'rgba(43,38,32,0.58)',
  antiqueBrass: '#8B6936',
  antiqueBrassSoft: 'rgba(139,105,54,0.12)',
  vermilion: '#A8402C',
  vermilionSoft: 'rgba(168,64,44,0.12)',

  // Count-badge accent (header inbox badge) — same value in both palettes,
  // so the badge stays readable/consistent regardless of theme.
  badgeAccent: '#D9506B',
} as const;

export const darkColors = {
  bg: '#0f0f1a',
  bgElevated: '#1a1a2e',
  surface: '#1a1a2e',
  surfaceRaised: 'rgba(26,26,46,0.94)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  fill: 'rgba(255,255,255,0.05)',
  fillStrong: 'rgba(255,255,255,0.10)',
  separator: 'rgba(255,255,255,0.08)',
  separatorStrong: 'rgba(255,255,255,0.16)',
  backdrop: 'rgba(0,0,0,0.55)',
  handle: 'rgba(255,255,255,0.18)',
  iconMuted: 'rgba(255,255,255,0.38)',

  text: '#f2ede6',
  textSecondary: 'rgba(242,237,230,0.64)',
  textTertiary: 'rgba(242,237,230,0.40)',
  textMuted: 'rgba(242,237,230,0.52)',

  silver: '#c5c5c5',
  silverSoft: 'rgba(197,197,197,0.14)',
  deeperBlue: '#2b7ff0',
  deeperBlueSoft: 'rgba(43,127,240,0.16)',
  pink: '#ffb8d1',
  pinkSoft: 'rgba(255,184,209,0.16)',
  purple: '#d4a8ff',
  purpleSoft: 'rgba(212,168,255,0.16)',

  // See the light-mode `colors` comment above — same aliasing rationale.
  blue: '#2b7ff0',
  blueSoft: 'rgba(43,127,240,0.16)',

  green: '#3dbb5e',
  greenSoft: 'rgba(61,187,94,0.16)',
  red: '#ff5147',
  redSoft: 'rgba(255,81,71,0.18)',
  orange: '#ff9f5a',
  orangeSoft: 'rgba(255,159,90,0.18)',

  // See the light-mode `colors` comment above — same rationale.
  stoneSurface: '#1c1c22',

  // See the light-mode `colors` comment above for the app-wide-refinement-v1
  // rationale — dark-mode values brightened for legibility against charcoal.
  ivory: '#F2ECDD',
  greige: 'rgba(242,236,221,0.56)',
  antiqueBrass: '#D4B078',
  antiqueBrassSoft: 'rgba(212,176,120,0.16)',
  vermilion: '#C1503A',
  vermilionSoft: 'rgba(193,80,58,0.18)',

  // See the light-mode `colors` comment above — same value both modes.
  badgeAccent: '#D9506B',
} as const;

export const themeColors = {
  ...colors,
  primary: colors.deeperBlue,
};

export const darkThemeColors = {
  ...darkColors,
  primary: darkColors.deeperBlue,
};

export function getThemeColors(isDark: boolean) {
  return isDark ? darkThemeColors : themeColors;
}

export type ThemeColors = ReturnType<typeof getThemeColors>;
