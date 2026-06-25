import { createContext, useContext } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggle: () => {},
});

export function useThemeContext() {
  return useContext(ThemeContext);
}
