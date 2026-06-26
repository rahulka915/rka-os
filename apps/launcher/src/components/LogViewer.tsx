import { useEffect, useRef } from 'react';
import type { LogEntry } from '../lib/types';

interface Props {
  logs: LogEntry[];
  onClear: () => void;
  onDownload: () => void;
}

const LEVEL_CLASS: Record<string, string> = {
  Error: 'log-error',
  Warn: 'log-warn',
  Info: 'log-info',
};

export function LogViewer({ logs, onClear, onDownload }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <span className="log-count">{logs.length} lines</span>
        <button className="btn-ghost" onClick={onClear}>Clear</button>
        <button className="btn-ghost" onClick={onDownload}>Download</button>
      </div>
      <div className="log-scroll">
        {logs.map((entry, i) => (
          <div key={i} className={`log-line ${LEVEL_CLASS[entry.level]}`}>
            <span className="log-time">
              {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className="log-msg">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
