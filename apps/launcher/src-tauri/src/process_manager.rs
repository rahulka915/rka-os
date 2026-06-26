use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use crate::{
    events,
    log_parser::LogParser,
    types::{DevState, ProcessState},
};

pub struct ProcessManager {
    child: Arc<Mutex<Option<Child>>>,
    crash_count: Arc<Mutex<u32>>,
    device_connected: Arc<Mutex<bool>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            crash_count: Arc::new(Mutex::new(0)),
            device_connected: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, app: AppHandle, cwd: String, command: String) {
        // Prevent duplicate launch
        if self.child.lock().unwrap().is_some() {
            return;
        }

        // Kill any lingering process on port 8081 before starting
        let _ = std::process::Command::new("sh")
            .args(["-c", "lsof -ti :8081 | xargs kill -9 2>/dev/null || true"])
            .output();

        events::emit_process_state(&app, ProcessState::Starting);
        events::emit_dev_state(&app, DevState::Bundling);

        // Run through interactive zsh with explicit PATH for Homebrew/common Node locations
        let mut cmd = Command::new("zsh");
        cmd.args(&["-i", "-c", &command])
            .current_dir(&cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // Add common Node install paths
            .env("PATH", format!(
                "/usr/local/bin:/opt/homebrew/bin:{}",
                std::env::var("PATH").unwrap_or_default()
            ));

        match cmd.spawn() {
            Ok(mut child) => {
                let stdout = child.stdout.take().unwrap();
                let stderr = child.stderr.take().unwrap();

                *self.child.lock().unwrap() = Some(child);
                events::emit_process_state(&app, ProcessState::Running);

                // Stream stdout
                let app_out = app.clone();
                let device_connected_ref = Arc::clone(&self.device_connected);
                std::thread::spawn(move || {
                    let parser = LogParser::new();
                    for line in BufReader::new(stdout).lines().flatten() {
                        let (dev_state, entry, url) = parser.parse_line(&line);
                        if let Some(state) = dev_state {
                            events::emit_dev_state(&app_out, state);
                        }
                        if let Some(u) = url {
                            events::emit_qr(&app_out, u);
                        }
                        // Detect device connection
                        if !*device_connected_ref.lock().unwrap() && parser.is_device_connected(&line) {
                            *device_connected_ref.lock().unwrap() = true;
                            events::emit_device_connected(&app_out);
                        }
                        events::emit_log(&app_out, entry);
                    }
                    // stdout closed = process ended
                    events::emit_process_state(&app_out, ProcessState::Exited);
                    events::emit_dev_state(&app_out, DevState::Idle);
                });

                // Stream stderr
                let app_err = app.clone();
                std::thread::spawn(move || {
                    let parser = LogParser::new();
                    for line in BufReader::new(stderr).lines().flatten() {
                        let (_, entry, _) = parser.parse_line(&line);
                        events::emit_log(&app_err, entry);
                    }
                });
            }
            Err(e) => {
                let msg = format!("Failed to start process: {e}");
                events::emit_log(
                    &app,
                    crate::types::LogEntry {
                        level: crate::types::LogLevel::Error,
                        message: msg.clone(),
                        timestamp: 0,
                        raw: msg,
                    },
                );
                events::emit_process_state(&app, ProcessState::Failed);
                events::emit_crash(&app, -1, false);
            }
        }
    }

    pub fn stop(&self, app: &AppHandle) {
        events::emit_process_state(app, ProcessState::Stopping);
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *self.crash_count.lock().unwrap() = 0;
        *self.device_connected.lock().unwrap() = false;
        events::emit_process_state(app, ProcessState::Stopped);
        events::emit_dev_state(app, DevState::Idle);
    }

    pub fn is_running(&self) -> bool {
        self.child.lock().unwrap().is_some()
    }
}
