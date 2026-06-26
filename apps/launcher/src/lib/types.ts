export type ProcessState = 'Stopped' | 'Starting' | 'Running' | 'Stopping' | 'Exited' | 'Failed';
export type DevState = 'Idle' | 'Installing' | 'Bundling' | 'MetroReady' | 'WaitingForDevice';
export type LogLevel = 'Info' | 'Warn' | 'Error';
export type PackageManager = 'Npm' | 'Pnpm' | 'Bun' | 'Yarn';
export type Editor = 'Cursor' | 'VSCode' | 'Zed' | 'Xcode';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  raw: string;
}

export interface ProjectHealth {
  node_installed: boolean;
  npm_installed: boolean;
  expo_installed: boolean;
  package_json_exists: boolean;
  is_expo_project: boolean;
  dependencies_installed: boolean;
  metro_port_free: boolean;
  package_manager: PackageManager;
}

export interface ProjectCommands {
  start: string;
  start_clean: string;
  install: string;
  doctor: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  commands: ProjectCommands;
  preferred_editor: Editor;
  auto_start: boolean;
}
