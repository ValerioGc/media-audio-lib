//! Playback source: turns a track id into a file the webview is allowed to load.
//!
//! The asset protocol starts with an empty scope; every playable file is granted one at a
//! time, so the webview never gets blanket access to the disk.
//!
//! A grant lasts as long as the app runs. Tauri can forbid a path, but a forbidden path
//! stays forbidden and outranks every later grant, so taking one back would leave a track
//! unplayable for the rest of the session if the user imported the same file again. The
//! grants are therefore only ever added, and only for a file that is in the library and is
//! audio at the moment it is asked for.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager as _, Runtime, State};

use crate::error::{AppError, AppResult};
use crate::library::{self, Library, Track, TrackView};
use crate::metadata;
use crate::state::{LibraryState, StartupFile};

/// Path of a track that can actually be played, refusing entries whose file is gone.
///
/// Granting the asset protocol a file is the one thing that hands the webview the raw
/// bytes of something on disk, so what is granted has to be an audio file this app knows —
/// being listed in the library is not on its own enough.
pub fn playable_path(library: &Library, id: &str) -> AppResult<PathBuf> {
    let path = library::path_of(library, id).ok_or_else(|| AppError::NotFound(id.to_owned()))?;

    metadata::ensure_importable(&path)?;

    Ok(path)
}

fn playable_file_path(path: &Path) -> AppResult<PathBuf> {
    metadata::ensure_importable(path)?;

    Ok(path.to_path_buf())
}

fn standalone_track(path: &Path) -> AppResult<TrackView> {
    let metadata = metadata::read_metadata(path)?;
    let track = Track::new(path, metadata, library::now_seconds());

    Ok(TrackView {
        track,
        missing: false,
    })
}

/// Grants the webview access to one track and returns its path.
#[tauri::command]
pub fn prepare_playback<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<String> {
    let path = state.read(|library| playable_path(library, &id))??;

    grant_access(&app, &path)?;

    Ok(path.to_string_lossy().into_owned())
}

/// Lets the webview read one file, once.
///
/// Playing the same track again asks for the same grant, and the scope keeps every pattern
/// it is given: without this a long listening session would leave the list of allowed
/// patterns growing behind it, and every check walks that list.
fn grant_access<R: Runtime>(app: &AppHandle<R>, path: &Path) -> AppResult<()> {
    let scope = app.asset_protocol_scope();

    if scope.is_allowed(path) {
        return Ok(());
    }

    scope
        .allow_file(path)
        .map_err(|error| AppError::State(error.to_string()))
}

/// Reads the audio file passed by the operating system when this app is opened as
/// the default player.
#[tauri::command]
pub fn startup_audio_file(startup: State<'_, StartupFile>) -> AppResult<Option<TrackView>> {
    let Some(path) = startup.path() else {
        return Ok(None);
    };

    standalone_track(&path).map(Some)
}

/// Grants the webview access to the file the app was opened with.
///
/// It takes no path: the only file outside the library the app ever plays is the one the
/// system handed it, and that one is known here.
#[tauri::command]
pub fn prepare_external_playback<R: Runtime>(
    app: AppHandle<R>,
    startup: State<'_, StartupFile>,
) -> AppResult<String> {
    let path = startup.path().ok_or_else(|| {
        AppError::NotFound("nessun file è stato passato all'applicazione".to_owned())
    })?;
    let path = playable_file_path(&path)?;

    grant_access(&app, &path)?;

    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/playback.rs");
}
