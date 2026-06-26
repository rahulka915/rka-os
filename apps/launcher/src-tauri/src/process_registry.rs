use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

use crate::diagnostics;
use crate::events;
use crate::log_parser::LogParser;
use crate::types::{CrashReport, DevState, ProcessState};

struct ManagedProcess {
    child: Arc<Mutex<Option<Child>>>,
    device_connected: Arc<Mutex<bool>>,
    port: u16,
}

pub struct ProcessRegistry {
    processes: HashMap<String, ManagedProcess>,
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self { processes: HashMap::new() }
    }

    pub fn start(
        &mut self,
        app: AppHandle,
        project_id: String,
        cwd: String,
        command: String,
        port: u16,
    ) {
        // Don't double-start
        if let Some(p) = self.processes.get(&project_id) {
            if p.child.lock().unwrap().is_some() {
                return;
            }
        }

        // Kill any stale process on this port before starting
        if port > 0 {
            let _ = Command::new("sh")
                .args(["-c", &format!("lsof -ti :{port} | xargs kill -9 2>/dev/null || true")])
                .output();
        }

        events::emit_process_state(&app, &project_id, ProcessState::Starting);
        events::emit_dev_state(&app, &project_id, DevState::Bundling);

        let child_arc: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
        let device_connected_arc: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));

        let managed = ManagedProcess {
            child: Arc::clone(&child_arc),
            device_connected: Arc::clone(&device_connected_arc),
            port,
        };
        self.processes.insert(project_id.clone(), managed);

        // Spawn in background thread so we don't block Tauri's main thread
        let child_arc2 = Arc::clone(&child_arc);
        let device_connected_ref = Arc::clone(&device_connected_arc);
        let app_clone = app.clone();
        let project_id_clone = project_id.clone();

        std::thread::spawn(move || {
            let mut cmd = Command::new("zsh");
            cmd.args(["-i", "-c", &command])
                .current_dir(&cwd)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .env(
                    "PATH",
                    format!(
                        "/usr/local/bin:/opt/homebrew/bin:{}",
                        std::env::var("PATH").unwrap_or_default()
                    ),
                );

            match cmd.spawn() {
                Ok(mut child) => {
                    let stdout = child.stdout.take().unwrap();
                    let stderr = child.stderr.take().unwrap();
                    *child_arc2.lock().unwrap() = Some(child);

                    events::emit_process_state(&app_clone, &project_id_clone, ProcessState::Running);

                    // ── stdout reader thread ────────────────────────────
                    let app_out = app_clone.clone();
                    let id_out = project_id_clone.clone();
                    let device_ref2 = Arc::clone(&device_connected_ref);
                    let child_arc3 = Arc::clone(&child_arc2);
                    let app_exit = app_clone.clone();
                    let id_exit = project_id_clone.clone();

                    std::thread::spawn(move || {
                        let parser = LogParser::new(port);
                        let mut log_tail: Vec<String> = Vec::new();

                        for line in BufReader::new(stdout).lines().flatten() {
                            // Keep a rolling tail for crash reports
                            log_tail.push(line.clone());
                            if log_tail.len() > 100 {
                                log_tail.remove(0);
                            }

                            let (dev_state, entry, url) = parser.parse_line(&line);

                            if let Some(state) = dev_state {
                                events::emit_dev_state(&app_out, &id_out, state);
                            }
                            if let Some(u) = url {
                                events::emit_qr(&app_out, &id_out, u);
                            }
                            if !*device_ref2.lock().unwrap() && parser.is_device_connected(&line) {
                                *device_ref2.lock().unwrap() = true;
                                events::emit_device_connected(&app_out, &id_out);
                            }

                            diagnostics::append_session_log(&app_out, &id_out, &entry.raw);
                            events::emit_log(&app_out, &id_out, entry);
                        }

                        // stdout closed → process ended; get exit code
                        let exit_code = {
                            let mut guard = child_arc3.lock().unwrap();
                            guard
                                .as_mut()
                                .and_then(|c| c.wait().ok())
                                .and_then(|s| s.code())
                                .unwrap_or(-1)
                        };

                        if exit_code != 0 {
                            let report = CrashReport {
                                timestamp: now_iso8601(),
                                project_id: id_exit.clone(),
                                exit_code,
                                last_100_lines: log_tail,
                            };
                            diagnostics::save_crash_report(&app_exit, &report);
                            events::emit_crash(&app_exit, &id_exit, exit_code, false);
                            events::emit_process_state(&app_exit, &id_exit, ProcessState::Failed);
                        } else {
                            events::emit_process_state(&app_exit, &id_exit, ProcessState::Exited);
                        }
                        events::emit_dev_state(&app_exit, &id_exit, DevState::Idle);
                    });

                    // ── stderr reader thread ────────────────────────────
                    let app_err = app_clone.clone();
                    let id_err = project_id_clone.clone();
                    std::thread::spawn(move || {
                        let parser = LogParser::new(port);
                        for line in BufReader::new(stderr).lines().flatten() {
                            let (_, entry, _) = parser.parse_line(&line);
                            diagnostics::append_session_log(&app_err, &id_err, &entry.raw);
                            events::emit_log(&app_err, &id_err, entry);
                        }
                    });
                }
                Err(e) => {
                    let msg = format!("Failed to start process: {e}");
                    events::emit_log(
                        &app_clone,
                        &project_id_clone,
                        crate::types::LogEntry {
                            level: crate::types::LogLevel::Error,
                            message: msg.clone(),
                            timestamp: 0,
                            raw: msg,
                        },
                    );
                    events::emit_process_state(&app_clone, &project_id_clone, ProcessState::Failed);
                    events::emit_crash(&app_clone, &project_id_clone, -1, false);
                }
            }
        });
    }

    pub fn stop(&mut self, app: &AppHandle, project_id: &str) {
        events::emit_process_state(app, project_id, ProcessState::Stopping);
        if let Some(managed) = self.processes.get_mut(project_id) {
            if let Some(mut child) = managed.child.lock().unwrap().take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *managed.device_connected.lock().unwrap() = false;
        }
        events::emit_process_state(app, project_id, ProcessState::Stopped);
        events::emit_dev_state(app, project_id, DevState::Idle);
    }

    pub fn restart(
        &mut self,
        app: AppHandle,
        project_id: String,
        cwd: String,
        command: String,
        port: u16,
    ) {
        self.stop(&app, &project_id);
        self.start(app, project_id, cwd, command, port);
    }

    pub fn is_running(&self, project_id: &str) -> bool {
        self.processes
            .get(project_id)
            .map(|p| p.child.lock().unwrap().is_some())
            .unwrap_or(false)
    }

    pub fn get_state(&self, project_id: &str) -> ProcessState {
        // Derive state from whether child exists — tray state is more authoritative
        if self.is_running(project_id) {
            ProcessState::Running
        } else {
            ProcessState::Stopped
        }
    }
}

fn now_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let days = secs / 86400;
    let y = 1970 + days / 365;
    let mo = ((days % 365) / 30 + 1).min(12);
    let d = (days % 30 + 1).min(31);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}
