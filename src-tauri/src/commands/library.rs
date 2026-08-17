//! Library commands. The logic lives in [`crate::library`]; these only bridge Tauri.

use tauri::State;

use crate::error::AppResult;
use crate::library::{self, AddReport, TrackView};
use crate::state::LibraryState;

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
}
