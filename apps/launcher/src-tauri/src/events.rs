use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use crate::types::{DevState, LogEntry, ProcessState, ProjectHealth, TrayAppState};

pub fn emit_process_state(app: &AppHandle, state: ProcessState) {
    let _ = app.emit("launcher:process_state", state.clone());
    {
        let guard = app.state::<Mutex<TrayAppState>>();
        let mut ts = guard.lock().unwrap();
        if state == ProcessState::Running && ts.start_time.is_none() {
            ts.start_time = Some(std::time::Instant::now());
        } else if matches!(state, ProcessState::Stopped | ProcessState::Exited | ProcessState::Failed) {
            ts.start_time = None;
            ts.device_connected = false;
        }
        ts.process_state = state;
    }
    update_tray_icon(app);
}

pub fn emit_dev_state(app: &AppHandle, state: DevState) {
    let _ = app.emit("launcher:dev_state", state.clone());
    let guard = app.state::<Mutex<TrayAppState>>();
    guard.lock().unwrap().dev_state = state;
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
    {
        let guard = app.state::<Mutex<TrayAppState>>();
        guard.lock().unwrap().device_connected = true;
    }
    update_tray_icon(app);
}

fn update_tray_icon(app: &AppHandle) {
    let icon_bytes: &[u8] = {
        let guard = app.state::<Mutex<TrayAppState>>();
        let ts = guard.lock().unwrap();
        if ts.device_connected {
            include_bytes!("../icons/tray/green.png")
        } else {
            match ts.process_state {
                ProcessState::Running | ProcessState::Starting => include_bytes!("../icons/tray/yellow.png"),
                _ => include_bytes!("../icons/tray/gray.png"),
            }
        }
    };

    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}
