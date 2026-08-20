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
        metadata: library.metadata().clone(),
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
        return Err(AppError::Validation("missing destination path".to_owned()));
    }

    let source = catalog.file_of(id)?;
    let active = catalog.read(|catalog| catalog.active == id)?;

    // The active library lives in memory: exporting it from there also covers the case of
    // a library whose file has not been written yet.
    let mut library = if active {
        state.read(Clone::clone)?
    } else {
        Library::load(&source)?
    };
    library.fill_missing_artwork();

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
        return Err(AppError::Validation("missing import path".to_owned()));
    }

    let mut imported = Library::load(&PathBuf::from(source))?;
    crate::library::maintain_from_disk(&mut imported);

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
    use crate::fixtures::{wav_with_cover, TempDir};
    use crate::library::{track_id, Track};

    struct Setup {
        _directory: TempDir,
        catalog: CatalogState,
        state: LibraryState,
    }

    fn setup() -> Setup {
        let directory = TempDir::new("catalog-commands");
        let catalog = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );
        let state = LibraryState::from_file(catalog.active_file().expect("active library"));

        Setup {
            _directory: directory,
            catalog,
            state,
        }
    }

    #[test]
    fn lists_the_initial_library_only() {
        let setup = setup();

        let libraries = summaries(&setup.catalog, &setup.state).expect("list");

        assert_eq!(libraries.len(), 1);
        assert!(libraries[0].active);
        assert_eq!(libraries[0].track_count, 0);
    }

    #[test]
    fn creates_a_library_without_opening_it() {
        let setup = setup();

        let created = create(&setup.catalog, "  Jazz  ").expect("library created");
        let libraries = summaries(&setup.catalog, &setup.state).expect("list");

        assert_eq!(created.name, "Jazz");
        assert!(!created.active);
        assert_eq!(libraries.len(), 2);
        assert!(libraries.iter().any(|library| library.id == created.id));
        assert!(libraries[0].active);
    }

    #[test]
    fn two_libraries_with_the_same_name_stay_distinct() {
        let setup = setup();

        let first = create(&setup.catalog, "Jazz").expect("first library");
        let second = create(&setup.catalog, "Jazz").expect("second library");

        assert_ne!(first.id, second.id);
        assert_eq!(
            summaries(&setup.catalog, &setup.state).expect("list").len(),
            3
        );
    }

    #[test]
    fn rejects_a_library_without_a_name() {
        let setup = setup();

        let error = create(&setup.catalog, "   ").expect_err("empty name");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn opens_the_chosen_library() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("library created");

        let info = switch(&setup.catalog, &setup.state, &created.id).expect("library opened");

        assert_eq!(info.name, "Jazz");
        let libraries = summaries(&setup.catalog, &setup.state).expect("list");
        assert!(libraries
            .iter()
            .any(|library| library.id == created.id && library.active));
    }

    #[test]
    fn tracks_follow_the_open_library() {
        let setup = setup();
        setup
            .state
            .update(|library| library.rename("Main"))
            .expect("state updated")
            .expect("valid name");
        let created = create(&setup.catalog, "Jazz").expect("library created");

        switch(&setup.catalog, &setup.state, &created.id).expect("library opened");

        let name = setup
            .state
            .read(|library| library.name.clone())
            .expect("read");
        assert_eq!(name, "Jazz");
    }

    #[test]
    fn deleting_the_open_library_opens_another_one() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("library created");
        switch(&setup.catalog, &setup.state, &created.id).expect("library opened");
        let file = setup.catalog.file_of(&created.id).expect("file");

        let libraries = delete(&setup.catalog, &setup.state, &created.id).expect("deleted");

        assert_eq!(libraries.len(), 1);
        assert!(libraries[0].active);
        assert!(!file.exists());
    }

    #[test]
    fn keeps_the_last_library() {
        let setup = setup();
        let active = summaries(&setup.catalog, &setup.state).expect("list")[0]
            .id
            .clone();

        let error = delete(&setup.catalog, &setup.state, &active).expect_err("last library");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn exports_the_active_library_from_memory() {
        let setup = setup();
        setup
            .state
            .update(|library| library.rename("Main"))
            .expect("state updated")
            .expect("valid name");
        let active = summaries(&setup.catalog, &setup.state).expect("list")[0]
            .id
            .clone();
        let destination = setup._directory.path().join("copy.json");

        export(
            &setup.catalog,
            &setup.state,
            &active,
            &destination.to_string_lossy(),
        )
        .expect("library exported");

        let exported = Library::load(&destination).expect("readable copy");
        assert_eq!(exported.name, "Main");
    }

    #[test]
    fn export_fills_missing_library_artwork() {
        let setup = setup();
        let track = wav_with_cover(setup._directory.path(), "track.wav");
        setup
            .state
            .update(|library| {
                library.add(Track {
                    id: track_id(&track),
                    path: track.display().to_string(),
                    title: "Track".to_owned(),
                    artist: Some("Artist A".to_owned()),
                    album: None,
                    year: None,
                    genre: Some("Jazz".to_owned()),
                    duration_ms: 1,
                    format: "wav".to_owned(),
                    has_cover: true,
                    added_at: 1,
                })
            })
            .expect("state updated");
        let active = summaries(&setup.catalog, &setup.state).expect("list")[0]
            .id
            .clone();
        let destination = setup._directory.path().join("copy-with-artwork.json");

        export(
            &setup.catalog,
            &setup.state,
            &active,
            &destination.to_string_lossy(),
        )
        .expect("library exported");

        let exported = Library::load(&destination).expect("readable copy");
        assert_eq!(exported.metadata.artist_artwork.len(), 1);
        assert_eq!(exported.metadata.artist_artwork[0].name, "Artist A");
        assert_eq!(exported.metadata.genre_artwork.len(), 1);
        assert_eq!(exported.metadata.genre_artwork[0].name, "Jazz");
    }

    #[test]
    fn exports_a_closed_library_from_its_file() {
        let setup = setup();
        let created = create(&setup.catalog, "Jazz").expect("library created");
        let destination = setup._directory.path().join("jazz.json");

        export(
            &setup.catalog,
            &setup.state,
            &created.id,
            &destination.to_string_lossy(),
        )
        .expect("library exported");

        assert_eq!(
            Library::load(&destination).expect("readable copy").name,
            "Jazz"
        );
    }

    #[test]
    fn rejects_export_without_destination() {
        let setup = setup();
        let active = summaries(&setup.catalog, &setup.state).expect("list")[0]
            .id
            .clone();

        let error = export(&setup.catalog, &setup.state, &active, "  ").expect_err("destination");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn imports_a_library_into_the_active_library() {
        let setup = setup();
        let source = setup._directory.path().join("imported.json");
        let mut imported = Library::new();
        imported.rename("Imported").expect("valid name");
        imported.add(crate::library::Track {
            id: "aaa".to_owned(),
            path: "C:/music/aaa.mp3".to_owned(),
            title: "Track".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 1,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 1,
        });
        imported.save(&source).expect("fixture saved");

        let report = import(
            &setup.state,
            &source.to_string_lossy(),
            LibraryImportStrategy::Replace,
        )
        .expect("import succeeded");

        assert_eq!(report.added, 1);
        assert_eq!(
            setup
                .state
                .read(|library| library.name.clone())
                .expect("read"),
            "Imported"
        );
    }

    #[test]
    fn rejects_import_without_source() {
        let setup = setup();

        let error = import(&setup.state, "  ", LibraryImportStrategy::Merge).expect_err("source");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn rejects_operations_on_an_unknown_library() {
        let setup = setup();

        assert!(matches!(
            switch(&setup.catalog, &setup.state, "unknown"),
            Err(AppError::NotFound(_))
        ));
        assert!(matches!(
            export(&setup.catalog, &setup.state, "unknown", "copy.json"),
            Err(AppError::NotFound(_))
        ));
    }
}
