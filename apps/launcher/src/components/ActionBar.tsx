import type { ProcessState } from '../lib/types';
import * as api from '../lib/tauri';

interface Props {
  processState: ProcessState;
  onInstall: () => void;
}

export function ActionBar({ processState, onInstall }: Props) {
  const isRunning = processState === 'Running' || processState === 'Starting';
  const isBusy = processState === 'Starting' || processState === 'Stopping';

  return (
    <div className="action-bar">
      {!isRunning ? (
        <>
          <button
            className="btn-primary"
            disabled={isBusy}
            onClick={() => api.startServer()}
          >
            Start
          </button>
          <button
            className="btn-secondary"
            disabled={isBusy}
            onClick={() => api.startServerClean()}
          >
            Clear Cache
          </button>
        </>
      ) : (
        <>
          <button
            className="btn-danger"
            disabled={isBusy}
            onClick={() => api.stopServer()}
          >
            Stop
          </button>
          <button
            className="btn-secondary"
            disabled={isBusy}
            onClick={() => api.restartServer()}
          >
            Restart
          </button>
        </>
      )}
      <button
        className="btn-secondary"
        disabled={isBusy}
        onClick={onInstall}
      >
        npm install
      </button>
    </div>
  );
}
