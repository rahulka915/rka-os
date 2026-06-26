import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LogEntry, ProjectConfig, ProjectHealth } from './types';

export const getProjectConfig = () => invoke<ProjectConfig | null>('get_project_config');
export const setProjectPath = (path: string) => invoke<ProjectConfig>('set_project_path', { path });
export const saveProjectConfig = (config: ProjectConfig) => invoke('save_project_config', { config });
export const startServer = () => invoke('start_server');
export const startServerClean = () => invoke('start_server_clean');
export const stopServer = () => invoke('stop_server');
export const restartServer = () => invoke('restart_server');
export const installDependencies = () => invoke('install_dependencies');
export const runDoctor = () => invoke('run_doctor');
export const checkEnvironment = () => invoke<ProjectHealth>('check_environment');
export const openInFinder = (path: string) => invoke('open_in_finder', { path });
export const openInEditor = (path: string) => invoke('open_in_editor', { path });

export const onProcessState = (cb: (s: string) => void) =>
  listen<string>('launcher:process_state', e => cb(e.payload));

export const onDevState = (cb: (s: string) => void) =>
  listen<string>('launcher:dev_state', e => cb(e.payload));

export const onLog = (cb: (entry: LogEntry) => void) =>
  listen<LogEntry>('launcher:log', e => cb(e.payload));

export const onQrDetected = (cb: (url: string) => void) =>
  listen<string>('launcher:qr_detected', e => cb(e.payload));

export const onCrash = (cb: (p: { exit_code: number; restarting: boolean }) => void) =>
  listen<{ exit_code: number; restarting: boolean }>('launcher:crash', e => cb(e.payload));

export const onDeviceConnected = (cb: () => void) =>
  listen('launcher:device_connected', () => cb());
