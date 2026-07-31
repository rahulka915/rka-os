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
export const WEB_THEME_CSS = `
:root {
  --rka-background: #FFFBEB;
  --rka-foreground: #0F172A;
  --rka-primary: #78716C;
  --rka-accent: #D97706;
  --rka-card: #FFFFFF;
  --rka-muted: #F6F6F6;
  --rka-muted-foreground: #64748B;
  --rka-border: #EEEDED;
  --rka-destructive: #DC2626;
  --rka-warning-bg: #FEF3E2;
  --rka-warning-border: #F5D8A8;
  --rka-warning-fg: #B45309;
}
[data-theme="dark"] {
  --rka-background: #1C1917;
  --rka-foreground: #F5F5F4;
  --rka-primary: #A8A29E;
  --rka-accent: #F59E0B;
  --rka-card: #292524;
  --rka-muted: #26211D;
  --rka-muted-foreground: #A8A29E;
  --rka-border: #3F3A36;
  --rka-destructive: #F87171;
  --rka-warning-bg: #3A2E1A;
  --rka-warning-border: #5C4626;
  --rka-warning-fg: #FBBF24;
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
