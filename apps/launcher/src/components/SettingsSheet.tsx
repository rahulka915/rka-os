import { useState } from 'react';
import type { ProjectConfig } from '../lib/types';

interface Props {
  config: ProjectConfig;
  onSave: (updated: ProjectConfig) => void;
  onClose: () => void;
}

interface CheckboxRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function CheckboxRow({ label, description, checked, onChange, disabled }: CheckboxRowProps) {
  return (
    <label className={`settings-row ${disabled ? 'settings-row--disabled' : ''}`}>
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-desc">{description}</span>
      </div>
      <input
        type="checkbox"
        className="settings-checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
    </label>
  );
}

export function SettingsSheet({ config, onSave, onClose }: Props) {
  const [draft, setDraft] = useState({ ...config });

  const set = (field: Partial<ProjectConfig>) =>
    setDraft(d => ({ ...d, ...field }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="btn-ghost icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-section-label">Session</div>
          <CheckboxRow
            label="Reopen previous session automatically"
            description="Remember and reopen the last project on next launch"
            checked={draft.reopen_last_project}
            onChange={v => set({ reopen_last_project: v })}
          />
          <CheckboxRow
            label="Auto-start Expo server on launch"
            description="Start Metro immediately when the app opens"
            checked={draft.auto_start}
            onChange={v => set({ auto_start: v })}
          />

          <div className="settings-section-label" style={{ marginTop: 16 }}>Workflow</div>
          <CheckboxRow
            label="Show QR popup when Metro is ready"
            description="Full-screen QR overlay so you can scan without opening the window"
            checked={draft.show_qr_on_ready}
            onChange={v => set({ show_qr_on_ready: v })}
          />
          <CheckboxRow
            label="Auto-hide window after device connects"
            description="Window fades out 1s after Expo Go scans the code"
            checked={draft.auto_hide_after_connect}
            onChange={v => set({ auto_hide_after_connect: v })}
          />

          <div className="settings-section-label" style={{ marginTop: 16 }}>System</div>
          <CheckboxRow
            label="Launch at login"
            description="Start RKA Dev Launcher when you log in (requires rebuild)"
            checked={draft.launch_at_login}
            onChange={v => set({ launch_at_login: v })}
            disabled
          />
        </div>

        <div className="settings-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
