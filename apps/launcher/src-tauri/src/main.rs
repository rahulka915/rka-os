// Prevents an additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auto_detect;
mod commands;
mod diagnostics;
mod events;
mod health_check;
mod log_parser;
mod process_registry;
mod project_profiles;
mod types;

use std::sync::Mutex;
use process_registry::ProcessRegistry;
use types::{ProcessState, TrayAppState};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
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

/// Build the tray dropdown menu grouping all projects by their current state.
fn build_tray_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let profiles = project_profiles::load_all_profiles(app);
    let ts_guard = app.state::<Mutex<TrayAppState>>();
    let ts = ts_guard.lock().unwrap();

    let open_item = MenuItem::with_id(app, "open_window", "Dashboard", true, None::<&str>)?;
    let sep_bottom = PredefinedMenuItem::separator(app)?;
    let quit_item = PredefinedMenuItem::quit(app, Some("Quit"))?;

    if profiles.is_empty() {
        let add_item = MenuItem::with_id(app, "add_project", "+ Add Project", true, None::<&str>)?;
        let sep = PredefinedMenuItem::separator(app)?;
        return Menu::with_items(app, &[&add_item, &sep, &open_item, &sep_bottom, &quit_item]);
    }

    let mut running_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    let mut starting_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    let mut stopped_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    let mut problem_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();

    for profile in &profiles {
        let state = ts.process_states.get(&profile.id);
        let icon = match profile.project_type {
            types::ProjectType::Expo => "📱",
            types::ProjectType::NextJS => "🌐",
            types::ProjectType::NodeAPI => "📚",
            types::ProjectType::Python => "🐍",
            types::ProjectType::Service => "⚙",
            types::ProjectType::Custom => "🔧",
        };
        let label = format!("{} {}", icon, profile.name);

        // Build per-project submenu
        let sub = match state {
            Some(ProcessState::Running) => {
                let uptime = ts.start_times.get(&profile.id).map(|t| {
                    let s = t.elapsed().as_secs();
                    if s < 60 { format!("{}s", s) }
                    else if s < 3600 { format!("{}m", s / 60) }
                    else { format!("{}h {}m", s / 3600, (s % 3600) / 60) }
                }).unwrap_or_default();

                let status_txt = if ts.device_connected.get(&profile.id).copied().unwrap_or(false) {
                    format!("🟢 Connected  {}", uptime)
                } else {
                    format!("🟢 Running  {}", uptime)
                };

                let status = MenuItem::with_id(app, format!("status_{}", profile.id), &status_txt, false, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                let restart = MenuItem::with_id(app, format!("restart_{}", profile.id), "↺  Restart", true, None::<&str>)?;
                let stop = MenuItem::with_id(app, format!("stop_{}", profile.id), "■  Stop", true, None::<&str>)?;
                Submenu::with_items(app, &label, true, &[&status, &sep, &restart, &stop])?
            }
            Some(ProcessState::Starting) => {
                let status = MenuItem::with_id(app, format!("status_{}", profile.id), "🟡 Starting…", false, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                let stop = MenuItem::with_id(app, format!("stop_{}", profile.id), "■  Stop", true, None::<&str>)?;
                Submenu::with_items(app, &label, true, &[&status, &sep, &stop])?
            }
            Some(ProcessState::Failed) => {
                let status = MenuItem::with_id(app, format!("status_{}", profile.id), "🔴 Failed", false, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                let restart = MenuItem::with_id(app, format!("restart_{}", profile.id), "↺  Restart", true, None::<&str>)?;
                Submenu::with_items(app, &label, true, &[&status, &sep, &restart])?
            }
            _ => {
                // Stopped / Exited / unknown
                let status = MenuItem::with_id(app, format!("status_{}", profile.id), "⚫ Stopped", false, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                let start = MenuItem::with_id(app, format!("start_{}", profile.id), "▶  Start", true, None::<&str>)?;
                Submenu::with_items(app, &label, true, &[&status, &sep, &start])?
            }
        };

        match state {
            Some(ProcessState::Running) => running_items.push(Box::new(sub)),
            Some(ProcessState::Starting) => starting_items.push(Box::new(sub)),
            Some(ProcessState::Failed) => problem_items.push(Box::new(sub)),
            _ => stopped_items.push(Box::new(sub)),
        }
    }

    // Build flat list of all items with section separators
    // Combine all project submenus (Running → Starting → Stopped → Problems)
    let mut combined: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    combined.extend(running_items);
    combined.extend(starting_items);
    combined.extend(stopped_items);
    combined.extend(problem_items);

    let sep = PredefinedMenuItem::separator(app)?;

    let mut final_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    for item in combined.iter() {
        final_items.push(item.as_ref());
    }
    final_items.push(&sep);
    final_items.push(&open_item);
    final_items.push(&sep_bottom);
    final_items.push(&quit_item);

    Menu::with_items(app, &final_items)
}

fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    let reg_state = app.state::<Mutex<ProcessRegistry>>();

    if let Some(project_id) = id.strip_prefix("start_") {
        let pid = project_id.to_string();
        let app_c = app.clone();
        if let Some(profile) = project_profiles::load_profile(app, &pid) {
            let mut reg = reg_state.lock().unwrap();
            reg.start(app_c, pid, profile.path, profile.commands.start, profile.port);
        }
    } else if let Some(project_id) = id.strip_prefix("stop_") {
        let mut reg = reg_state.lock().unwrap();
        reg.stop(app, project_id);
        // Rebuild menu after state change
        if let Ok(menu) = build_tray_menu(app) {
            if let Some(tray) = app.tray_by_id("main") {
                let _ = tray.set_menu(Some(menu));
            }
        }
    } else if let Some(project_id) = id.strip_prefix("restart_") {
        let pid = project_id.to_string();
        let app_c = app.clone();
        if let Some(profile) = project_profiles::load_profile(app, &pid) {
            let mut reg = reg_state.lock().unwrap();
            reg.restart(app_c, pid, profile.path, profile.commands.start, profile.port);
        }
    } else {
        match id {
            "open_window" | "add_project" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            _ => {}
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(ProcessRegistry::new()))
        .setup(|app| {
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
            // Multi-project
            commands::list_projects,
            commands::get_project,
            commands::add_project,
            commands::update_project,
            commands::delete_project,
            commands::auto_detect_project,
            commands::start_project,
            commands::stop_project,
            commands::restart_project,
            commands::run_project_health_check,
            commands::get_last_health,
            commands::get_last_crash,
            commands::get_session_logs,
            // Utilities
            commands::open_in_finder,
            commands::open_in_editor,
            // Window control
            hide_window,
            show_window,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
