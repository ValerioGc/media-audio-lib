//! Media Audio Lib core.
//!
//! The binary only calls [`run`]; all logic lives here so it stays testable with `cargo test`.

pub mod catalog;
pub mod commands;
pub mod error;
pub mod hash;
pub mod library;
pub mod metadata;
pub mod state;

#[cfg(test)]
pub mod fixtures;

pub use error::{AppError, AppResult};

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager as _, Runtime, WindowEvent};

use crate::catalog::CatalogState;
use crate::metadata::CoverCache;
use crate::state::LibraryState;

pub const LIBRARY_FILE_NAME: &str = "library.json";
pub const COVER_CACHE_DIR_NAME: &str = "covers";

/// Argument the autostart entry carries when the app is asked to start out of sight.
pub const MINIMIZED_ARG: &str = "--minimized";

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";

/// Whether closing the window leaves the app in the tray instead of quitting it.
///
/// The setting itself lives in the frontend store; the window is closed by the system too,
/// through Alt+F4 or the taskbar, so the answer has to be readable from here as well.
#[derive(Debug, Default)]
pub struct CloseToTray(AtomicBool);

impl CloseToTray {
    pub fn set(&self, enabled: bool) {
        self.0.store(enabled, Ordering::Relaxed);
    }

    pub fn is_enabled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

/// Brings the window back from the tray, wherever it was left.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
}

/// The tray menu, rebuilt whenever the interface changes language.
pub fn tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    show: &str,
    quit: &str,
) -> tauri::Result<Menu<R>> {
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", show, true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", quit, true, None::<&str>)?,
        ],
    )
}

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().ok_or_else(|| {
            tauri::Error::AssetNotFound("the window icon is needed for the tray".to_owned())
        })?)
        .tooltip("Media Audio Lib")
        .menu(&tray_menu(app, "Show", "Quit")?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // The left click is the shortcut back to the window; the menu answers the right one.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Starts the Tauri shell with the registered commands.
///
/// # Panics
/// Aborts when the Tauri configuration is invalid: the application cannot start at all.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .manage(CloseToTray::default())
        .setup(|app| {
            build_tray(app.handle())?;

            // Started by the system with the window out of sight: it waits in the tray.
            if std::env::args().any(|argument| argument == MINIMIZED_ARG) {
                hide_main_window(app.handle());
            }

            let data_directory = app.path().app_data_dir()?;
            let catalog = CatalogState::open(
                data_directory.clone(),
                &data_directory.join(LIBRARY_FILE_NAME),
            );
            app.manage(LibraryState::from_file(catalog.active_file()?));
            app.manage(catalog);

            let cache_directory = app.path().app_cache_dir()?;
            app.manage(CoverCache::new(cache_directory.join(COVER_CACHE_DIR_NAME)));

            Ok(())
        })
        // Closing the window only quits the app when the tray is not holding it.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW && window.state::<CloseToTray>().is_enabled() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::window::set_close_to_tray,
            commands::window::set_tray_labels,
            commands::library::library_info,
            commands::library::rename_library,
            commands::library::add_tracks,
            commands::library::remove_track,
            commands::library::list_tracks,
            commands::library::verify_track_file,
            commands::library::export_track_list,
            commands::metadata::read_metadata,
            commands::metadata::get_cover,
            commands::metadata::write_metadata,
            commands::metadata::write_cover,
            commands::playback::prepare_playback,
            commands::playback::prepare_external_playback,
            commands::playback::startup_audio_file,
            commands::catalog::list_libraries,
            commands::catalog::create_library,
            commands::catalog::switch_library,
            commands::catalog::delete_library,
            commands::catalog::export_library,
            commands::catalog::import_library,
        ])
        .run(tauri::generate_context!())
        .expect("avvio dell'applicazione Tauri fallito");
}
