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
                "catalogo con schema v{} (supportato fino a v{CATALOG_VERSION})",
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
            .ok_or_else(|| AppError::State(format!("libreria attiva sconosciuta: {}", self.active)))
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
                "l'ultima libreria non puo essere eliminata".to_owned(),
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

    let id = library_id("prima");
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
                eprintln!("catalogo non caricato ({error}), se ne crea uno nuovo");
                bootstrap(&directory, legacy_file)
            })
        } else {
            bootstrap(&directory, legacy_file)
        };

        let state = Self::new(directory, catalog);

        if let Err(error) = state.save() {
            eprintln!("catalogo non salvato: {error}");
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
    fn il_catalogo_parte_dalla_libreria_gia_esistente() {
        let directory = TempDir::new("catalogo");
        let legacy = directory.path().join("library.json");
        Library::new().save(&legacy).expect("libreria salvata");

        let catalog = bootstrap(directory.path(), &legacy);

        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].path(), legacy);
        assert_eq!(catalog.active, catalog.entries[0].id);
    }

    #[test]
    fn senza_nulla_su_disco_crea_la_prima_libreria_nella_sua_cartella() {
        let directory = TempDir::new("catalogo");

        let catalog = bootstrap(directory.path(), &directory.path().join("library.json"));

        let file = catalog.entries[0].path();
        assert!(file.starts_with(directory.path().join(LIBRARIES_DIR_NAME)));
        assert_eq!(
            file.extension().and_then(|value| value.to_str()),
            Some("json")
        );
    }

    #[test]
    fn il_catalogo_sopravvive_al_salvataggio_e_alla_rilettura() {
        let directory = TempDir::new("catalogo");
        let file = directory.path().join(CATALOG_FILE_NAME);
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.save(&file).expect("catalogo salvato");
        let riletto = Catalog::load(&file).expect("catalogo riletto");

        assert_eq!(riletto, catalog);
    }

    #[test]
    fn rifiuta_un_catalogo_di_una_versione_futura() {
        let directory = TempDir::new("catalogo");
        let file = directory.path().join(CATALOG_FILE_NAME);
        std::fs::write(
            &file,
            r#"{"version":99,"active":"uno","entries":[{"id":"uno","file":"a.json"}]}"#,
        )
        .expect("catalogo scritto");

        let error = Catalog::load(&file).expect_err("schema troppo recente");

        assert!(matches!(error, AppError::UnsupportedFormat(_)));
    }

    #[test]
    fn cambia_la_libreria_attiva() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.set_active("due").expect("libreria attivata");

        assert_eq!(catalog.active, "due");
    }

    #[test]
    fn rifiuta_di_attivare_una_libreria_sconosciuta() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.set_active("ignota").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn eliminando_la_libreria_attiva_ne_attiva_un_altra() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));
        catalog.set_active("due").expect("libreria attivata");

        let removed = catalog.remove("due").expect("libreria eliminata");

        assert_eq!(removed.id, "due");
        assert_eq!(catalog.active, "uno");
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn l_ultima_libreria_non_si_elimina() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.remove("uno").expect_err("ultima libreria");

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn eliminare_una_libreria_sconosciuta_e_un_errore() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        let error = catalog.remove("tre").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn lo_stato_scrive_il_catalogo_al_primo_avvio() {
        let directory = TempDir::new("catalogo");

        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        assert!(state.file().exists());
        assert!(!state.active_file().expect("libreria attiva").exists());
    }

    #[test]
    fn lo_stato_rilegge_il_catalogo_gia_scritto() {
        let directory = TempDir::new("catalogo");
        let legacy = directory.path().join("library.json");
        let prima = CatalogState::open(directory.path().to_path_buf(), &legacy);
        let atteso = prima.active_file().expect("libreria attiva");

        let seconda = CatalogState::open(directory.path().to_path_buf(), &legacy);

        assert_eq!(seconda.active_file().expect("libreria attiva"), atteso);
    }

    #[test]
    fn ogni_modifica_del_catalogo_finisce_su_disco() {
        let directory = TempDir::new("catalogo");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalogo aggiornato");

        let riletto = Catalog::load(&state.file()).expect("catalogo riletto");
        assert_eq!(riletto.entries.len(), 2);
    }

    #[test]
    fn conosce_il_file_di_ogni_libreria() {
        let directory = TempDir::new("catalogo");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );
        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalogo aggiornato");

        let file = state.file_of("due").expect("file trovato");

        assert_eq!(file, PathBuf::from("C:/dati/due.json"));
        assert!(matches!(
            state.file_of("ignota"),
            Err(AppError::NotFound(_))
        ));
    }
}
