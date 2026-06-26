import { open } from '@tauri-apps/plugin-dialog';

interface Props {
  onSelect: (path: string) => void;
}

export function SettingsPanel({ onSelect }: Props) {
  const handlePick = async () => {
    const selected = await open({ directory: true, title: 'Select Expo project folder' });
    if (typeof selected === 'string') {
      onSelect(selected);
    }
  };

  return (
    <div className="settings-panel">
      <h2 className="settings-title">RKA Dev Launcher</h2>
      <p className="settings-desc">Select your Expo project folder to get started.</p>
      <button className="btn-primary" onClick={handlePick}>
        Choose Project Folder
      </button>
    </div>
  );
}
