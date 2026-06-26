use tauri::{AppHandle, Emitter};
use crate::types::{DevState, LogEntry, ProcessState, ProjectHealth};

pub fn emit_process_state(app: &AppHandle, state: ProcessState) {
    let _ = app.emit("launcher:process_state", state);
}

pub fn emit_dev_state(app: &AppHandle, state: DevState) {
    let _ = app.emit("launcher:dev_state", state);
}

pub fn emit_log(app: &AppHandle, entry: LogEntry) {
    let _ = app.emit("launcher:log", entry);
}

pub fn emit_qr(app: &AppHandle, url: String) {
    let _ = app.emit("launcher:qr_detected", url);
}

pub fn emit_crash(app: &AppHandle, exit_code: i32, restarting: bool) {
    let _ = app.emit(
        "launcher:crash",
        serde_json::json!({ "exit_code": exit_code, "restarting": restarting }),
    );
}

pub fn emit_health(app: &AppHandle, health: ProjectHealth) {
    let _ = app.emit("launcher:health", health);
}

pub fn emit_device_connected(app: &AppHandle) {
    let _ = app.emit("launcher:device_connected", ());
}
