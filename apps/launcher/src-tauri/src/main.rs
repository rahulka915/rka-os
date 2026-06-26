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

#[tauri::command]
async fn hide_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
async fn show_window(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(ProcessManager::new()))
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
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Hide instead of close (stays in background, accessible from Dock)
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
