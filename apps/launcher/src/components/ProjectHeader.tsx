import * as api from '../lib/tauri';
import type { ProjectConfig } from '../lib/types';

interface Props {
  config: ProjectConfig;
  onChangePath: () => void;
  onOpenSettings: () => void;
}

export function ProjectHeader({ config, onChangePath, onOpenSettings }: Props) {
  return (
    <div className="project-header">
      <div className="project-info">
        <span className="project-name">{config.name}</span>
        <span className="project-path" title={config.path}>
          {config.path.replace(/.*\//, '…/')}
        </span>
      </div>
      <div className="project-actions">
        <button className="btn-ghost icon-btn" title="Open in Finder" onClick={() => api.openInFinder(config.path)}>
          ⌘
        </button>
        <button className="btn-ghost icon-btn" title="Open in editor" onClick={() => api.openInEditor(config.path)}>
          ✏
        </button>
        <button className="btn-ghost icon-btn" title="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
        <button className="btn-ghost" onClick={onChangePath}>
          Change
        </button>
      </div>
    </div>
  );
}
