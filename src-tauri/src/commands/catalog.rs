//! Commands over the set of libraries: list, create, switch, delete and export.

use std::path::PathBuf;

use tauri::State;

use serde::{Deserialize, Serialize};

use crate::catalog::{self, Catalog, CatalogState};
use crate::commands::library::LibraryInfo;
use crate::error::{AppError, AppResult};
use crate::library::{Library, LibraryImportReport, LibraryImportStrategy};
use crate::state::LibraryState;

/// One library as shown in the settings list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySummary {
    pub id: String,
    pub name: String,
    pub track_count: usize,
    pub active: bool,
}

/// Describes every library: the active one from memory, the others from their file.
pub fn summaries(catalog: &CatalogState, state: &LibraryState) -> AppResult<Vec<LibrarySummary>> {
    let (active_id, entries) =
        catalog.read(|catalog| (catalog.active.clone(), catalog.entries.clone()))?;

    let mut summaries = Vec::with_capacity(entries.len());

    for entry in entries {
        let active = entry.id == active_id;
        let (name, track_count) = if active {
            state.read(|library| (library.name.clone(), library.len()))?
        } else {
            let library = Library::load(&entry.path())?;
            (library.name, library.tracks.len())
        };

        summaries.push(LibrarySummary {
            id: entry.id,
            name,
            track_count,
            active,
        });
    }

    Ok(summaries)
}

/// Ids come from name and clock, so two libraries named the same in the same second would
/// collide: the seed is changed until the catalog has no such entry.
fn unique_id(catalog: &Catalog, name: &str) -> String {
    let mut candidate = catalog::library_id(name);

    for attempt in 1.. {
        if catalog.entry(&candidate).is_none() {
            break;
        }

        candidate = catalog::library_id(&format!("{name}-{attempt}"));
    }

    candidate
}

/// Creates an empty library and adds it to the catalog without opening it.
pub fn create(catalog: &CatalogState, name: &str) -> AppResult<LibrarySummary> {
    let mut library = Library::new();
    let name = library.rename(name)?;

    let id = catalog.read(|entries| unique_id(entries, &name))?;
    let file = catalog::library_file(catalog.directory(), &id);
    library.save(&file)?;

    catalog.update(|catalog| {
        catalog.add(catalog::CatalogEntry {
            id: id.clone(),
            file: file.to_string_lossy().into_owned(),
        });
    })?;

    Ok(LibrarySummary {
        id,
        name,
        track_count: 0,
        active: false,
    })
}

/// Opens another library.
///
/// The catalog is written first: if loading the file then fails, the next start opens the
/// library the user asked for instead of silently going back to the previous one.
pub fn switch(catalog: &CatalogState, state: &LibraryState, id: &str) -> AppResult<LibraryInfo> {
    let file = catalog.file_of(id)?;
    catalog.update(|catalog| catalog.set_active(id))??;
    state.switch_to(file)?;

    state.read(|library| LibraryInfo {
        name: library.name.clone(),
    })
}

/// Deletes a library and its file, opening another one when the active library goes away.
pub fn delete(
    catalog: &CatalogState,
    state: &LibraryState,
    id: &str,
) -> AppResult<Vec<LibrarySummary>> {
    let was_active = catalog.read(|catalog| catalog.active == id)?;
    let removed = catalog.update(|catalog| catalog.remove(id))??;

    match std::fs::remove_file(removed.path()) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(AppError::Io(error)),
    }

    if was_active {
        state.switch_to(catalog.active_file()?)?;
    }

    summaries(catalog, state)
}

/// Writes a copy of one library to the chosen file.
pub fn export(
    catalog: &CatalogState,
    state: &LibraryState,
    id: &str,
    destination: &str,
) -> AppResult<String> {
    if destination.trim().is_empty() {
        return Err(AppError::Validation(
            "percorso di destinazione mancante".to_owned(),
        ));
    }

    let source = catalog.file_of(id)?;
    let active = catalog.read(|catalog| catalog.active == id)?;

    // The active library lives in memory: exporting it from there also covers the case of
    // a library whose file has not been written yet.
    let library = if active {
        state.read(Clone::clone)?
    } else {
        Library::load(&source)?
    };

    let destination = PathBuf::from(destination);
    library.save(&destination)?;

    Ok(destination.to_string_lossy().into_owned())
}

/// Imports a library JSON into the active library using the selected merge strategy.
pub fn import(
    state: &LibraryState,
    source: &str,
    strategy: LibraryImportStrategy,
) -> AppResult<LibraryImportReport> {
    if source.trim().is_empty() {
        return Err(AppError::Validation(
            "percorso di import mancante".to_owned(),
        ));
    }

    let (mut imported, stored_version) = Library::load_with_version(&PathBuf::from(source))?;
    if stored_version < crate::library::SCHEMA_VERSION {
        crate::library::refresh_metadata(&mut imported);
    }

    state.update(|library| library.import(imported, strategy))
}

/// Lists the libraries the user can switch between.
#[tauri::command]
pub fn list_libraries(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
) -> AppResult<Vec<LibrarySummary>> {
    summaries(&catalog, &state)
}

/// Creates a new empty library.
#[tauri::command]
pub fn create_library(catalog: State<'_, CatalogState>, name: String) -> AppResult<LibrarySummary> {
    create(&catalog, &name)
}

/// Makes another library the active one.
#[tauri::command]
pub fn switch_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<LibraryInfo> {
    switch(&catalog, &state, &id)
}

/// Deletes a library and its file.
#[tauri::command]
pub fn delete_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<Vec<LibrarySummary>> {
    delete(&catalog, &state, &id)
}

/// Exports a library to the chosen file.
#[tauri::command]
pub fn export_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
    destination: String,
) -> AppResult<String> {
    export(&catalog, &state, &id, &destination)
}

/// Imports a library file into the active library.
#[tauri::command]
pub fn import_library(
    state: State<'_, LibraryState>,
    source: String,
    strategy: LibraryImportStrategy,
) -> AppResult<LibraryImportReport> {
    import(&state, &source, strategy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::TempDir;

    struct Setup {
        _directory: TempDir,
        catalog: CatalogState,
        state: LibraryState,
    }

    fn setup() -> Setup {
        let directory = TempDir::new("catalogo-comandi");
        let catalog = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );
        let state = LibraryState::from_file(catalog.active_file().expect("libreria attiva"));

        Setup {
            _directory: directory,
            catalog,
            state,
        }
    }

    #[test]
    fn elenca_la_sola_libreria_iniziale() {
        let setup = setup();

        let libraries = summaries(&setup.catalog, &setup.state).expect("elenco");

        assert_eq!(libraries.len(), 1);
        assert!(libraries[0].active);
        assert_eq!(libraries[0].track_count, 0);
    }

    #[test]
    fn crea_una_libreria_senza_aprirla() {
        let setup = setup();

        let created = create(&setup.catalog, "  Jazz  ").expect("libreria creata");
        let libraries = summaries(&setup.catalog, &setup.state).expect("elenco");

        assert_eq!(created.name, "Jazz");
        assert!(!created.active);
        assert_eq!(libraries.len(), 2);
        assert!(libraries.iter().any(|library| library.id == created.id));
        assert!(libraries[0].active);
    }

    #[test]
    fn due_librerie_con_lo_stesso_nome_restano_distinte() {
        let setup = setup();

        let prima = create(&setup.catalog, "Jazz").expect("prima libreria");
        let seconda = create(&setup.catalog, "Jazz").expect("seconda libreria");

        assert_ne!(prima.id, seconda.id);
        assert_eq!(
            summaries(&setup.catalog, &setup.state)
                .expect("elenco")
                .len(),
            3
        );
    }

    #[test]
    fn rifiuta_una_libreria_senza_nome() {
        let setup = setup();

        let error = create(&setup.catalog, "   ").expect_err("nome vuoto");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn apre_la_libreria_scelta() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("libreria creata");

        let info = switch(&setup.catalog, &setup.state, &created.id).expect("libreria aperta");

        assert_eq!(info.name, "Jazz");
        let libraries = summaries(&setup.catalog, &setup.state).expect("elenco");
        assert!(libraries
            .iter()
            .any(|library| library.id == created.id && library.active));
    }

    #[test]
    fn i_brani_seguono_la_libreria_aperta() {
        let setup = setup();
        setup
            .state
            .update(|library| library.rename("Principale"))
            .expect("stato aggiornato")
            .expect("nome valido");
        let created = create(&setup.catalog, "Jazz").expect("libreria creata");

        switch(&setup.catalog, &setup.state, &created.id).expect("libreria aperta");

        let nome = setup
            .state
            .read(|library| library.name.clone())
            .expect("lettura");
        assert_eq!(nome, "Jazz");
    }

    #[test]
    fn eliminando_la_libreria_aperta_ne_apre_un_altra() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("libreria creata");
        switch(&setup.catalog, &setup.state, &created.id).expect("libreria aperta");
        let file = setup.catalog.file_of(&created.id).expect("file");

        let libraries = delete(&setup.catalog, &setup.state, &created.id).expect("eliminata");

        assert_eq!(libraries.len(), 1);
        assert!(libraries[0].active);
        assert!(!file.exists());
    }

    #[test]
    fn l_ultima_libreria_resta() {
        let setup = setup();
        let attiva = summaries(&setup.catalog, &setup.state).expect("elenco")[0]
            .id
            .clone();

        let error = delete(&setup.catalog, &setup.state, &attiva).expect_err("ultima libreria");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn esporta_la_libreria_attiva_dalla_memoria() {
        let setup = setup();
        setup
            .state
            .update(|library| library.rename("Principale"))
            .expect("stato aggiornato")
            .expect("nome valido");
        let attiva = summaries(&setup.catalog, &setup.state).expect("elenco")[0]
            .id
            .clone();
        let destination = setup._directory.path().join("copia.json");

        export(
            &setup.catalog,
            &setup.state,
            &attiva,
            &destination.to_string_lossy(),
        )
        .expect("libreria esportata");

        let esportata = Library::load(&destination).expect("copia leggibile");
        assert_eq!(esportata.name, "Principale");
    }

    #[test]
    fn esporta_una_libreria_non_aperta_dal_suo_file() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("libreria creata");
        let destination = setup._directory.path().join("jazz.json");

        export(
            &setup.catalog,
            &setup.state,
            &created.id,
            &destination.to_string_lossy(),
        )
        .expect("libreria esportata");

        assert_eq!(
            Library::load(&destination).expect("copia leggibile").name,
            "Jazz"
        );
    }

    #[test]
    fn rifiuta_un_export_senza_destinazione() {
        let setup = setup();
        let attiva = summaries(&setup.catalog, &setup.state).expect("elenco")[0]
            .id
            .clone();

        let error = export(&setup.catalog, &setup.state, &attiva, "  ").expect_err("destinazione");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn importa_una_libreria_nella_libreria_attiva() {
        let setup = setup();
        let source = setup._directory.path().join("importata.json");
        let mut imported = Library::new();
        imported.rename("Importata").expect("nome valido");
        imported.add(crate::library::Track {
            id: "aaa".to_owned(),
            path: "C:/musica/aaa.mp3".to_owned(),
            title: "Brano".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 1,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 1,
        });
        imported.save(&source).expect("fixture salvata");

        let report = import(
            &setup.state,
            &source.to_string_lossy(),
            LibraryImportStrategy::Replace,
        )
        .expect("import riuscito");

        assert_eq!(report.added, 1);
        assert_eq!(
            setup
                .state
                .read(|library| library.name.clone())
                .expect("lettura"),
            "Importata"
        );
    }

    #[test]
    fn rifiuta_un_import_senza_sorgente() {
        let setup = setup();

        let error = import(&setup.state, "  ", LibraryImportStrategy::Merge).expect_err("sorgente");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn rifiuta_le_operazioni_su_una_libreria_sconosciuta() {
        let setup = setup();

        assert!(matches!(
            switch(&setup.catalog, &setup.state, "ignota"),
            Err(AppError::NotFound(_))
        ));
        assert!(matches!(
            export(&setup.catalog, &setup.state, "ignota", "copia.json"),
            Err(AppError::NotFound(_))
        ));
    }
}
