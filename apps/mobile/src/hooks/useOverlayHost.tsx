import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type OverlayHostApi = {
  setOverlay: (id: string, node: ReactNode | null) => void;
};

const OverlayHostContext = createContext<OverlayHostApi | null>(null);

// Renders registered overlays as siblings *after* children, the same position
// InboxScreenV2/CaptureSheet already use to paint above the floating tab bar —
// so anything using useOverlayHost() escapes a Tab.Screen's stacking context
// without depending on RN Modal or a third-party portal library.
export function OverlayHostProvider({ children }: { children: ReactNode }) {
  const [overlays, setOverlays] = useState<Record<string, ReactNode>>({});

  const setOverlay = useCallback((id: string, node: ReactNode | null) => {
    setOverlays((current) => {
      if (node === null) {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: node };
    });
  }, []);

  // Stable reference — without this, every setOverlays update creates a new context
  // value object, forcing every useOverlayHost() consumer (e.g. BottomSheet) to
  // re-render, which re-runs its deps-less effect and calls setOverlay again,
  // looping forever ("Maximum update depth exceeded").
  const value = useMemo(() => ({ setOverlay }), [setOverlay]);

  return (
    <OverlayHostContext.Provider value={value}>
      {children}
      {Object.entries(overlays).map(([id, node]) => (
        <Fragment key={id}>{node}</Fragment>
      ))}
    </OverlayHostContext.Provider>
  );
}

export function useOverlayHost(): OverlayHostApi {
  const value = useContext(OverlayHostContext);
  if (!value) throw new Error('useOverlayHost must be used inside OverlayHostProvider.');
  return value;
}
