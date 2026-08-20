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
