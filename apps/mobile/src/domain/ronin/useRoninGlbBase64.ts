import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { RONIN_MODEL } from './roninModel';

// Reads the bundled Ronin GLB and exposes it base64-encoded for the DOM
// component (Ronin3DDom), whose webview cannot fetch bundled asset files
// directly. Cached module-level: the model is immutable per app launch, so
// every consumer shares one read.

let cached: Promise<string> | null = null;

function loadGlbBase64(): Promise<string> {
  cached ??= (async () => {
    const asset = Asset.fromModule(RONIN_MODEL);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return new File(uri).base64();
  })();
  return cached;
}

export interface RoninGlbState {
  glbBase64: string | null;
  error: string | null;
}

export function useRoninGlbBase64(enabled = true): RoninGlbState {
  const [state, setState] = useState<RoninGlbState>({ glbBase64: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadGlbBase64()
      .then((glbBase64) => {
        if (alive) setState({ glbBase64, error: null });
      })
      .catch((error: unknown) => {
        if (alive) setState({ glbBase64: null, error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return state;
}
