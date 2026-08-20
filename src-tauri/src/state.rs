//! Shared library state, guarded by a mutex and mirrored on disk.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use crate::error::{AppError, AppResult};
use crate::library::Library;

/// The library in memory together with the file it belongs to: switching library swaps
/// both at once, so a save can never land in the file of another library.
struct Active {
    file: PathBuf,
    library: Library,
}

pub struct LibraryState {
    active: Mutex<Active>,
}

impl LibraryState {
    pub fn new(file: PathBuf, library: Library) -> Self {
        Self {
            active: Mutex::new(Active { file, library }),
        }
    }

    /// Loads the library from `file`, starting empty when it cannot be read.
    ///
    /// Every app opening reconciles the saved list with the files on disk: ids are
    /// realigned to canonical paths, duplicate entries are removed, and readable tags are
    /// refreshed while missing files stay tracked for the UI to flag.
    pub fn from_file(file: PathBuf) -> Self {
        let library = load_or_empty(&file);
        let state = Self::new(file, library);
        state.maintain_from_disk();

        state
    }

    pub fn file(&self) -> AppResult<PathBuf> {
        Ok(self.lock()?.file.clone())
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Active>> {
        self.active
            .lock()
            .map_err(|error| AppError::State(error.to_string()))
    }

    pub fn read<T>(&self, action: impl FnOnce(&Library) -> T) -> AppResult<T> {
        Ok(action(&self.lock()?.library))
    }

    /// Applies a change and writes the library back to disk before returning.
    pub fn update<T>(&self, action: impl FnOnce(&mut Library) -> T) -> AppResult<T> {
        let mut active = self.lock()?;
        let outcome = action(&mut active.library);
        active.library.save(&active.file)?;

        Ok(outcome)
    }

    /// Loads another library file and makes it the current one.
    ///
    /// The library left behind needs no flush: every change is already written when it
    /// happens.
    pub fn switch_to(&self, file: PathBuf) -> AppResult<()> {
        let library = load_or_empty(&file);

        {
            let mut active = self.lock()?;
            active.file = file;
            active.library = library;
        }

        self.maintain_from_disk();

        Ok(())
    }

    fn maintain_from_disk(&self) {
        match self.update(crate::library::maintain_from_disk) {
            Ok(report) => {
                if report != crate::library::LibraryMaintenanceReport::default() {
                    eprintln!(
                        "library refreshed from disk: {} tracks reread, {} duplicate entries removed, {} ids realigned",
                        report.refreshed, report.deduplicated, report.ids_updated,
                    );
                }
            }
            Err(error) => eprintln!("library refresh failed: {error}"),
        }
    }
}

fn load_or_empty(file: &Path) -> Library {
    Library::load(file).unwrap_or_else(|error| {
        eprintln!("library not loaded ({error}), starting from an empty one");
        Library::new()
    })
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/state.rs");
}
