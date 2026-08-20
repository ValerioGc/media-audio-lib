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
    use super::*;
    use crate::fixtures::TempDir;
    use crate::library::Library;

    fn entry(id: &str) -> CatalogEntry {
        CatalogEntry {
            id: id.to_owned(),
            file: format!("C:/dati/{id}.json"),
        }
    }

    #[test]
    fn catalog_starts_from_the_existing_library() {
        let directory = TempDir::new("catalog");
        let legacy = directory.path().join("library.json");
        Library::new().save(&legacy).expect("library saved");

        let catalog = bootstrap(directory.path(), &legacy);

        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].path(), legacy);
        assert_eq!(catalog.active, catalog.entries[0].id);
    }

    #[test]
    fn with_nothing_on_disk_creates_the_first_library_in_its_folder() {
        let directory = TempDir::new("catalog");

        let catalog = bootstrap(directory.path(), &directory.path().join("library.json"));

        let file = catalog.entries[0].path();
        assert!(file.starts_with(directory.path().join(LIBRARIES_DIR_NAME)));
        assert_eq!(
            file.extension().and_then(|value| value.to_str()),
            Some("json")
        );
    }

    #[test]
    fn catalog_survives_saving_and_rereading() {
        let directory = TempDir::new("catalog");
        let file = directory.path().join(CATALOG_FILE_NAME);
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.save(&file).expect("catalog salvato");
        let riletto = Catalog::load(&file).expect("catalog riletto");

        assert_eq!(riletto, catalog);
    }

    #[test]
    fn rejects_a_catalog_from_a_future_version() {
        let directory = TempDir::new("catalog");
        let file = directory.path().join(CATALOG_FILE_NAME);
        std::fs::write(
            &file,
            r#"{"version":99,"active":"uno","entries":[{"id":"uno","file":"a.json"}]}"#,
        )
        .expect("catalog scritto");

        let error = Catalog::load(&file).expect_err("schema troppo recente");

        assert!(matches!(error, AppError::UnsupportedFormat(_)));
    }

    #[test]
    fn changes_the_active_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.set_active("due").expect("library activated");

        assert_eq!(catalog.active, "due");
    }

    #[test]
    fn refuses_to_activate_an_unknown_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.set_active("ignota").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn deleting_the_active_library_activates_another_one() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));
        catalog.set_active("due").expect("library activated");

        let removed = catalog.remove("due").expect("library deleted");

        assert_eq!(removed.id, "due");
        assert_eq!(catalog.active, "uno");
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn does_not_delete_the_last_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.remove("uno").expect_err("last library");

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn deleting_an_unknown_library_is_an_error() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        let error = catalog.remove("tre").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn state_writes_the_catalog_on_first_start() {
        let directory = TempDir::new("catalog");

        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        assert!(state.file().exists());
        assert!(!state.active_file().expect("active library").exists());
    }

    #[test]
    fn state_rereads_the_already_written_catalog() {
        let directory = TempDir::new("catalog");
        let legacy = directory.path().join("library.json");
        let first = CatalogState::open(directory.path().to_path_buf(), &legacy);
        let expected = first.active_file().expect("active library");

        let second = CatalogState::open(directory.path().to_path_buf(), &legacy);

        assert_eq!(second.active_file().expect("active library"), expected);
    }

    #[test]
    fn every_catalog_change_lands_on_disk() {
        let directory = TempDir::new("catalog");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalog aggiornato");

        let riletto = Catalog::load(&state.file()).expect("catalog riletto");
        assert_eq!(riletto.entries.len(), 2);
    }

    #[test]
    fn knows_the_file_of_each_library() {
        let directory = TempDir::new("catalog");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );
        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalog aggiornato");

        let file = state.file_of("due").expect("file trovato");

        assert_eq!(file, PathBuf::from("C:/dati/due.json"));
        assert!(matches!(
            state.file_of("ignota"),
            Err(AppError::NotFound(_))
        ));
    }
}
