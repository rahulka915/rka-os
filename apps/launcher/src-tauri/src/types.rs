use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Exited,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DevState {
    Idle,
    Installing,
    Bundling,
    MetroReady,
    WaitingForDevice,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub level: LogLevel,
    pub message: String,
    pub timestamp: u64,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PackageManager {
    Npm,
    Pnpm,
    Bun,
    Yarn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectHealth {
    pub node_installed: bool,
    pub npm_installed: bool,
    pub expo_installed: bool,
    pub package_json_exists: bool,
    pub is_expo_project: bool,
    pub dependencies_installed: bool,
    pub metro_port_free: bool,
    pub package_manager: PackageManager,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCommands {
    pub start: String,
    pub start_clean: String,
    pub install: String,
    pub doctor: String,
}

impl Default for ProjectCommands {
    fn default() -> Self {
        Self {
            start: "npx expo start --go".into(),
            start_clean: "npx expo start --go --clear".into(),
            install: "npm install".into(),
            doctor: "npx expo-doctor".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Editor {
    Cursor,
    VSCode,
    Zed,
    Xcode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: String,
    pub name: String,
    pub path: String,
    pub commands: ProjectCommands,
    pub preferred_editor: Editor,
    pub auto_start: bool,
}
