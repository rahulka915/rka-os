import { WEB_THEME_CSS } from './webTheme';

export type WebThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rka-web-theme-mode';
const listeners = new Set<() => void>();
let styleInjected = false;
let mediaQuery: MediaQueryList | null = null;

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function getThemeMode(): WebThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function resolveIsDark(mode: WebThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

function applyTheme(mode: WebThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveIsDark(mode) ? 'dark' : 'light';
}

export function setThemeMode(mode: WebThemeMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
  listeners.forEach((cb) => cb());
}

export function subscribeThemeChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Injects the CSS variable definitions once and applies the persisted (or
// system-default) mode. Call once from the web app's root component.
export function initWebTheme(): void {
  if (typeof document === 'undefined') return;

  if (!styleInjected) {
    const style = document.createElement('style');
    style.id = 'rka-theme-vars';
    style.textContent = WEB_THEME_CSS;
    document.head.appendChild(style);
    styleInjected = true;
  }

  applyTheme(getThemeMode());

  if (!mediaQuery && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (getThemeMode() === 'system') {
        applyTheme('system');
        listeners.forEach((cb) => cb());
      }
    });
  }
}
