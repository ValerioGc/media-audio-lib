//! The set of libraries the user can switch between.
//!
//! Each library keeps living in its own file: the catalog only records where they are and
//! which one is active, so a library file stays readable on its own.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::hash::fnv1a_hex;
use crate::library::now_seconds;

pub const CATALOG_FILE_NAME: &str = "libraries.json";
pub const LIBRARIES_DIR_NAME: &str = "libraries";
pub const CATALOG_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub file: String,
}

impl CatalogEntry {
    pub fn path(&self) -> PathBuf {
        PathBuf::from(&self.file)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub version: u32,
    pub active: String,
    pub entries: Vec<CatalogEntry>,
}

impl Catalog {
    pub fn with_entry(entry: CatalogEntry) -> Self {
        Self {
            version: CATALOG_VERSION,
            active: entry.id.clone(),
            entries: vec![entry],
        }
    }

    pub fn load(path: &Path) -> AppResult<Self> {
        let contents = std::fs::read_to_string(path)?;
        let catalog: Self = serde_json::from_str(&contents)?;

        if catalog.version > CATALOG_VERSION {
            return Err(AppError::UnsupportedFormat(format!(
                "catalog con schema v{} (supported up to v{CATALOG_VERSION})",
                catalog.version
            )));
        }

        Ok(catalog)
    }

    /// Writes through a temporary file, like the library itself.
    pub fn save(&self, path: &Path) -> AppResult<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut name = path.file_name().unwrap_or_default().to_os_string();
        name.push(".tmp");
        let temporary = path.with_file_name(name);

        std::fs::write(&temporary, serde_json::to_string_pretty(self)?)?;
        std::fs::rename(&temporary, path)?;

        Ok(())
    }

    pub fn entry(&self, id: &str) -> Option<&CatalogEntry> {
        self.entries.iter().find(|entry| entry.id == id)
    }

    pub fn active_entry(&self) -> AppResult<&CatalogEntry> {
        self.entry(&self.active)
            .ok_or_else(|| AppError::State(format!("unknown active library: {}", self.active)))
    }

    pub fn add(&mut self, entry: CatalogEntry) {
        self.entries.push(entry);
    }

    /// Activates one library, refusing an id that is not in the catalog.
    pub fn set_active(&mut self, id: &str) -> AppResult<()> {
        if self.entry(id).is_none() {
            return Err(AppError::NotFound(id.to_owned()));
        }

        self.active = id.to_owned();

        Ok(())
    }

    /// Removes one library, keeping the catalog usable: the last one cannot be removed and
    /// the active one falls back to whatever is left.
    pub fn remove(&mut self, id: &str) -> AppResult<CatalogEntry> {
        if self.entries.len() <= 1 {
            return Err(AppError::Validation(
                "the last library cannot be deleted".to_owned(),
            ));
        }

        let position = self
            .entries
            .iter()
            .position(|entry| entry.id == id)
            .ok_or_else(|| AppError::NotFound(id.to_owned()))?;

        let removed = self.entries.remove(position);

        if self.active == removed.id {
            self.active = self
                .entries
                .first()
                .map(|entry| entry.id.clone())
                .unwrap_or_default();
        }

        Ok(removed)
    }
}

/// Identifier of a library, stable once written into the catalog.
pub fn library_id(seed: &str) -> String {
    fnv1a_hex(&format!("{seed}-{}", now_seconds()))
}

pub fn library_file(directory: &Path, id: &str) -> PathBuf {
    directory
        .join(LIBRARIES_DIR_NAME)
        .join(format!("{id}.json"))
}

/// First catalog for an installation that never had one.
///
/// A library file written before multi library support keeps its place: it becomes the
/// first entry instead of being moved, so nothing has to be migrated on disk.
pub fn bootstrap(directory: &Path, legacy_file: &Path) -> Catalog {
    if legacy_file.exists() {
        return Catalog::with_entry(CatalogEntry {
            id: library_id("legacy"),
            file: legacy_file.to_string_lossy().into_owned(),
        });
    }

    let id = library_id("first");
    let file = library_file(directory, &id);

    Catalog::with_entry(CatalogEntry {
        id,
        file: file.to_string_lossy().into_owned(),
    })
}

/// Shared catalog, guarded by a mutex and mirrored on disk like the library.
pub struct CatalogState {
    directory: PathBuf,
    catalog: Mutex<Catalog>,
}

impl CatalogState {
    pub fn new(directory: PathBuf, catalog: Catalog) -> Self {
        Self {
            directory,
            catalog: Mutex::new(catalog),
        }
    }

    /// Loads the catalog, creating it the first time from whatever is already on disk.
    pub fn open(directory: PathBuf, legacy_file: &Path) -> Self {
        let file = directory.join(CATALOG_FILE_NAME);

        let catalog = if file.exists() {
            Catalog::load(&file).unwrap_or_else(|error| {
                eprintln!("catalog non caricato ({error}), se ne crea uno nuovo");
                bootstrap(&directory, legacy_file)
            })
        } else {
            bootstrap(&directory, legacy_file)
        };

        let state = Self::new(directory, catalog);

        if let Err(error) = state.save() {
            eprintln!("catalog non salvato: {error}");
        }

        state
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    pub fn file(&self) -> PathBuf {
        self.directory.join(CATALOG_FILE_NAME)
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Catalog>> {
        self.catalog
            .lock()
            .map_err(|error| AppError::State(error.to_string()))
    }

    fn save(&self) -> AppResult<()> {
        self.lock()?.save(&self.file())
    }

    pub fn read<T>(&self, action: impl FnOnce(&Catalog) -> T) -> AppResult<T> {
        Ok(action(&*self.lock()?))
    }

    /// Applies a change and writes the catalog back to disk before returning.
    pub fn update<T>(&self, action: impl FnOnce(&mut Catalog) -> T) -> AppResult<T> {
        let mut catalog = self.lock()?;
        let outcome = action(&mut catalog);
        catalog.save(&self.file())?;

        Ok(outcome)
    }

    pub fn active_file(&self) -> AppResult<PathBuf> {
        self.read(|catalog| catalog.active_entry().map(CatalogEntry::path))?
    }

    pub fn file_of(&self, id: &str) -> AppResult<PathBuf> {
        self.read(|catalog| {
            catalog
                .entry(id)
                .map(CatalogEntry::path)
                .ok_or_else(|| AppError::NotFound(id.to_owned()))
        })?
    }
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/catalog.rs");
}
