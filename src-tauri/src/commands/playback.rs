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

    #[test]
    fn creates_a_standalone_track_from_an_audio_file() {
        let directory = TempDir::new("playback-standalone");
        let file = mp3_with_tags(directory.path(), "track.mp3");

        let track = standalone_track(&file).expect("standalone track");

        assert_eq!(track.track.path, file.display().to_string());
        assert_eq!(track.track.title, "Test Title");
        assert!(!track.missing);
    }

    #[test]
    fn rejects_an_external_file_that_is_not_audio() {
        let directory = TempDir::new("playback-external-unsupported");
        let file = directory.path().join("note.txt");
        std::fs::write(&file, b"text").expect("test file written");

        let error = playable_file_path(&file).expect_err("unsupported file");

        assert!(matches!(error, AppError::UnsupportedFormat(extension) if extension == "txt"));
    }

    #[test]
    fn finds_the_first_supported_startup_argument() {
        let directory = TempDir::new("playback-startup-args");
        let text = directory.path().join("note.txt");
        std::fs::write(&text, b"text").expect("test file written");
        let audio = mp3_with_tags(directory.path(), "track.mp3");

        let found = first_supported_audio_path([
            PathBuf::from("--flag"),
            text,
            audio.clone(),
            directory.path().join("missing.mp3"),
        ])
        .expect("audio path");

        assert_eq!(found, audio);
    }
}
