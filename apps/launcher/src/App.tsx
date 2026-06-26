import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsSheet } from './components/SettingsSheet';
import { ProjectHeader } from './components/ProjectHeader';
import { ServerStatusCard } from './components/ServerStatusCard';
import { ActionBar } from './components/ActionBar';
import { QRModal } from './components/QRModal';
import { QRPanel } from './components/QRPanel';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import { LogViewer } from './components/LogViewer';
import { useProject } from './hooks/useProject';
import { useServerEvents } from './hooks/useServerEvents';
import { useLogs } from './hooks/useLogs';
import * as api from './lib/tauri';

export default function App() {
  const { config, health, loadingHealth, selectPath, updateConfig, refreshHealth } = useProject();
  const { processState, devState, expoUrl, crashCount, isDeviceConnected } = useServerEvents();
  const { logs, clear: clearLogs, downloadDiagnostics } = useLogs();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (config?.auto_start && processState === 'Stopped') {
      api.startServer();
    }
  }, [config?.id]);

  useEffect(() => {
    if (config) refreshHealth();
  }, [config?.id]);

  useEffect(() => {
    if (isDeviceConnected && config?.auto_hide_after_connect !== false) {
      setTimeout(() => {
        invoke('hide_window').catch(console.error);
      }, 1000);
    }
  }, [isDeviceConnected]);

  if (!config) {
    return (
      <div className="app-shell centered">
        <SettingsPanel onSelect={selectPath} />
      </div>
    );
  }

  const showQRModal = expoUrl && config.show_qr_on_ready !== false;

  return (
    <>
      {showQRModal && (
        <QRModal url={expoUrl} isDeviceConnected={isDeviceConnected} />
      )}
      {showSettings && (
        <SettingsSheet
          config={config}
          onSave={updateConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
      <div className="app-shell">
        <ProjectHeader
          config={config}
          onChangePath={async () => {
            const selected = await open({ directory: true, title: 'Select Expo project folder' });
            if (typeof selected === 'string') selectPath(selected);
          }}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div className="main-content">
          <ServerStatusCard
            processState={processState}
            devState={devState}
            crashCount={crashCount}
          />

          <ActionBar
            processState={processState}
            onInstall={() => api.installDependencies()}
          />

          <QRPanel url={expoUrl} />

          <EnvironmentBanner
            health={health}
            loading={loadingHealth}
            onRefresh={refreshHealth}
          />

          <LogViewer
            logs={logs}
            onClear={clearLogs}
            onDownload={downloadDiagnostics}
          />
        </div>
      </div>
    </>
  );
}
