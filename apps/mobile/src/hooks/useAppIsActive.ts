import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Tracks whether the app is in the foreground. Used to pause continuous
// render loops (e.g. the 3D companion's WebGL animate loop) when backgrounded.
export function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return active;
}
