//! Media Audio Lib core.
//!
//! The binary only calls [`run`]; all logic lives here so it stays testable with `cargo test`.

pub mod commands;
pub mod error;

pub use error::{AppError, AppResult};

/// Starts the Tauri shell with the registered commands.
///
/// # Panics
/// Aborts when the Tauri configuration is invalid: the application cannot start at all.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![commands::app_info])
        .run(tauri::generate_context!())
        .expect("avvio dell'applicazione Tauri fallito");
}
