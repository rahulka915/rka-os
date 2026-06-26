use std::sync::Mutex;
use tauri::{AppHandle, State};
use crate::{
    process_manager::ProcessManager,
    project_config,
    types::{Editor, PackageManager, ProjectConfig, ProjectHealth},
};

#[tauri::command]
pub fn get_project_config(app: AppHandle) -> Option<ProjectConfig> {
    project_config::load_config(&app)
}

#[tauri::command]
pub fn set_project_path(app: AppHandle, path: String) -> ProjectConfig {
    let config = project_config::make_default_config(path);
    project_config::save_config(&app, &config);
    config
}

#[tauri::command]
pub fn save_project_config(app: AppHandle, config: ProjectConfig) {
    project_config::save_config(&app, &config);
}

#[tauri::command]
pub fn start_server(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    if let Some(config) = project_config::load_config(&app) {
        let pm = state.lock().unwrap();
        pm.start(app, config.path, config.commands.start);
    }
}

#[tauri::command]
pub fn start_server_clean(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    if let Some(config) = project_config::load_config(&app) {
        let pm = state.lock().unwrap();
        pm.start(app, config.path, config.commands.start_clean);
    }
}

#[tauri::command]
pub fn stop_server(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    state.lock().unwrap().stop(&app);
}

#[tauri::command]
pub fn restart_server(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    if let Some(config) = project_config::load_config(&app) {
        let mut pm = state.lock().unwrap();
        pm.stop(&app);
        pm.start(app, config.path, config.commands.start);
    }
}

#[tauri::command]
pub fn install_dependencies(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    if let Some(config) = project_config::load_config(&app) {
        let pm = state.lock().unwrap();
        pm.start(app, config.path, config.commands.install);
    }
}

#[tauri::command]
pub fn run_doctor(app: AppHandle, state: State<Mutex<ProcessManager>>) {
    if let Some(config) = project_config::load_config(&app) {
        let pm = state.lock().unwrap();
        pm.start(app, config.path, config.commands.doctor);
    }
}

#[tauri::command]
pub fn check_environment(app: AppHandle) -> ProjectHealth {
    let path = project_config::load_config(&app)
        .map(|c| c.path)
        .unwrap_or_default();

    let node_ok = std::process::Command::new("node")
        .arg("--version")
        .output()
        .is_ok();

    let npm_ok = std::process::Command::new("npm")
        .arg("--version")
        .output()
        .is_ok();

    // Check expo via npx
    let expo_ok = std::process::Command::new("npx")
        .args(["expo", "--version"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let pkg_path = std::path::Path::new(&path).join("package.json");
    let pkg_exists = pkg_path.exists();

    let is_expo = pkg_exists && {
        std::fs::read_to_string(&pkg_path)
            .map(|c| c.contains("\"expo\""))
            .unwrap_or(false)
    };

    let deps_ok = std::path::Path::new(&path).join("node_modules").exists();

    // Detect package manager from package.json packageManager field
    let package_manager = if pkg_exists {
        let content = std::fs::read_to_string(&pkg_path).unwrap_or_default();
        if content.contains("\"pnpm\"") { PackageManager::Pnpm }
        else if content.contains("\"yarn\"") { PackageManager::Yarn }
        else if content.contains("\"bun\"") { PackageManager::Bun }
        else { PackageManager::Npm }
    } else {
        PackageManager::Npm
    };

    // Check if port 8081 is free
    let port_free = std::net::TcpListener::bind("127.0.0.1:8081").is_ok();

    ProjectHealth {
        node_installed: node_ok,
        npm_installed: npm_ok,
        expo_installed: expo_ok,
        package_json_exists: pkg_exists,
        is_expo_project: is_expo,
        dependencies_installed: deps_ok,
        metro_port_free: port_free,
        package_manager,
    }
}

/// Reads the major version of expo from node_modules (e.g. "54" from "54.0.3")
pub fn read_expo_sdk_version(project_path: &str) -> Option<String> {
    let pkg = std::path::Path::new(project_path)
        .join("node_modules/expo/package.json");
    let content = std::fs::read_to_string(pkg).ok()?;
    let v: serde_json::Value = serde_json::from_str(&content).ok()?;
    v["version"].as_str().map(|s| {
        s.split('.').next().unwrap_or(s).to_string()
    })
}

#[tauri::command]
pub fn open_in_finder(path: String) {
    let _ = std::process::Command::new("open").arg(&path).spawn();
}

#[tauri::command]
pub fn open_in_editor(app: AppHandle, path: String) {
    let editor = project_config::load_config(&app)
        .map(|c| c.preferred_editor)
        .unwrap_or(Editor::Cursor);

    let editor_cmd = match editor {
        Editor::Cursor => "cursor",
        Editor::VSCode => "code",
        Editor::Zed => "zed",
        Editor::Xcode => "xed",
    };

    let _ = std::process::Command::new(editor_cmd).arg(&path).spawn();
}
