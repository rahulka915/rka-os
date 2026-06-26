import type { ProjectHealth } from '../lib/types';
import * as api from '../lib/tauri';

interface Props {
  health: ProjectHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

type Check = { label: string; ok: boolean };

function checks(h: ProjectHealth): Check[] {
  return [
    { label: 'Node.js', ok: h.node_installed },
    { label: 'npm', ok: h.npm_installed },
    { label: 'Expo CLI', ok: h.expo_installed },
    { label: 'package.json', ok: h.package_json_exists },
    { label: 'Expo project', ok: h.is_expo_project },
    { label: 'node_modules', ok: h.dependencies_installed },
    { label: 'Port 8081', ok: h.metro_port_free },
  ];
}

export function EnvironmentBanner({ health, loading, onRefresh }: Props) {
  const allOk = health && checks(health).every(c => c.ok);

  return (
    <div className={`env-banner ${allOk ? 'env-ok' : 'env-warn'}`}>
      <div className="env-header">
        <span className="env-title">Environment</span>
        <button className="btn-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? '…' : 'Check'}
        </button>
      </div>
      {health && (
        <div className="env-checks">
          {checks(health).map(c => (
            <span key={c.label} className={`env-check ${c.ok ? 'ok' : 'fail'}`}>
              {c.ok ? '✓' : '✗'} {c.label}
            </span>
          ))}
          {!health.dependencies_installed && (
            <button
              className="btn-secondary env-fix"
              onClick={() => api.installDependencies()}
            >
              Install deps
            </button>
          )}
        </div>
      )}
    </div>
  );
}
