//! Metadata commands. The parsing and writing live in [`crate::metadata`].
//!
//! The commands are thin wrappers around free functions that take `&LibraryState`,
//! so the orchestration stays testable without booting a Tauri application.

use std::path::{Path, PathBuf};

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::library::{self, Track};
use crate::metadata::{self, Cover, MetadataUpdate, TrackMetadata};
use crate::state::LibraryState;

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

/// Reads the tags of a single file, even before it enters the library.
#[tauri::command]
pub fn read_metadata(path: String) -> AppResult<TrackMetadata> {
    metadata::read_metadata(Path::new(&path))
}

/// Returns the embedded cover art, base64 encoded, or nothing when there is none.
#[tauri::command]
pub fn get_cover(path: String) -> AppResult<Option<Cover>> {
    metadata::read_cover(Path::new(&path))
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
    use super::*;
    use crate::fixtures::{png_cover_base64, wav_with_cover, wav_with_tags, TempDir};
    use crate::library::{self, Library};

    /// A library state holding a single freshly imported track.
    fn state_with_track(dir: &TempDir, file: PathBuf) -> (LibraryState, String) {
        let state = LibraryState::from_file(dir.path().join("library.json"));
        state
            .update(|lib| library::add_paths(lib, &[file.display().to_string()], 0))
            .expect("import riuscito");

        let id = state
            .read(|lib| lib.tracks()[0].id.clone())
            .expect("lettura riuscita");

        (state, id)
    }

    fn update() -> MetadataUpdate {
        MetadataUpdate {
            title: "Titolo modificato".to_owned(),
            album: Some("Album modificato".to_owned()),
            year: Some(2012),
            genre: Some("Blues".to_owned()),
        }
    }

    #[test]
    fn legge_i_metadati_da_un_percorso() {
        let dir = TempDir::new("commands-metadata");
        let path = wav_with_tags(dir.path(), "brano.wav");

        let metadata = read_metadata(path.display().to_string()).expect("lettura riuscita");

        assert_eq!(metadata.title.as_deref(), Some("Titolo di prova"));
    }

    #[test]
    fn legge_la_copertina_da_un_percorso() {
        let dir = TempDir::new("commands-cover");
        let path = wav_with_cover(dir.path(), "brano.wav");

        let cover = get_cover(path.display().to_string()).expect("lettura riuscita");

        assert_eq!(
            cover.map(|cover| cover.mime_type),
            Some("image/png".to_owned())
        );
    }

    #[test]
    fn riporta_l_errore_per_un_percorso_inesistente() {
        assert!(read_metadata("C:/musica/assente.mp3".to_owned()).is_err());
    }

    #[test]
    fn la_modifica_aggiorna_file_e_libreria() {
        let dir = TempDir::new("edit-metadata");
        let file = wav_with_tags(dir.path(), "brano.wav");
        let (state, id) = state_with_track(&dir, file.clone());

        let updated = edit_metadata(&state, &id, &update()).expect("modifica riuscita");

        assert_eq!(updated.title, "Titolo modificato");
        assert_eq!(updated.year, Some(2012));
        assert_eq!(
            metadata::read_metadata(&file)
                .expect("rilettura")
                .title
                .as_deref(),
            Some("Titolo modificato")
        );
    }

    #[test]
    fn la_modifica_resta_dopo_un_riavvio() {
        let dir = TempDir::new("edit-persisted");
        let file = wav_with_tags(dir.path(), "brano.wav");
        let (state, id) = state_with_track(&dir, file);

        edit_metadata(&state, &id, &update()).expect("modifica riuscita");

        let reloaded = Library::load(&dir.path().join("library.json")).expect("ricaricata");
        assert_eq!(
            reloaded.get(&id).expect("presente").title,
            "Titolo modificato"
        );
    }

    #[test]
    fn la_copertina_modificata_aggiorna_la_libreria() {
        let dir = TempDir::new("edit-cover");
        let file = crate::fixtures::mp3_with_tags(dir.path(), "brano.mp3");
        let (state, id) = state_with_track(&dir, file);
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        let with_cover = edit_cover(&state, &id, Some(&cover)).expect("scrittura riuscita");
        assert!(with_cover.has_cover);

        let without_cover = edit_cover(&state, &id, None).expect("rimozione riuscita");
        assert!(!without_cover.has_cover);
    }

    #[test]
    fn rifiuta_la_modifica_di_un_brano_non_tracciato() {
        let dir = TempDir::new("edit-unknown");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        assert!(matches!(
            edit_metadata(&state, "sconosciuto", &update()).unwrap_err(),
            AppError::NotFound(_)
        ));
        assert!(matches!(
            edit_cover(&state, "sconosciuto", None).unwrap_err(),
            AppError::NotFound(_)
        ));
    }

    #[test]
    fn un_aggiornamento_non_valido_lascia_la_libreria_invariata() {
        let dir = TempDir::new("edit-invalid");
        let file = wav_with_tags(dir.path(), "brano.wav");
        let (state, id) = state_with_track(&dir, file);
        let invalid = MetadataUpdate {
            title: "  ".to_owned(),
            ..update()
        };

        assert!(matches!(
            edit_metadata(&state, &id, &invalid).unwrap_err(),
            AppError::Validation(_)
        ));
        assert_eq!(
            state
                .read(|lib| lib.get(&id).expect("presente").title.clone())
                .expect("lettura"),
            "Titolo di prova"
        );
    }
}
