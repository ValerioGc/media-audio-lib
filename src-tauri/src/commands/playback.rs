//! Playback source: turns a track id into a file the webview is allowed to load.
//!
//! The asset protocol starts with an empty scope; every playable file is granted one at a
//! time, so the webview never gets blanket access to the disk.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager as _, Runtime, State};

use crate::error::{AppError, AppResult};
use crate::library::{self, Library, Track, TrackView};
use crate::metadata;
use crate::state::LibraryState;

/// Path of a track that can actually be played, refusing entries whose file is gone.
pub fn playable_path(library: &Library, id: &str) -> AppResult<PathBuf> {
    let path = library::path_of(library, id).ok_or_else(|| AppError::NotFound(id.to_owned()))?;

    if !path.is_file() {
        return Err(AppError::NotFound(path.to_string_lossy().into_owned()));
    }

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

fn first_supported_audio_path<I>(paths: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = PathBuf>,
{
    paths
        .into_iter()
        .find(|path| path.is_file() && metadata::is_supported(path))
}

/// Grants the webview access to one track and returns its path.
#[tauri::command]
pub fn prepare_playback<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<String> {
    let path = state.read(|library| playable_path(library, &id))??;

    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|error| AppError::State(error.to_string()))?;

    Ok(path.to_string_lossy().into_owned())
}

/// Reads the audio file passed by the operating system when this app is opened as
/// the default player.
#[tauri::command]
pub fn startup_audio_file() -> AppResult<Option<TrackView>> {
    let Some(path) = first_supported_audio_path(std::env::args_os().skip(1).map(PathBuf::from))
    else {
        return Ok(None);
    };

    standalone_track(&path).map(Some)
}

/// Grants the webview access to an audio file that is not part of the library.
#[tauri::command]
pub fn prepare_external_playback<R: Runtime>(app: AppHandle<R>, path: String) -> AppResult<String> {
    let path = playable_file_path(Path::new(&path))?;

    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|error| AppError::State(error.to_string()))?;

    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/playback.rs");
}
