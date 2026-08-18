//! Media Audio Lib core.
//!
//! The binary only calls [`run`]; all logic lives here so it stays testable with `cargo test`.

pub mod commands;
pub mod error;
pub mod library;
pub mod metadata;
pub mod state;

#[cfg(test)]
pub mod fixtures;

pub use error::{AppError, AppResult};

use tauri::Manager as _;

use crate::state::LibraryState;

pub const LIBRARY_FILE_NAME: &str = "library.json";

/// Starts the Tauri shell with the registered commands.
///
/// # Panics
/// Aborts when the Tauri configuration is invalid: the application cannot start at all.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            app.manage(LibraryState::from_file(directory.join(LIBRARY_FILE_NAME)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::library::add_tracks,
            commands::library::remove_track,
            commands::library::list_tracks,
            commands::metadata::read_metadata,
            commands::metadata::get_cover,
            commands::metadata::write_metadata,
            commands::metadata::write_cover,
        ])
        .run(tauri::generate_context!())
        .expect("avvio dell'applicazione Tauri fallito");
}
