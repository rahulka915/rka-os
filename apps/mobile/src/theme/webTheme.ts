// Warm-minimal palette for the desktop web app only — see
// docs/superpowers/specs/2026-07-30-desktop-warm-minimal-design.md.
// Mobile keeps its own theme (theme/colors.ts) untouched; nothing here is
// imported by any mobile screen.
//
// Values are CSS custom-property references, not literal hex — every screen
// already imports webColors.X into a module-scope StyleSheet.create() (called
// once, not per-render), so a React-state-driven theme would require
// rewriting every screen to recompute styles on every render. CSS variables
// sidestep that entirely: the browser resolves var(--rka-*) at paint time, so
// toggling the `data-theme` attribute on <html> (see webThemeController.ts)
// instantly re-themes every already-mounted screen with zero React re-render
// and zero changes to any of the 20+ files that already reference these
// tokens. The actual light/dark values live in WEB_THEME_CSS below.
export const webColors = {
  background: 'var(--rka-background)',
  foreground: 'var(--rka-foreground)',
  primary: 'var(--rka-primary)',
  accent: 'var(--rka-accent)',
  card: 'var(--rka-card)',
  muted: 'var(--rka-muted)',
  mutedForeground: 'var(--rka-muted-foreground)',
  border: 'var(--rka-border)',
  destructive: 'var(--rka-destructive)',
  warningBackground: 'var(--rka-warning-bg)',
  warningBorder: 'var(--rka-warning-border)',
  warningForeground: 'var(--rka-warning-fg)',
} as const;

// Injected once into <head> by webThemeController.ts's initWebTheme().
// Aligned to the iOS "River Stone" design language (src/theme/colors.ts) so the
// desktop web app reads as the same product as native. Brand/interactive
// emphasis is restrained vermilion (iOS active-nav/brand accent), not amber;
// surfaces are warm River-Stone neutrals; brass carries warning/attention.
// Variable names are unchanged, so all 20+ web screens re-theme with no edits.
export const WEB_THEME_CSS = `
:root {
  --rka-background: #F6F5F1;
  --rka-foreground: #1C1C1E;
  --rka-primary: #8B6936;
  --rka-accent: #A8402C;
  --rka-card: #FFFFFF;
  --rka-muted: #EDEAE1;
  --rka-muted-foreground: #6B6257;
  --rka-border: #DCD7CB;
  --rka-destructive: #FF3B30;
  --rka-warning-bg: #FBEEDD;
  --rka-warning-border: #EBD9B8;
  --rka-warning-fg: #8B6936;
}
[data-theme="dark"] {
  --rka-background: #0B0E16;
  --rka-foreground: #F2EDE6;
  --rka-primary: #D4B078;
  --rka-accent: #C1503A;
  --rka-card: #151922;
  --rka-muted: #1C2029;
  --rka-muted-foreground: #9A968E;
  --rka-border: #252A34;
  --rka-destructive: #FF5147;
  --rka-warning-bg: #2A2416;
  --rka-warning-border: #4A3E24;
  --rka-warning-fg: #D4B078;
}
`;

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
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

// Sunset "halo" for the Home hero stage that hosts the Rive scene — sampled
// from the scene art (peach sky → warm amber → dusty rose) then melting into
// the dark River Stone shell below, so the scene feels built into the page
// rather than pasted onto it. Only the Home hero uses these; the rest of the
// web app stays on the dark River Stone tokens above.
export const webSunset = {
  skyTop: '#F0A868',
  skyMid: '#E8894A',
  rose: '#C77B6B',
  // Matches --rka-background (dark) so the halo dissolves seamlessly.
  shell: '#0B0E16',
  sun: '#F0E4A8',
} as const;

// River Stone depth for web surfaces — mirrors the native list/card variants in
// src/components/riverstone/riverStoneTokens.ts (dark palette): a stacked
// contact + ambient drop shadow plus a faint top light-catch (inset highlight),
// so cards/rows read as raised graphite stone rather than flat fills. RN Web
// maps `boxShadow` straight to CSS. Pair with `webColors.card` as the base.
export const webDepth = {
  list: {
    borderRadius: 22,
    boxShadow:
      '0 6px 11px rgba(0,0,0,0.40), 0 14px 34px rgba(0,0,0,0.26), inset 0 1px 0 rgba(232,236,244,0.07)',
  },
  card: {
    borderRadius: 26,
    boxShadow:
      '0 8px 14px rgba(0,0,0,0.46), 0 20px 44px rgba(0,0,0,0.32), inset 0 1px 0 rgba(232,236,244,0.08)',
  },
} as const;

export const webFontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
} as const;
