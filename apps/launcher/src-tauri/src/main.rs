// Prevents an additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod events;
mod log_parser;
mod process_manager;
mod project_config;
mod types;

use std::sync::Mutex;
use process_manager::ProcessManager;
use types::{DevState, ProcessState, TrayAppState};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
fn hide_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
fn show_window(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

/// Build the tray dropdown menu reflecting current server state.
/// Called once on setup and rebuilt on every tray-icon click so uptime is fresh.
fn build_tray_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let ts_guard = app.state::<Mutex<TrayAppState>>();
    let ts = ts_guard.lock().unwrap();
    let config = project_config::load_config(app);

    let project_name = config
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_else(|| "No project".to_string());

    let is_running = matches!(ts.process_state, ProcessState::Running | ProcessState::Starting);
    let can_start = matches!(
        ts.process_state,
        ProcessState::Stopped | ProcessState::Exited | ProcessState::Failed
    );

    let status = if ts.device_connected {
        "🟢 Connected".to_string()
    } else {
        match &ts.process_state {
            ProcessState::Stopped | ProcessState::Exited => "⚫ Stopped".to_string(),
            ProcessState::Starting => "🟡 Starting…".to_string(),
            ProcessState::Running => match &ts.dev_state {
                DevState::Bundling => "🟡 Bundling…".to_string(),
                DevState::MetroReady => "🟡 Ready — scan QR".to_string(),
                _ => "🟡 Running".to_string(),
            },
            ProcessState::Stopping => "⏹ Stopping…".to_string(),
            ProcessState::Failed => "🔴 Failed to start".to_string(),
        }
    };

    let uptime_str = ts
        .start_time
        .map(|t| {
            let s = t.elapsed().as_secs();
            if s < 60 {
                format!("Running for {}s", s)
            } else if s < 3600 {
                format!("Running for {}m", s / 60)
            } else {
                format!("Running for {}h {}m", s / 3600, (s % 3600) / 60)
            }
        })
        .unwrap_or_default();

    let expo_sdk_str = config
        .as_ref()
        .and_then(|c| commands::read_expo_sdk_version(&c.path))
        .map(|v| format!("Expo SDK {}", v))
        .unwrap_or_default();

    let show_details = is_running || ts.device_connected;

    // All items created unconditionally — lifetime spans the Menu::with_items call
    let name_item = MenuItem::with_id(app, "proj_name", &project_name, false, None::<&str>)?;
    let status_item = MenuItem::with_id(app, "proj_status", &status, false, None::<&str>)?;
    let uptime_item = MenuItem::with_id(app, "uptime", &uptime_str, false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sdk_item = MenuItem::with_id(app, "sdk", &expo_sdk_str, false, None::<&str>)?;
    let port_item = MenuItem::with_id(app, "port", "Port 8081", false, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let start_item = MenuItem::with_id(app, "start", "▶  Start", can_start, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart", "↺  Restart", is_running, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "■  Stop", is_running, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let open_win_item = MenuItem::with_id(app, "open_window", "Open Window", true, None::<&str>)?;
    let sep4 = PredefinedMenuItem::separator(app)?;
    let quit_item = PredefinedMenuItem::quit(app, Some("Quit"))?;

    if show_details && !uptime_str.is_empty() && !expo_sdk_str.is_empty() {
        Menu::with_items(app, &[
            &name_item, &status_item, &uptime_item, &sep1,
            &sdk_item, &port_item, &sep2,
            &restart_item, &stop_item, &sep3,
            &open_win_item, &sep4, &quit_item,
        ])
    } else if show_details {
        Menu::with_items(app, &[
            &name_item, &status_item, &uptime_item, &sep1,
            &restart_item, &stop_item, &sep3,
            &open_win_item, &sep4, &quit_item,
        ])
    } else {
        Menu::with_items(app, &[
            &name_item, &status_item, &sep1,
            &start_item, &sep3,
            &open_win_item, &sep4, &quit_item,
        ])
    }
}

fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    let pm_state = app.state::<Mutex<ProcessManager>>();
    match event.id().as_ref() {
        "start" => {
            let app_c = app.clone();
            if let Some(config) = project_config::load_config(app) {
                let pm = pm_state.lock().unwrap();
                pm.start(app_c, config.path, config.commands.start);
            }
        }
        "stop" => {
            pm_state.lock().unwrap().stop(app);
        }
        "restart" => {
            let app_c = app.clone();
            if let Some(config) = project_config::load_config(app) {
                let pm = pm_state.lock().unwrap();
                pm.stop(app);
                pm.start(app_c, config.path, config.commands.start);
            }
        }
        "open_window" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
        _ => {}
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(ProcessManager::new()))
        .setup(|app| {
            // Register tray state before any event handlers can fire
            app.manage(Mutex::new(TrayAppState::default()));

            let icon = tauri::image::Image::from_bytes(
                include_bytes!("../icons/tray/gray.png")
            )?;
            let menu = build_tray_menu(app.handle())?;

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .icon_as_template(false)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| handle_menu_event(app, event))
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_project_config,
            commands::set_project_path,
            commands::save_project_config,
            commands::start_server,
            commands::start_server_clean,
            commands::stop_server,
            commands::restart_server,
            commands::install_dependencies,
            commands::run_doctor,
            commands::check_environment,
            commands::open_in_finder,
            commands::open_in_editor,
            hide_window,
            show_window,
        ])
        .on_window_event(|window, event| {
            // Hide instead of close — keeps server running, tray remains
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
