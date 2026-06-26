use std::sync::Mutex;
use tauri::{AppHandle, State};
use crate::{
    auto_detect,
    diagnostics,
    health_check,
    process_registry::ProcessRegistry,
    project_profiles,
    types::{CrashReport, Editor, HealthCheckResult, ProjectProfile},
};

// ── Multi-project: read ────────────────────────────────────────────────────

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Vec<ProjectProfile> {
    project_profiles::load_all_profiles(&app)
}

#[tauri::command]
pub fn get_project(app: AppHandle, project_id: String) -> Option<ProjectProfile> {
    project_profiles::load_profile(&app, &project_id)
}

// ── Multi-project: write ───────────────────────────────────────────────────

#[tauri::command]
pub fn add_project(app: AppHandle, profile: ProjectProfile) {
    project_profiles::save_profile(&app, &profile);
}

#[tauri::command]
pub fn update_project(app: AppHandle, profile: ProjectProfile) {
    project_profiles::save_profile(&app, &profile);
}

#[tauri::command]
pub fn delete_project(app: AppHandle, project_id: String) {
    project_profiles::delete_profile(&app, &project_id);
}

// ── Auto-detect ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn auto_detect_project(project_path: String) -> ProjectProfile {
    auto_detect::make_profile(project_path)
}

// ── Multi-project: process control ────────────────────────────────────────

#[tauri::command]
pub fn start_project(
    app: AppHandle,
    state: State<Mutex<ProcessRegistry>>,
    project_id: String,
) {
    if let Some(profile) = project_profiles::load_profile(&app, &project_id) {
        let mut reg = state.lock().unwrap();
        reg.start(app, project_id, profile.path, profile.commands.start, profile.port);
    }
}

#[tauri::command]
pub fn stop_project(
    app: AppHandle,
    state: State<Mutex<ProcessRegistry>>,
    project_id: String,
) {
    let mut reg = state.lock().unwrap();
    reg.stop(&app, &project_id);
}

#[tauri::command]
pub fn restart_project(
    app: AppHandle,
    state: State<Mutex<ProcessRegistry>>,
    project_id: String,
) {
    if let Some(profile) = project_profiles::load_profile(&app, &project_id) {
        let mut reg = state.lock().unwrap();
        reg.restart(app, project_id, profile.path, profile.commands.start, profile.port);
    }
}

// ── Health checks & diagnostics ────────────────────────────────────────────

#[tauri::command]
pub fn run_project_health_check(app: AppHandle, project_id: String) -> Option<HealthCheckResult> {
    let profile = project_profiles::load_profile(&app, &project_id)?;
    let result = health_check::run_health_check(
        &profile.project_type,
        &profile.path,
        profile.port,
        &project_id,
    );
    diagnostics::save_health_result(&app, &result);
    crate::events::emit_health(&app, &project_id, &result);
    Some(result)
}

#[tauri::command]
pub fn get_last_health(app: AppHandle, project_id: String) -> Option<HealthCheckResult> {
    diagnostics::load_health_result(&app, &project_id)
}

#[tauri::command]
pub fn get_last_crash(app: AppHandle, project_id: String) -> Option<CrashReport> {
    diagnostics::load_crash_report(&app, &project_id)
}

#[tauri::command]
pub fn get_session_logs(app: AppHandle, project_id: String, limit: usize) -> Vec<String> {
    diagnostics::read_session_log(&app, &project_id, limit)
}

// ── Utilities ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_in_finder(path: String) {
    let _ = std::process::Command::new("open").arg(&path).spawn();
}

#[tauri::command]
pub fn open_in_editor(app: AppHandle, project_id: String) {
    if let Some(profile) = project_profiles::load_profile(&app, &project_id) {
        let editor_cmd = match profile.preferred_editor {
            Editor::Cursor => "cursor",
            Editor::VSCode => "code",
            Editor::Zed => "zed",
            Editor::Xcode => "xed",
        };
        let _ = std::process::Command::new(editor_cmd).arg(&profile.path).spawn();
    }
}

/// Read the major Expo SDK version from node_modules for a given path.
pub fn read_expo_sdk_version(project_path: &str) -> Option<String> {
    let pkg = std::path::Path::new(project_path).join("node_modules/expo/package.json");
    let content = std::fs::read_to_string(pkg).ok()?;
    let v: serde_json::Value = serde_json::from_str(&content).ok()?;
    v["version"]
        .as_str()
        .map(|s| s.split('.').next().unwrap_or(s).to_string())
}
