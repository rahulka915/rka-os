use tauri::AppHandle;
use crate::types::{CrashReport, HealthCheckResult};
use crate::project_profiles::diagnostics_dir;

pub fn save_health_result(app: &AppHandle, result: &HealthCheckResult) {
    let dir = diagnostics_dir(app, &result.project_id);
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(result) {
        let _ = std::fs::write(dir.join("last_health.json"), json);
    }
}

pub fn load_health_result(app: &AppHandle, project_id: &str) -> Option<HealthCheckResult> {
    let path = diagnostics_dir(app, project_id).join("last_health.json");
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_crash_report(app: &AppHandle, report: &CrashReport) {
    let dir = diagnostics_dir(app, &report.project_id);
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(report) {
        let _ = std::fs::write(dir.join("last_crash.json"), json);
    }
}

pub fn load_crash_report(app: &AppHandle, project_id: &str) -> Option<CrashReport> {
    let path = diagnostics_dir(app, project_id).join("last_crash.json");
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Append a line to the rolling session log (capped at 5000 lines).
pub fn append_session_log(app: &AppHandle, project_id: &str, line: &str) {
    let dir = diagnostics_dir(app, project_id);
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("session.log");

    // Read existing, trim to 4999, append new line
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<&str> = existing.lines().collect();
    if lines.len() >= 4999 {
        lines.drain(0..lines.len() - 4999);
    }
    let mut content = lines.join("\n");
    if !content.is_empty() {
        content.push('\n');
    }
    content.push_str(line);
    content.push('\n');
    let _ = std::fs::write(path, content);
}

/// Return the last `limit` lines from the session log.
pub fn read_session_log(app: &AppHandle, project_id: &str, limit: usize) -> Vec<String> {
    let path = diagnostics_dir(app, project_id).join("session.log");
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let all: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    if all.len() <= limit {
        all
    } else {
        all[all.len() - limit..].to_vec()
    }
}
