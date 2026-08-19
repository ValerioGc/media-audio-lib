//! Library commands. The logic lives in [`crate::library`]; these only bridge Tauri.

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

fn info_of(library: &library::Library) -> LibraryInfo {
    LibraryInfo {
        name: library.name.clone(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{wav_with_tags, TempDir};
    use crate::library::Library;

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
}
