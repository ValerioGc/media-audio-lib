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
    pub fn from_file(file: PathBuf) -> Self {
        let library = Library::load(&file).unwrap_or_else(|error| {
            eprintln!("libreria non caricata ({error}), si riparte da una vuota");
            Library::new()
        });

        Self::new(file, library)
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
    fn espone_il_percorso_del_file_di_libreria() {
        let dir = TempDir::new("state-path");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());

        assert_eq!(state.file(), file);
    }
}
