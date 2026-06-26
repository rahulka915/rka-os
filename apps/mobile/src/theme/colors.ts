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
  bg: '#0c0c0c',
  bgElevated: '#161616',
  surface: '#1c1c1e',
  surfaceRaised: 'rgba(28,28,30,0.94)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  fill: 'rgba(255,255,255,0.08)',
  fillStrong: 'rgba(255,255,255,0.12)',
  separator: 'rgba(255,255,255,0.10)',
  separatorStrong: 'rgba(255,255,255,0.18)',
  backdrop: 'rgba(0,0,0,0.5)',
  handle: 'rgba(255,255,255,0.18)',
  iconMuted: 'rgba(255,255,255,0.38)',

  text: '#f2f2f2',
  textSecondary: 'rgba(255,255,255,0.66)',
  textTertiary: 'rgba(255,255,255,0.42)',
  textMuted: 'rgba(255,255,255,0.52)',

  maroon: '#c1121f',
  maroonSoft: 'rgba(193,18,31,0.18)',
  blue: '#3d9dff',
  blueSoft: 'rgba(61,157,255,0.18)',
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
  primary: darkColors.maroon,
};

export function getThemeColors(isDark: boolean) {
  return isDark ? darkThemeColors : themeColors;
}
