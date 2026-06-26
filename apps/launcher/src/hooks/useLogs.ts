import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/tauri';
import type { LogEntry } from '../lib/types';

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const rawBuffer = useRef<string[]>([]);

  useEffect(() => {
    const unsub = api.onLog(entry => {
      rawBuffer.current.push(entry.raw);
      if (rawBuffer.current.length > 5000) rawBuffer.current.shift();
      setLogs(prev => [...prev.slice(-499), entry]);
    });
    return () => { unsub.then(u => u()); };
  }, []);

  const downloadDiagnostics = () => {
    const blob = new Blob([rawBuffer.current.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rka-launcher-${Date.now()}.txt`;
    a.click();
  };

  const clear = () => setLogs([]);

  return { logs, downloadDiagnostics, clear };
}
