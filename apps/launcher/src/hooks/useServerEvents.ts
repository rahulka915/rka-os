import { useEffect, useState } from 'react';
import * as api from '../lib/tauri';
import type { DevState, ProcessState } from '../lib/types';

export function useServerEvents() {
  const [processState, setProcessState] = useState<ProcessState>('Stopped');
  const [devState, setDevState] = useState<DevState>('Idle');
  const [expoUrl, setExpoUrl] = useState<string | null>(null);
  const [crashCount, setCrashCount] = useState(0);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);

  useEffect(() => {
    const unsubs = [
      api.onProcessState(s => {
        setProcessState(s as ProcessState);
        if (s === 'Stopped' || s === 'Exited' || s === 'Failed') {
          setDevState('Idle');
          setExpoUrl(null);
          setIsDeviceConnected(false);
        }
      }),
      api.onDevState(s => setDevState(s as DevState)),
      api.onQrDetected(url => setExpoUrl(url)),
      api.onCrash(({ restarting }) => {
        setCrashCount(c => c + 1);
        if (!restarting) setProcessState('Failed');
      }),
      api.onDeviceConnected(() => setIsDeviceConnected(true)),
    ];
    return () => { unsubs.forEach(p => p.then(u => u())); };
  }, []);

  return { processState, devState, expoUrl, crashCount, isDeviceConnected };
}
