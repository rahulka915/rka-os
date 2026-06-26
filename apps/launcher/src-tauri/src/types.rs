use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Process / Dev state ────────────────────────────────────────────────────

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

// ── Project type ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ProjectType {
    Expo,
    NextJS,
    NodeAPI,
    Python,
    Service,
    Custom,
}

// ── Commands / Editor / PackageManager ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PackageManager {
    Npm,
    Pnpm,
    Bun,
    Yarn,
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

// ── Project profile (per-project config) ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectProfile {
    pub id: String,
    pub name: String,
    pub project_type: ProjectType,
    pub path: String,
    pub port: u16,
    pub commands: ProjectCommands,
    pub dependencies: Vec<String>,
    pub auto_start: bool,
    pub qr_support: bool,
    pub show_qr_on_ready: bool,
    pub auto_hide_after_connect: bool,
    pub preferred_editor: Editor,
}

// ── Global config (startup order, window size) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub startup_order: Vec<String>,
    pub window: WindowConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub width: i32,
    pub height: i32,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        Self {
            startup_order: Vec::new(),
            window: WindowConfig { width: 600, height: 800 },
        }
    }
}

// ── Health check ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub timestamp: String,
    pub project_id: String,
    pub checks: HashMap<String, bool>,
    pub port_conflict: Option<(u16, u32)>,
    pub passed: bool,
}

// ── Crash report ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashReport {
    pub timestamp: String,
    pub project_id: String,
    pub exit_code: i32,
    pub last_100_lines: Vec<String>,
}

// ── Legacy single-project health (kept for commands.rs backward compat) ───

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

// ── Tray state (multi-project) ─────────────────────────────────────────────

pub struct TrayAppState {
    pub process_states: HashMap<String, ProcessState>,
    pub dev_states: HashMap<String, DevState>,
    pub device_connected: HashMap<String, bool>,
    pub start_times: HashMap<String, std::time::Instant>,
}

impl Default for TrayAppState {
    fn default() -> Self {
        Self {
            process_states: HashMap::new(),
            dev_states: HashMap::new(),
            device_connected: HashMap::new(),
            start_times: HashMap::new(),
        }
    }
}
