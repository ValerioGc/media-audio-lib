//! Metadata commands. The parsing and writing live in [`crate::metadata`].
//!
//! The commands are thin wrappers around free functions that take `&LibraryState`,
//! so the orchestration stays testable without booting a Tauri application.

use std::path::{Path, PathBuf};

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::library::{self, Track};
use crate::metadata::{self, Cover, CoverCache, MetadataUpdate, TrackMetadata};
use crate::state::LibraryState;

fn tracked_path(state: &LibraryState, id: &str) -> AppResult<PathBuf> {
    state
        .read(|library| library::path_of(library, id))?
        .ok_or_else(|| AppError::NotFound(format!("track {id} not present in the library")))
}

/// Mirrors freshly written tags onto the library entry and persists it.
fn store_metadata(state: &LibraryState, id: &str, written: TrackMetadata) -> AppResult<Track> {
    state
        .update(|library| library::apply_metadata(library, id, written))?
        .ok_or_else(|| AppError::NotFound(format!("track {id} not present in the library")))
}

pub fn edit_metadata(state: &LibraryState, id: &str, update: &MetadataUpdate) -> AppResult<Track> {
    let path = tracked_path(state, id)?;
    let written = metadata::write::write_metadata(&path, update)?;

    store_metadata(state, id, written)
}

pub fn edit_cover(state: &LibraryState, id: &str, cover: Option<&Cover>) -> AppResult<Track> {
    let path = tracked_path(state, id)?;
    let written = metadata::write::write_cover(&path, cover)?;

    store_metadata(state, id, written)
}

/// Reads the tags of a single file, even before it enters the library.
#[tauri::command]
pub fn read_metadata(path: String) -> AppResult<TrackMetadata> {
    metadata::read_metadata(Path::new(&path))
}

/// Returns the embedded cover art, base64 encoded, or nothing when there is none.
/// Served from the on-disk cache when the file has not changed since the last read.
#[tauri::command]
pub fn get_cover(cache: State<'_, CoverCache>, path: String) -> AppResult<Option<Cover>> {
    cache.load(Path::new(&path))
}

/// Writes title, album, year and genre to the audio file.
#[tauri::command]
pub fn write_metadata(
    state: State<'_, LibraryState>,
    id: String,
    update: MetadataUpdate,
) -> AppResult<Track> {
    edit_metadata(&state, &id, &update)
}

/// Replaces the embedded cover art, or removes it when `cover` is absent.
#[tauri::command]
pub fn write_cover(
    state: State<'_, LibraryState>,
    id: String,
    cover: Option<Cover>,
) -> AppResult<Track> {
    edit_cover(&state, &id, cover.as_ref())
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/metadata.rs");
}
