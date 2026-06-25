import { createTamagui, createTokens, createFont } from '@tamagui/core'
import { animations, shorthands, media } from '@tamagui/config/v3'

const rkaTokens = createTokens({
  color: {
    // Light
    bg: '#faf9f6',
    bgElevated: '#ffffff',
    surface: '#ffffff',
    surfaceRaised: 'rgba(255,255,255,0.94)',
    fill: 'rgba(13,13,13,0.06)',
    fillStrong: 'rgba(13,13,13,0.10)',
    separator: 'rgba(13,13,13,0.08)',
    text: '#0d0d0d',
    textSecondary: 'rgba(13,13,13,0.50)',
    textTertiary: 'rgba(13,13,13,0.28)',

    // Dark equivalents (referenced in dark theme)
    bgDark: '#0c0c0c',
    bgElevatedDark: '#161616',
    surfaceDark: '#161616',
    surfaceRaisedDark: '#202020',
    fillDark: 'rgba(255,255,255,0.08)',
    fillStrongDark: 'rgba(255,255,255,0.13)',
    separatorDark: 'rgba(255,255,255,0.08)',
    textDark: '#f2f2f2',
    textSecondaryDark: 'rgba(242,242,242,0.50)',
    textTertiaryDark: 'rgba(242,242,242,0.28)',

    blue: '#007aff',
    blueSoft: 'rgba(0,122,255,0.14)',
    blueSoftDark: 'rgba(0,122,255,0.20)',
    green: '#34a853',
    greenSoft: 'rgba(52,168,83,0.14)',
    red: '#ff3b30',
    redSoft: 'rgba(255,59,48,0.14)',
    orange: '#ff8c42',
    orangeSoft: 'rgba(255,140,66,0.14)',
    purple: '#7c5cbf',
    purpleSoft: 'rgba(124,92,191,0.14)',

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
      background: '#faf9f6',
      backgroundHover: 'rgba(13,13,13,0.04)',
      backgroundPress: 'rgba(13,13,13,0.08)',
      color: '#0d0d0d',
      borderColor: 'rgba(13,13,13,0.08)',
      shadowColor: 'rgba(13,13,13,0.08)',
      placeholderColor: 'rgba(13,13,13,0.28)',

      // Semantic aliases — light
      bg: '#faf9f6',
      bgElevated: '#ffffff',
      surface: '#ffffff',
      fill: 'rgba(13,13,13,0.06)',
      fillStrong: 'rgba(13,13,13,0.10)',
      separator: 'rgba(13,13,13,0.08)',
      text: '#0d0d0d',
      textSecondary: 'rgba(13,13,13,0.50)',
      textTertiary: 'rgba(13,13,13,0.28)',
      blue: '#007aff',
      blueSoft: 'rgba(0,122,255,0.12)',
      green: '#34a853',
      greenSoft: 'rgba(52,168,83,0.12)',
      red: '#ff3b30',
      redSoft: 'rgba(255,59,48,0.12)',
      orange: '#ff8c42',
    },
    dark: {
      background: '#0c0c0c',
      backgroundHover: 'rgba(255,255,255,0.06)',
      backgroundPress: 'rgba(255,255,255,0.10)',
      color: '#f2f2f2',
      borderColor: 'rgba(255,255,255,0.08)',
      shadowColor: 'rgba(0,0,0,0.40)',
      placeholderColor: 'rgba(242,242,242,0.28)',

      // Semantic aliases — dark
      bg: '#0c0c0c',
      bgElevated: '#161616',
      surface: '#161616',
      fill: 'rgba(255,255,255,0.08)',
      fillStrong: 'rgba(255,255,255,0.13)',
      separator: 'rgba(255,255,255,0.08)',
      text: '#f2f2f2',
      textSecondary: 'rgba(242,242,242,0.50)',
      textTertiary: 'rgba(242,242,242,0.28)',
      blue: '#3d9dff',
      blueSoft: 'rgba(61,157,255,0.18)',
      green: '#3dbb5e',
      greenSoft: 'rgba(61,187,94,0.16)',
      red: '#ff5147',
      redSoft: 'rgba(255,81,71,0.18)',
      orange: '#ff9f5a',
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
