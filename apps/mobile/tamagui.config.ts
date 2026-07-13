import { createTamagui, createTokens, createFont } from '@tamagui/core'
import { animations, shorthands, media } from '@tamagui/config/v3'

// Kept in sync with src/theme/colors.ts by hand — Tamagui components read
// through these tokens/themes, while StyleSheet-based components read
// getThemeColors() directly from colors.ts. Two systems, same values.
const rkaTokens = createTokens({
  color: {
    // Light
    bg: '#f6f5f1',
    bgElevated: '#ffffff',
    surface: '#ffffff',
    surfaceRaised: 'rgba(255,255,255,0.94)',
    fill: 'rgba(118,118,128,0.12)',
    fillStrong: 'rgba(13,13,13,0.08)',
    separator: 'rgba(60,60,67,0.16)',
    text: '#1c1c1e',
    textSecondary: 'rgba(60,60,67,0.66)',
    textTertiary: 'rgba(60,60,67,0.42)',

    // Dark equivalents (referenced in dark theme)
    bgDark: '#0f0f1a',
    bgElevatedDark: '#1a1a2e',
    surfaceDark: '#1a1a2e',
    surfaceRaisedDark: 'rgba(26,26,46,0.94)',
    fillDark: 'rgba(255,255,255,0.05)',
    fillStrongDark: 'rgba(255,255,255,0.10)',
    separatorDark: 'rgba(255,255,255,0.08)',
    textDark: '#f2ede6',
    textSecondaryDark: 'rgba(242,237,230,0.64)',
    textTertiaryDark: 'rgba(242,237,230,0.40)',

    blue: '#2b7ff0',
    blueSoft: 'rgba(43,127,240,0.12)',
    blueSoftDark: 'rgba(43,127,240,0.16)',
    green: '#34a853',
    greenSoft: 'rgba(52,168,83,0.14)',
    red: '#ff3b30',
    redSoft: 'rgba(255,59,48,0.12)',
    orange: '#ff9500',
    orangeSoft: 'rgba(255,149,0,0.14)',
    purple: '#d4a8ff',
    purpleSoft: 'rgba(212,168,255,0.14)',
    pink: '#ffb8d1',
    pinkSoft: 'rgba(255,184,209,0.14)',
    silver: '#808080',
    silverSoft: 'rgba(128,128,128,0.12)',

    white: '#ffffff',
    black: '#0d0d0d',
  },
  space: {
    true: 12,
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32,
  },
  size: {
    true: 44,
    0: 0, 1: 16, 2: 24, 3: 32, 4: 44, 5: 56, 6: 64, 7: 80, 8: 96,
  },
  radius: {
    true: 12,
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 999,
  },
  zIndex: { 0: 0, 1: 10, 2: 20, 3: 100, 4: 200 },
})

const sfProFont = createFont({
  family: 'System',
  size: { 1: 11, 2: 13, 3: 15, 4: 17, 5: 20, 6: 24, 7: 32, 8: 40 },
  lineHeight: { 1: 15, 2: 18, 3: 20, 4: 22, 5: 26, 6: 30, 7: 38, 8: 48 },
  weight: { 1: '400', 2: '500', 3: '600', 4: '700', 5: '800' },
  letterSpacing: { 1: 0 },
})

const config = createTamagui({
  animations,
  shorthands,
  media,
  tokens: rkaTokens,
  fonts: { heading: sfProFont, body: sfProFont },
  themes: {
    light: {
      background: '#f6f5f1',
      backgroundHover: 'rgba(23,23,28,0.04)',
      backgroundPress: 'rgba(23,23,28,0.08)',
      color: '#1c1c1e',
      borderColor: 'rgba(60,60,67,0.16)',
      shadowColor: 'rgba(13,13,13,0.08)',
      placeholderColor: 'rgba(60,60,67,0.42)',

      // Semantic aliases — light
      bg: '#f6f5f1',
      bgElevated: '#ffffff',
      surface: '#ffffff',
      fill: 'rgba(118,118,128,0.12)',
      fillStrong: 'rgba(13,13,13,0.08)',
      separator: 'rgba(60,60,67,0.16)',
      text: '#1c1c1e',
      textSecondary: 'rgba(60,60,67,0.66)',
      textTertiary: 'rgba(60,60,67,0.42)',
      blue: '#2b7ff0',
      blueSoft: 'rgba(43,127,240,0.12)',
      green: '#34a853',
      greenSoft: 'rgba(52,168,83,0.12)',
      red: '#ff3b30',
      redSoft: 'rgba(255,59,48,0.12)',
      orange: '#ff9500',
      purple: '#d4a8ff',
      purpleSoft: 'rgba(212,168,255,0.14)',
      pink: '#ffb8d1',
      pinkSoft: 'rgba(255,184,209,0.14)',
      silver: '#808080',
      silverSoft: 'rgba(128,128,128,0.12)',
    },
    dark: {
      background: '#0f0f1a',
      backgroundHover: 'rgba(255,255,255,0.06)',
      backgroundPress: 'rgba(255,255,255,0.10)',
      color: '#f2ede6',
      borderColor: 'rgba(255,255,255,0.08)',
      shadowColor: 'rgba(0,0,0,0.40)',
      placeholderColor: 'rgba(242,237,230,0.40)',

      // Semantic aliases — dark
      bg: '#0f0f1a',
      bgElevated: '#1a1a2e',
      surface: '#1a1a2e',
      fill: 'rgba(255,255,255,0.05)',
      fillStrong: 'rgba(255,255,255,0.10)',
      separator: 'rgba(255,255,255,0.08)',
      text: '#f2ede6',
      textSecondary: 'rgba(242,237,230,0.64)',
      textTertiary: 'rgba(242,237,230,0.40)',
      blue: '#2b7ff0',
      blueSoft: 'rgba(43,127,240,0.16)',
      green: '#3dbb5e',
      greenSoft: 'rgba(61,187,94,0.16)',
      red: '#ff5147',
      redSoft: 'rgba(255,81,71,0.18)',
      orange: '#ff9f5a',
      purple: '#d4a8ff',
      purpleSoft: 'rgba(212,168,255,0.16)',
      pink: '#ffb8d1',
      pinkSoft: 'rgba(255,184,209,0.16)',
      silver: '#c5c5c5',
      silverSoft: 'rgba(197,197,197,0.14)',
    },
  },
  settings: {
    allowedStyleValues: 'somewhat-strict',
    autocompleteSpecificTokens: true,
  },
})

export type AppConfig = typeof config
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
