use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::types::{GlobalConfig, ProjectProfile};

fn app_data(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("failed to get app data dir")
}

pub fn profiles_dir(app: &AppHandle) -> PathBuf {
    app_data(app).join("profiles")
}

pub fn diagnostics_dir(app: &AppHandle, project_id: &str) -> PathBuf {
    app_data(app).join("diagnostics").join(project_id)
}

fn global_config_path(app: &AppHandle) -> PathBuf {
    app_data(app).join("config.json")
}

// ── Global config ──────────────────────────────────────────────────────────

pub fn load_global_config(app: &AppHandle) -> GlobalConfig {
    let path = global_config_path(app);
    if !path.exists() {
        return GlobalConfig::default();
    }
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_global_config(app: &AppHandle, config: &GlobalConfig) {
    let path = global_config_path(app);
    if let Some(p) = path.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = std::fs::write(path, json);
    }
}

// ── Profile CRUD ───────────────────────────────────────────────────────────

pub fn load_profile(app: &AppHandle, project_id: &str) -> Option<ProjectProfile> {
    let path = profiles_dir(app).join(format!("{}.json", project_id));
    if !path.exists() {
        return None;
    }
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_profile(app: &AppHandle, profile: &ProjectProfile) {
    let dir = profiles_dir(app);
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.json", profile.id));
    if let Ok(json) = serde_json::to_string_pretty(profile) {
        let _ = std::fs::write(path, json);
    }
    // Append to startup_order if new
    let mut global = load_global_config(app);
    if !global.startup_order.contains(&profile.id) {
        global.startup_order.push(profile.id.clone());
        save_global_config(app, &global);
    }
}

pub fn load_all_profiles(app: &AppHandle) -> Vec<ProjectProfile> {
    let dir = profiles_dir(app);
    if !dir.exists() {
        return Vec::new();
    }

    let global = load_global_config(app);
    let mut profiles: Vec<ProjectProfile> = std::fs::read_dir(&dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()? == "json" {
                let data = std::fs::read_to_string(path).ok()?;
                serde_json::from_str::<ProjectProfile>(&data).ok()
            } else {
                None
            }
        })
        .collect();

    // Sort by startup_order, unordered profiles go to the end
    profiles.sort_by_key(|p| {
        global.startup_order.iter().position(|id| id == &p.id).unwrap_or(usize::MAX)
    });
    profiles
}

pub fn delete_profile(app: &AppHandle, project_id: &str) {
    let path = profiles_dir(app).join(format!("{}.json", project_id));
    let _ = std::fs::remove_file(path);
    let mut global = load_global_config(app);
    global.startup_order.retain(|id| id != project_id);
    save_global_config(app, &global);
}
