//! Library commands. The logic lives in [`crate::library`]; these only bridge Tauri.

use std::path::PathBuf;

use tauri::State;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::library::{self, AddReport, TrackView};
use crate::state::LibraryState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryInfo {
    pub name: String,
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
        TrackListExportField::Title => "Nome",
        TrackListExportField::Artist => "Autore",
        TrackListExportField::Album => "Album",
        TrackListExportField::Year => "Anno",
        TrackListExportField::Genre => "Genere",
        TrackListExportField::Duration => "Durata",
        TrackListExportField::Format => "Formato",
        TrackListExportField::Path => "Percorso",
        TrackListExportField::Missing => "File mancante",
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
                "si".to_owned()
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
        return Err(AppError::Validation(
            "percorso di destinazione mancante".to_owned(),
        ));
    }

    if fields.is_empty() {
        return Err(AppError::Validation(
            "seleziona almeno una informazione da esportare".to_owned(),
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
    use super::*;
    use crate::fixtures::{wav_with_tags, TempDir};
    use crate::library::{Library, Track};

    #[test]
    fn il_ciclo_completo_aggiunge_elenca_e_rimuove() {
        let dir = TempDir::new("commands-library");
        let brano = wav_with_tags(dir.path(), "brano.wav");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        let report = state
            .update(|library| {
                library::add_paths(
                    library,
                    &[brano.display().to_string()],
                    library::now_seconds(),
                )
            })
            .expect("import riuscito");
        assert_eq!(report.added.len(), 1);

        let views = state.read(library::to_views).expect("lettura riuscita");
        assert_eq!(views.len(), 1);
        assert!(!views[0].missing);

        let id = views[0].track.id.clone();
        let removed = state
            .update(|library: &mut Library| library.remove(&id))
            .expect("rimozione riuscita");

        assert!(removed);
        assert!(state.read(Library::is_empty).expect("lettura riuscita"));
        assert!(brano.exists());
    }

    #[test]
    fn rinomina_la_libreria_e_restituisce_le_info() {
        let dir = TempDir::new("commands-library-name");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        state
            .update(|library| library.rename("Archivio"))
            .expect("update riuscito")
            .expect("rinomina riuscita");

        let info = state.read(info_of).expect("lettura riuscita");

        assert_eq!(info.name, "Archivio");
    }

    #[test]
    fn verifica_un_file_tracciato() {
        let dir = TempDir::new("commands-library-verify");
        let brano = wav_with_tags(dir.path(), "brano.wav");
        let state = LibraryState::from_file(dir.path().join("library.json"));
        state
            .update(|library| {
                library::add_paths(
                    library,
                    &[brano.display().to_string()],
                    library::now_seconds(),
                )
            })
            .expect("import riuscito");
        let id = state
            .read(|library| library.tracks()[0].id.clone())
            .expect("lettura riuscita");

        let present = state
            .read(|library| library::view_of(library, &id))
            .expect("lettura riuscita")
            .expect("brano presente");
        assert!(!present.missing);

        std::fs::remove_file(&brano).expect("file rimosso");

        let missing = state
            .read(|library| library::view_of(library, &id))
            .expect("lettura riuscita")
            .expect("brano presente");
        assert!(missing.missing);
    }

    #[test]
    fn esporta_elenco_brani_in_csv_con_escape() {
        let tracks = vec![TrackView {
            track: Track {
                id: "aaa".to_owned(),
                path: "C:/musica/brano,uno.mp3".to_owned(),
                title: "Brano, \"uno\"".to_owned(),
                artist: Some("Autore".to_owned()),
                album: None,
                year: Some(2000),
                genre: None,
                duration_ms: 185_000,
                format: "mp3".to_owned(),
                has_cover: false,
                added_at: 1,
            },
            missing: true,
        }];

        let contents = export_contents(
            &tracks,
            TrackListExportFormat::Csv,
            &[
                TrackListExportField::Title,
                TrackListExportField::Path,
                TrackListExportField::Missing,
            ],
        );

        assert_eq!(
            contents,
            "Nome,Percorso,File mancante\n\"Brano, \"\"uno\"\"\",\"C:/musica/brano,uno.mp3\",si"
        );
    }

    #[test]
    fn esporta_elenco_brani_in_txt() {
        let tracks = vec![TrackView {
            track: Track {
                id: "aaa".to_owned(),
                path: "C:/musica/brano.mp3".to_owned(),
                title: "Brano".to_owned(),
                artist: None,
                album: None,
                year: None,
                genre: None,
                duration_ms: 185_000,
                format: "mp3".to_owned(),
                has_cover: false,
                added_at: 1,
            },
            missing: false,
        }];

        let contents = export_contents(
            &tracks,
            TrackListExportFormat::Txt,
            &[TrackListExportField::Title, TrackListExportField::Duration],
        );

        assert_eq!(contents, "Nome: Brano\nDurata: 3:05");
    }
}
