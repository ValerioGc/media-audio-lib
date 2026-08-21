//! Window behaviour the frontend decides but the shell has to enforce.

use tauri::{AppHandle, Runtime, State};

use crate::{tray_menu, CloseToTray};

/// Whether closing the window hides the app in the tray instead of quitting it.
///
/// The setting lives in the frontend store, but the window is also closed by the system,
/// so the choice is mirrored here for the close handler to read.
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.set(enabled);
}

/// Writes the tray menu in the language of the interface.
#[tauri::command]
pub fn set_tray_labels<R: Runtime>(
    app: AppHandle<R>,
    show: String,
    stop: String,
    quit: String,
) -> bool {
    let Some(tray) = app.tray_by_id("main") else {
        return false;
    };

    match tray_menu(&app, &show, &stop, &quit) {
        Ok(menu) => tray.set_menu(Some(menu)).is_ok(),
        Err(_) => false,
    }
}
