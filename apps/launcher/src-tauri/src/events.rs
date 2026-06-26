use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use crate::types::{DevState, LogEntry, ProcessState, TrayAppState};

// ── Process state ──────────────────────────────────────────────────────────

pub fn emit_process_state(app: &AppHandle, project_id: &str, state: ProcessState) {
    let _ = app.emit(
        "launcher:process_state",
        serde_json::json!({ "project_id": project_id, "state": state }),
    );

    {
        let guard = app.state::<Mutex<TrayAppState>>();
        let mut ts = guard.lock().unwrap();

        if state == ProcessState::Running {
            ts.start_times.entry(project_id.to_string()).or_insert_with(std::time::Instant::now);
        } else if matches!(state, ProcessState::Stopped | ProcessState::Exited | ProcessState::Failed) {
            ts.start_times.remove(project_id);
            ts.device_connected.remove(project_id);
        }
        ts.process_states.insert(project_id.to_string(), state);
    }

    update_tray_icon(app);
}

// ── Dev state ──────────────────────────────────────────────────────────────

pub fn emit_dev_state(app: &AppHandle, project_id: &str, state: DevState) {
    let _ = app.emit(
        "launcher:dev_state",
        serde_json::json!({ "project_id": project_id, "state": state }),
    );
    let guard = app.state::<Mutex<TrayAppState>>();
    guard.lock().unwrap().dev_states.insert(project_id.to_string(), state);
}

// ── Log ────────────────────────────────────────────────────────────────────

pub fn emit_log(app: &AppHandle, project_id: &str, entry: LogEntry) {
    let _ = app.emit(
        "launcher:log",
        serde_json::json!({ "project_id": project_id, "entry": entry }),
    );
}

// ── QR ────────────────────────────────────────────────────────────────────

pub fn emit_qr(app: &AppHandle, project_id: &str, url: String) {
    let _ = app.emit(
        "launcher:qr_detected",
        serde_json::json!({ "project_id": project_id, "url": url }),
    );
}

// ── Crash ─────────────────────────────────────────────────────────────────

pub fn emit_crash(app: &AppHandle, project_id: &str, exit_code: i32, restarting: bool) {
    let _ = app.emit(
        "launcher:crash",
        serde_json::json!({ "project_id": project_id, "exit_code": exit_code, "restarting": restarting }),
    );
}

// ── Health ────────────────────────────────────────────────────────────────

pub fn emit_health(app: &AppHandle, project_id: &str, result: &crate::types::HealthCheckResult) {
    let _ = app.emit(
        "launcher:health_result",
        serde_json::json!({ "project_id": project_id, "result": result }),
    );
}

// ── Device connected ───────────────────────────────────────────────────────

pub fn emit_device_connected(app: &AppHandle, project_id: &str) {
    let _ = app.emit(
        "launcher:device_connected",
        serde_json::json!({ "project_id": project_id }),
    );
    {
        let guard = app.state::<Mutex<TrayAppState>>();
        guard.lock().unwrap().device_connected.insert(project_id.to_string(), true);
    }
    update_tray_icon(app);
}

// ── Tray icon ──────────────────────────────────────────────────────────────
// Overall icon reflects worst/best state across all projects:
//   🟢 green  — at least one device connected
//   🟡 yellow — any project starting/running (no device yet)
//   🔴 red    (future) — any project failed
//   ⚫ gray   — nothing running

fn update_tray_icon(app: &AppHandle) {
    let icon_bytes: &[u8] = {
        let guard = app.state::<Mutex<TrayAppState>>();
        let ts = guard.lock().unwrap();

        let any_connected = ts.device_connected.values().any(|&v| v);
        let any_running = ts.process_states.values().any(|s| {
            matches!(s, ProcessState::Running | ProcessState::Starting)
        });

        if any_connected {
            include_bytes!("../icons/tray/green.png")
        } else if any_running {
            include_bytes!("../icons/tray/yellow.png")
        } else {
            include_bytes!("../icons/tray/gray.png")
        }
    };

    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}
