import { useEffect, useRef, useState } from 'react';
import type { DevState, ProcessState } from '../lib/types';

interface Props {
  processState: ProcessState;
  devState: DevState;
  crashCount: number;
}

const PROCESS_LABELS: Record<ProcessState, string> = {
  Stopped: 'Stopped',
  Starting: 'Starting…',
  Running: 'Running',
  Stopping: 'Stopping…',
  Exited: 'Exited',
  Failed: 'Failed',
};

const PROCESS_COLORS: Record<ProcessState, string> = {
  Stopped: 'var(--status-idle)',
  Starting: 'var(--status-busy)',
  Running: 'var(--status-ok)',
  Stopping: 'var(--status-busy)',
  Exited: 'var(--status-idle)',
  Failed: 'var(--status-error)',
};

const DEV_LABELS: Record<DevState, string> = {
  Idle: '',
  Installing: 'Installing packages',
  Bundling: 'Bundling',
  MetroReady: 'Metro ready ✓',
  WaitingForDevice: 'Waiting for device',
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const ACTIVE_STATES: ProcessState[] = ['Starting', 'Running'];
const BUSY_DEV_STATES: DevState[] = ['Installing', 'Bundling'];

export function ServerStatusCard({ processState, devState, crashCount }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = ACTIVE_STATES.includes(processState);
  const isBusy = isActive && BUSY_DEV_STATES.includes(devState);

  useEffect(() => {
    if (isActive && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
    } else if (!isActive) {
      startTimeRef.current = null;
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const dotClass = isBusy ? 'status-dot pulsing' : 'status-dot';

  return (
    <div className="status-card">
      <div className="status-row">
        <span
          className={dotClass}
          style={{ background: PROCESS_COLORS[processState] }}
        />
        <span className="status-label">{PROCESS_LABELS[processState]}</span>
        {isActive && elapsed > 0 && (
          <span className="elapsed-timer">{formatElapsed(elapsed)}</span>
        )}
        {devState !== 'Idle' && (
          <span className={`dev-label ${isBusy ? 'dev-label-busy' : ''}`}>
            {DEV_LABELS[devState]}
            {isBusy && <span className="dots-anim" />}
          </span>
        )}
      </div>
      {isBusy && elapsed > 90 && (
        <div className="slow-warn">
          ⚠ Still bundling after {formatElapsed(elapsed)} — may be stuck
        </div>
      )}
      {crashCount > 0 && (
        <div className="crash-badge">⚠ {crashCount} crash{crashCount > 1 ? 'es' : ''}</div>
      )}
    </div>
  );
}
