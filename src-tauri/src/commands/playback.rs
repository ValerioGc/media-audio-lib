//! Playback source: turns a track id into a file the webview is allowed to load.
//!
//! The asset protocol starts with an empty scope; every playable file is granted one at a
//! time, so the webview never gets blanket access to the disk.

use std::path::PathBuf;

use tauri::{AppHandle, Manager as _, Runtime, State};

use crate::error::{AppError, AppResult};
use crate::library::{self, Library};
use crate::state::LibraryState;

/// Path of a track that can actually be played, refusing entries whose file is gone.
pub fn playable_path(library: &Library, id: &str) -> AppResult<PathBuf> {
    let path = library::path_of(library, id).ok_or_else(|| AppError::NotFound(id.to_owned()))?;

    if !path.is_file() {
        return Err(AppError::NotFound(path.to_string_lossy().into_owned()));
    }

    Ok(path)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{mp3_with_tags, TempDir};
    use crate::library::Track;

    fn library_with(path: &std::path::Path) -> Library {
        let mut library = Library::new();
        library.tracks.push(Track {
            id: "id-1".to_owned(),
            path: path.to_string_lossy().into_owned(),
            title: "Track".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 0,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 0,
        });

        library
    }

    #[test]
    fn returns_the_path_of_a_present_track() {
        let directory = TempDir::new("playback");
        let file = mp3_with_tags(directory.path(), "track");
        let library = library_with(&file);

        let path = playable_path(&library, "id-1").expect("path risolto");

        assert_eq!(path, file);
    }

    #[test]
    fn rejects_an_unknown_id() {
        let library = Library::new();

        let error = playable_path(&library, "id-ignoto").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(id) if id == "id-ignoto"));
    }

    #[test]
    fn rejects_a_track_whose_file_disappeared() {
        let directory = TempDir::new("playback");
        let file = mp3_with_tags(directory.path(), "sparito");
        let library = library_with(&file);
        std::fs::remove_file(&file).expect("file removed");

        let error = playable_path(&library, "id-1").expect_err("missing file");

        assert!(matches!(error, AppError::NotFound(_)));
    }
}
