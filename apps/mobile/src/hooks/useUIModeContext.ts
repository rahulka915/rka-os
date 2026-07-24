import { createContext, useContext } from 'react';

interface UIModeContextValue {
  isExperimentalHome: boolean;
  toggle: () => void;
}

export const UIModeContext = createContext<UIModeContextValue>({
  isExperimentalHome: false,
  toggle: () => {},
});

export function useUIModeContext() {
  return useContext(UIModeContext);
}
