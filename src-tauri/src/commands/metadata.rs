//! Metadata commands. The parsing and writing live in [`crate::metadata`].
//!
//! The commands are thin wrappers around free functions that take `&LibraryState`,
//! so the orchestration stays testable without booting a Tauri application.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::library::{self, Track};
use crate::metadata::{self, Cover, CoverCache, CoverRead, MetadataUpdate, TrackMetadata};
use crate::state::{LibraryState, StartupFile};

/// Whether a path is one the app already knows: a track of the open library, or the file
/// the system handed it at startup.
///
/// Every read of a file goes through here, so the interface cannot ask the shell to open
/// something the user never gave it.
fn ensure_known_file(
    state: &LibraryState,
    startup: &StartupFile,
    path: &Path,
) -> AppResult<PathBuf> {
    let key = library::canonical_key(path);

    let tracked = state.read(|library| {
        library
            .tracks()
            .iter()
            .any(|track| library::canonical_key(Path::new(&track.path)) == key)
    })?;

    let from_startup = startup
        .path()
        .is_some_and(|startup| library::canonical_key(&startup) == key);

    if tracked || from_startup {
        return Ok(path.to_path_buf());
    }

    Err(AppError::NotFound(format!(
        "{} non è un file di questa libreria",
        path.display()
    )))
}

fn tracked_path(state: &LibraryState, id: &str) -> AppResult<PathBuf> {
    state
        .read(|library| library::path_of(library, id))?
        .ok_or_else(|| AppError::NotFound(format!("brano {id} non presente in libreria")))
}

/// Mirrors freshly written tags onto the library entry and persists it.
fn store_metadata(state: &LibraryState, id: &str, written: TrackMetadata) -> AppResult<Track> {
    state
        .update(|library| library::apply_metadata(library, id, written))?
        .ok_or_else(|| AppError::NotFound(format!("brano {id} non presente in libreria")))
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

/// Returns the embedded cover art, base64 encoded, or nothing when there is none.
///
/// Served from the on-disk cache when the file has not changed since the last read, and
/// only for a file the library already holds.
#[tauri::command]
pub fn get_cover(
    cache: State<'_, CoverCache>,
    state: State<'_, LibraryState>,
    startup: State<'_, StartupFile>,
    path: String,
) -> AppResult<CoverRead> {
    let path = ensure_known_file(&state, &startup, Path::new(&path))?;

    cache.load(&path)
}

/// What the cover cache weighs, and how much it is allowed to weigh.
///
/// The limit travels with the size so the interface has nothing to remember: a number kept
/// in two places is a number that ends up disagreeing with itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverCacheReport {
    pub bytes: u64,
    pub limit_bytes: u64,
}

fn cache_report(cache: &CoverCache) -> CoverCacheReport {
    CoverCacheReport {
        bytes: cache.size_bytes(),
        limit_bytes: metadata::MAX_CACHE_BYTES,
    }
}

/// How much room the cover cache is taking on disk.
#[tauri::command]
pub fn cover_cache_size(cache: State<'_, CoverCache>) -> AppResult<CoverCacheReport> {
    Ok(cache_report(&cache))
}

/// Throws away every cached cover. The pictures are read again from the files as needed.
#[tauri::command]
pub fn clear_cover_cache(cache: State<'_, CoverCache>) -> AppResult<CoverCacheReport> {
    cache.clear()?;

    Ok(cache_report(&cache))
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
