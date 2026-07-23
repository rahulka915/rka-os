export const itemComposerMaterial = {
  dark: {
    background: '#101014',
    surface: '#1A191D',
    surfaceRaised: '#201F24',
    fill: 'rgba(230,225,214,0.055)',
    rim: 'rgba(201,194,184,0.18)',
    rimStrong: 'rgba(212,176,120,0.38)',
    platinum: '#C9C2B8',
    platinumMuted: 'rgba(229,224,214,0.54)',
    accent: '#D4B078',
    accentSoft: 'rgba(212,176,120,0.14)',
    onAccent: '#211A10',
  },
  light: {
    background: '#F6F3EC',
    surface: '#F1ECE1',
    surfaceRaised: '#FAF7F0',
    fill: 'rgba(64,52,35,0.055)',
    rim: 'rgba(92,78,58,0.20)',
    rimStrong: 'rgba(139,105,54,0.42)',
    platinum: '#675F56',
    platinumMuted: 'rgba(53,47,40,0.58)',
    accent: '#8B6936',
    accentSoft: 'rgba(139,105,54,0.12)',
    onAccent: '#FFFFFF',
  },
} as const;

export function getItemComposerMaterial(isDark: boolean) {
  return isDark ? itemComposerMaterial.dark : itemComposerMaterial.light;
}
