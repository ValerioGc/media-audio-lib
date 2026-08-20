//! Library commands. The logic lives in [`crate::library`]; these only bridge Tauri.

use std::path::PathBuf;

use tauri::State;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::library::{self, AddReport, LibraryMetadata, TrackView};
use crate::state::LibraryState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryInfo {
    pub name: String,
    pub metadata: LibraryMetadata,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackListExportFormat {
    Csv,
    Txt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackListExportField {
    Title,
    Artist,
    Album,
    Year,
    Genre,
    Duration,
    Format,
    Path,
    Missing,
}

fn info_of(library: &library::Library) -> LibraryInfo {
    LibraryInfo {
        name: library.name.clone(),
        metadata: library.metadata().clone(),
    }
}

fn format_duration(duration_ms: u64) -> String {
    let total_seconds = duration_ms / 1000;
    let seconds = total_seconds % 60;
    let minutes = (total_seconds / 60) % 60;
    let hours = total_seconds / 3600;

    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes}:{seconds:02}")
    }
}

fn field_header(field: TrackListExportField) -> &'static str {
    match field {
        TrackListExportField::Title => "Name",
        TrackListExportField::Artist => "Artist",
        TrackListExportField::Album => "Album",
        TrackListExportField::Year => "Year",
        TrackListExportField::Genre => "Genre",
        TrackListExportField::Duration => "Duration",
        TrackListExportField::Format => "Format",
        TrackListExportField::Path => "Path",
        TrackListExportField::Missing => "Missing file",
    }
}

fn field_value(track: &TrackView, field: TrackListExportField) -> String {
    match field {
        TrackListExportField::Title => track.track.title.clone(),
        TrackListExportField::Artist => track.track.artist.clone().unwrap_or_default(),
        TrackListExportField::Album => track.track.album.clone().unwrap_or_default(),
        TrackListExportField::Year => track
            .track
            .year
            .map(|year| year.to_string())
            .unwrap_or_default(),
        TrackListExportField::Genre => track.track.genre.clone().unwrap_or_default(),
        TrackListExportField::Duration => format_duration(track.track.duration_ms),
        TrackListExportField::Format => track.track.format.clone(),
        TrackListExportField::Path => track.track.path.clone(),
        TrackListExportField::Missing => {
            if track.missing {
                "yes".to_owned()
            } else {
                "no".to_owned()
            }
        }
    }
}

fn csv_cell(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_owned()
    }
}

fn export_contents(
    tracks: &[TrackView],
    format: TrackListExportFormat,
    fields: &[TrackListExportField],
) -> String {
    match format {
        TrackListExportFormat::Csv => {
            let mut lines = vec![fields
                .iter()
                .map(|field| csv_cell(field_header(*field)))
                .collect::<Vec<_>>()
                .join(",")];

            lines.extend(tracks.iter().map(|track| {
                fields
                    .iter()
                    .map(|field| csv_cell(&field_value(track, *field)))
                    .collect::<Vec<_>>()
                    .join(",")
            }));

            lines.join("\n")
        }
        TrackListExportFormat::Txt => tracks
            .iter()
            .map(|track| {
                fields
                    .iter()
                    .map(|field| {
                        format!("{}: {}", field_header(*field), field_value(track, *field))
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .collect::<Vec<_>>()
            .join("\n\n"),
    }
}

/// Returns metadata about the active library.
#[tauri::command]
pub fn library_info(state: State<'_, LibraryState>) -> AppResult<LibraryInfo> {
    state.read(info_of)
}

/// Renames the active library.
#[tauri::command]
pub fn rename_library(state: State<'_, LibraryState>, name: String) -> AppResult<LibraryInfo> {
    state.update(|library| library.rename(&name))??;
    state.read(info_of)
}

/// Imports the given files, skipping duplicates and reporting the failures.
#[tauri::command]
pub fn add_tracks(state: State<'_, LibraryState>, paths: Vec<String>) -> AppResult<AddReport> {
    state.update(|library| library::add_paths(library, &paths, library::now_seconds()))
}

/// Removes a track from the library without touching the file on disk.
#[tauri::command]
pub fn remove_track(state: State<'_, LibraryState>, id: String) -> AppResult<bool> {
    state.update(|library| library.remove(&id))
}

/// Lists the tracked files, flagging the ones that are no longer on disk.
#[tauri::command]
pub fn list_tracks(state: State<'_, LibraryState>) -> AppResult<Vec<TrackView>> {
    state.read(library::to_views)
}

/// Checks whether one tracked file still exists on disk.
#[tauri::command]
pub fn verify_track_file(state: State<'_, LibraryState>, id: String) -> AppResult<TrackView> {
    state
        .read(|library| library::view_of(library, &id))?
        .ok_or(AppError::NotFound(id))
}

/// Exports the active library track list with the chosen columns.
#[tauri::command]
pub fn export_track_list(
    state: State<'_, LibraryState>,
    destination: String,
    format: TrackListExportFormat,
    fields: Vec<TrackListExportField>,
) -> AppResult<String> {
    if destination.trim().is_empty() {
        return Err(AppError::Validation("missing destination path".to_owned()));
    }

    if fields.is_empty() {
        return Err(AppError::Validation(
            "select at least one field to export".to_owned(),
        ));
    }

    let tracks = state.read(library::to_views)?;
    let destination = PathBuf::from(destination);

    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(&destination, export_contents(&tracks, format, &fields))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/library.rs");
}
