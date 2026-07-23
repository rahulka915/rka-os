import { createContext, useCallback, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Lets the currently-focused screen register a "hold" action for the global
// dock FAB — tap is always generic Create; a
// long-press instead runs whatever genuinely-different creation action the
// current screen offers (new Area, new Project, new Medication, ...),
// replacing what used to be a separate top-right "+" per screen.
export interface FabHoldContextValue {
  setHoldAction: (action: (() => void) | null) => void;
}

export const FabHoldContext = createContext<FabHoldContextValue>({
  setHoldAction: () => {},
});

// action === null means this screen has no distinct hold action (tap-only,
// e.g. Tasks/ProjectDetail) — the dock FAB long-press is simply a no-op there.
export function useRegisterFabHoldAction(action: (() => void) | null) {
  const { setHoldAction } = useContext(FabHoldContext);

  useFocusEffect(
    useCallback(() => {
      setHoldAction(action);
      return () => setHoldAction(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action])
  );
}
