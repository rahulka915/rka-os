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

  maroon: '#a41e34',
  maroonSoft: 'rgba(164,30,52,0.12)',
  blue: '#007aff',
  blueSoft: 'rgba(0,122,255,0.12)',
  green: '#34a853',
  greenSoft: 'rgba(52,168,83,0.14)',
  red: '#ff3b30',
  redSoft: 'rgba(255,59,48,0.12)',
  orange: '#ff9500',
  orangeSoft: 'rgba(255,149,0,0.14)',
} as const;

export const darkColors = {
  bg: '#0a0a0b',
  bgElevated: '#141416',
  surface: '#18181b',
  surfaceRaised: 'rgba(24,24,27,0.94)',
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

  maroon: '#c1121f',
  maroonSoft: 'rgba(193,18,31,0.18)',
  // Silvery blue — the locked-in dark-mode accent (glow color for FABs,
  // active/ready states, primary CTAs). Desaturated + cool vs. the old
  // saturated iOS blue, matching the Moonly-inspired theme direction.
  blue: '#9fb8d1',
  blueSoft: 'rgba(159,184,209,0.16)',
  green: '#3dbb5e',
  greenSoft: 'rgba(61,187,94,0.16)',
  red: '#ff5147',
  redSoft: 'rgba(255,81,71,0.18)',
  orange: '#ff9f5a',
  orangeSoft: 'rgba(255,159,90,0.18)',
} as const;

export const themeColors = {
  ...colors,
  primary: colors.maroon,
};

export const darkThemeColors = {
  ...darkColors,
  // Silvery blue replaces maroon as the dark-mode primary accent — light
  // mode keeps maroon unchanged.
  primary: darkColors.blue,
};

export function getThemeColors(isDark: boolean) {
  return isDark ? darkThemeColors : themeColors;
}
