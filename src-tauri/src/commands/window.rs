//! Window behaviour the frontend decides but the shell has to enforce.

use tauri::{AppHandle, Manager as _, Runtime, State, WebviewUrl, WebviewWindowBuilder};

use crate::{tray_menu, CloseToTray, MINI_SIZE, MINI_SIZE_VERTICAL, MINI_WINDOW};

/// The two ways the dock lays out its controls.
fn mini_size(vertical: bool) -> (f64, f64) {
    if vertical {
        MINI_SIZE_VERTICAL
    } else {
        MINI_SIZE
    }
}

/// Whether closing the window hides the app in the tray instead of quitting it.
///
/// The setting lives in the frontend store, but the window is also closed by the system,
/// so the choice is mirrored here for the close handler to read.
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.set(enabled);
}

/// Opens the floating dock, or brings back the one already there.
///
/// A window of its own: the main one is on its way to the tray, and a webview goes with the
/// window that holds it. The playback stays where it is — the dock only asks for things.
#[tauri::command]
pub async fn open_mini_player<R: Runtime>(
    app: AppHandle<R>,
    vertical: bool,
    always_on_top: bool,
) -> bool {
    if let Some(window) = app.get_webview_window(MINI_WINDOW) {
        let _ = window.set_always_on_top(always_on_top);
        let _ = window.show();
        let _ = window.set_focus();

        return true;
    }

    let (width, height) = mini_size(vertical);

    WebviewWindowBuilder::new(
        &app,
        MINI_WINDOW,
        WebviewUrl::App("index.html?view=mini".into()),
    )
    .title("Media Audio Lib")
    .inner_size(width, height)
    .resizable(false)
    .decorations(false)
    .always_on_top(always_on_top)
    .skip_taskbar(true)
    .shadow(true)
    .build()
    .is_ok()
}

#[tauri::command]
pub fn close_mini_player<R: Runtime>(app: AppHandle<R>) -> bool {
    app.get_webview_window(MINI_WINDOW)
        .map(|window| window.close().is_ok())
        .unwrap_or(false)
}

/// Applies what the dock menu changed: the side it lays out along, and the front it keeps.
#[tauri::command]
pub fn set_mini_player_shape<R: Runtime>(
    app: AppHandle<R>,
    vertical: bool,
    always_on_top: bool,
) -> bool {
    let Some(window) = app.get_webview_window(MINI_WINDOW) else {
        return false;
    };

    let (width, height) = mini_size(vertical);
    let _ = window.set_always_on_top(always_on_top);

    window
        .set_size(tauri::LogicalSize::new(width, height))
        .is_ok()
}

/// Closes the app for good, dock included: asked from the dock, which has no other way out.
#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

/// Writes the tray menu in the language of the interface, and in the state of the player.
#[tauri::command]
pub fn set_tray_menu<R: Runtime>(
    app: AppHandle<R>,
    show: String,
    stop: String,
    quit: String,
    can_stop: bool,
) -> bool {
    let Some(tray) = app.tray_by_id("main") else {
        return false;
    };

    match tray_menu(&app, &show, &stop, &quit, can_stop) {
        Ok(menu) => tray.set_menu(Some(menu)).is_ok(),
        Err(_) => false,
    }
}
