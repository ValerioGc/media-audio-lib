//! Shared library state, guarded by a mutex and mirrored on disk.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use crate::error::{AppError, AppResult};
use crate::library::Library;

pub struct LibraryState {
    file: PathBuf,
    library: Mutex<Library>,
}

impl LibraryState {
    pub fn new(file: PathBuf, library: Library) -> Self {
        Self {
            file,
            library: Mutex::new(library),
        }
    }

    /// Loads the library from `file`, starting empty when it cannot be read.
    ///
    /// Entries saved with an older schema are missing the fields added since, so their
    /// tags are re-read from disk once and the file is rewritten.
    pub fn from_file(file: PathBuf) -> Self {
        let (library, stored_version) = Library::load_with_version(&file).unwrap_or_else(|error| {
            eprintln!("libreria non caricata ({error}), si riparte da una vuota");
            (Library::new(), crate::library::SCHEMA_VERSION)
        });

        let state = Self::new(file, library);

        if stored_version < crate::library::SCHEMA_VERSION {
            match state.update(crate::library::refresh_metadata) {
                Ok(refreshed) => {
                    eprintln!(
                        "libreria migrata a v{}: {refreshed} brani riletti dai file",
                        crate::library::SCHEMA_VERSION
                    );
                }
                Err(error) => eprintln!("migrazione della libreria non riuscita: {error}"),
            }
        }

        state
    }

    pub fn file(&self) -> &Path {
        &self.file
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Library>> {
        self.library
            .lock()
            .map_err(|error| AppError::State(error.to_string()))
    }

    pub fn read<T>(&self, action: impl FnOnce(&Library) -> T) -> AppResult<T> {
        Ok(action(&*self.lock()?))
    }

    /// Applies a change and writes the library back to disk before returning.
    pub fn update<T>(&self, action: impl FnOnce(&mut Library) -> T) -> AppResult<T> {
        let mut library = self.lock()?;
        let outcome = action(&mut library);
        library.save(&self.file)?;

        Ok(outcome)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::TempDir;
    use crate::library::Track;

    fn sample_track() -> Track {
        Track {
            id: "aaa".to_owned(),
            path: "C:/musica/brano.mp3".to_owned(),
            title: "Titolo".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 0,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 0,
        }
    }

    #[test]
    fn parte_da_una_libreria_vuota_quando_il_file_non_esiste() {
        let dir = TempDir::new("state-empty");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        assert_eq!(state.read(Library::len).expect("lettura riuscita"), 0);
    }

    #[test]
    fn ricarica_la_libreria_gia_salvata() {
        let dir = TempDir::new("state-reload");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track());
        library.save(&file).expect("salvataggio riuscito");

        let state = LibraryState::from_file(file);

        assert_eq!(state.read(Library::len).expect("lettura riuscita"), 1);
    }

    #[test]
    fn riparte_da_vuota_se_il_file_e_illeggibile() {
        let dir = TempDir::new("state-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ non valido").expect("file scritto");

        let state = LibraryState::from_file(file);

        assert_eq!(state.read(Library::len).expect("lettura riuscita"), 0);
    }

    #[test]
    fn ogni_modifica_finisce_su_disco() {
        let dir = TempDir::new("state-update");
        let file = dir.path().join("library.json");
        let state = LibraryState::from_file(file.clone());

        let added = state
            .update(|library| library.add(sample_track()))
            .expect("aggiornamento riuscito");

        assert!(added);
        assert_eq!(Library::load(&file).expect("caricamento").len(), 1);
    }

    #[test]
    fn una_libreria_v1_viene_migrata_rileggendo_i_tag_dal_file() {
        let dir = TempDir::new("state-migration");
        let file = dir.path().join("library.json");
        let brano = crate::fixtures::wav_with_tags(dir.path(), "brano.wav");
        let id = crate::library::track_id(&brano);

        // Una libreria v1: il campo autore non esisteva ancora.
        std::fs::write(
            &file,
            format!(
                r#"{{"version":1,"tracks":[{{"id":"{id}","path":{path},
                   "title":"Titolo","album":null,"year":null,"genre":null,
                   "durationMs":0,"format":"wav","hasCover":false,"addedAt":42}}]}}"#,
                path = serde_json::to_string(&brano.display().to_string()).expect("percorso"),
            ),
        )
        .expect("file scritto");

        let state = LibraryState::from_file(file.clone());

        let track = state
            .read(|library| library.get(&id).cloned())
            .expect("lettura riuscita")
            .expect("brano presente");
        assert_eq!(track.artist.as_deref(), Some("Autore di prova"));
        assert_eq!(track.title, "Titolo di prova");

        // La migrazione è persistita: al riavvio non serve rifarla.
        let reloaded = Library::load(&file).expect("ricaricata");
        assert_eq!(
            reloaded.get(&id).expect("presente").artist.as_deref(),
            Some("Autore di prova")
        );
        assert_eq!(reloaded.version, crate::library::SCHEMA_VERSION);
    }

    #[test]
    fn una_libreria_gia_aggiornata_non_viene_rimaneggiata() {
        let dir = TempDir::new("state-no-migration");
        let file = dir.path().join("library.json");
        let brano = crate::fixtures::wav_with_tags(dir.path(), "brano.wav");

        // Voce allo schema corrente, con un titolo diverso da quello nei tag del file:
        // se partisse una rilettura, verrebbe sovrascritto.
        let mut library = Library::new();
        library.add(Track {
            id: crate::library::track_id(&brano),
            path: brano.display().to_string(),
            title: "Titolo scelto dall'utente".to_owned(),
            ..sample_track()
        });
        library.save(&file).expect("salvataggio riuscito");

        let state = LibraryState::from_file(file);

        assert_eq!(
            state
                .read(|library| library.tracks()[0].title.clone())
                .expect("lettura"),
            "Titolo scelto dall'utente"
        );
    }

    #[test]
    fn espone_il_percorso_del_file_di_libreria() {
        let dir = TempDir::new("state-path");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());

        assert_eq!(state.file(), file);
    }
}
