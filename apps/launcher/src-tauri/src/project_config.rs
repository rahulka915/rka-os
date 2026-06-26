use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::types::{Editor, ProjectCommands, ProjectConfig};

const CONFIG_FILE: &str = "config.json";

fn config_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join(CONFIG_FILE)
}

pub fn load_config(app: &AppHandle) -> Option<ProjectConfig> {
    let path = config_path(app);
    if !path.exists() {
        return None;
    }
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_config(app: &AppHandle, config: &ProjectConfig) {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = std::fs::write(path, json);
    }
}

pub fn make_default_config(path: String) -> ProjectConfig {
    let name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    ProjectConfig {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path,
        commands: ProjectCommands::default(),
        preferred_editor: Editor::Cursor,
        auto_start: false,
        reopen_last_project: true,
        show_qr_on_ready: true,
        auto_hide_after_connect: true,
        launch_at_login: false,
    }
}
