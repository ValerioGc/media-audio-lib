    use super::*;
    use crate::fixtures::{png_cover_base64, wav_with_cover, wav_with_tags, TempDir};
    use crate::library::{self, Library};

    /// A library state holding a single freshly imported track.
    fn state_with_track(dir: &TempDir, file: PathBuf) -> (LibraryState, String) {
        let state = LibraryState::from_file(dir.path().join("library.json"));
        state
            .update(|lib| library::add_paths(lib, &[file.display().to_string()], 0))
            .expect("import succeeded");

        let id = state
            .read(|lib| lib.tracks()[0].id.clone())
            .expect("read succeeded");

        (state, id)
    }

    fn update() -> MetadataUpdate {
        MetadataUpdate {
            title: "Title modificato".to_owned(),
            artist: Some("Edited Artist".to_owned()),
            album: Some("Album modificato".to_owned()),
            year: Some(2012),
            genre: Some("Blues".to_owned()),
        }
    }

    #[test]
    fn a_file_of_the_library_can_be_read() {
        let dir = TempDir::new("commands-known-file");
        let file = wav_with_tags(dir.path(), "track.wav");
        let (state, _) = state_with_track(&dir, file.clone());

        assert!(ensure_known_file(&state, &StartupFile::default(), &file).is_ok());
    }

    #[test]
    fn the_file_the_system_handed_over_can_be_read_as_well() {
        let dir = TempDir::new("commands-startup-file");
        let file = wav_with_tags(dir.path(), "track.wav");
        let state = LibraryState::from_file(dir.path().join("library.json"));
        let startup = StartupFile::from_arguments([file.clone()]);

        assert!(ensure_known_file(&state, &startup, &file).is_ok());
    }

    #[test]
    fn a_file_the_app_was_never_given_cannot_be_read() {
        let dir = TempDir::new("commands-unknown-file");
        let file = wav_with_tags(dir.path(), "track.wav");
        let stranger = wav_with_tags(dir.path(), "stranger.wav");
        let (state, _) = state_with_track(&dir, file);

        // The interface cannot ask the shell to open something the user never gave it.
        assert!(ensure_known_file(&state, &StartupFile::default(), &stranger).is_err());
    }

    #[test]
    fn reads_cover_through_the_cache() {
        let dir = TempDir::new("commands-cover");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cache = CoverCache::new(dir.path().join("cover-cache"));

        let cover = cache.load(&path).expect("read succeeded");

        assert_eq!(
            cover.into_cover().map(|cover| cover.mime_type),
            Some("image/png".to_owned())
        );
    }

    #[test]
    fn edit_updates_file_and_library() {
        let dir = TempDir::new("edit-metadata");
        let file = wav_with_tags(dir.path(), "track.wav");
        let (state, id) = state_with_track(&dir, file.clone());

        let updated = edit_metadata(&state, &id, &update()).expect("edit succeeded");

        assert_eq!(updated.title, "Title modificato");
        assert_eq!(updated.year, Some(2012));
        assert_eq!(
            metadata::read_metadata(&file)
                .expect("riread")
                .title
                .as_deref(),
            Some("Title modificato")
        );
    }

    #[test]
    fn edit_survives_restart() {
        let dir = TempDir::new("edit-persisted");
        let file = wav_with_tags(dir.path(), "track.wav");
        let (state, id) = state_with_track(&dir, file);

        edit_metadata(&state, &id, &update()).expect("edit succeeded");

        let reloaded = Library::load(&dir.path().join("library.json")).expect("reloaded");
        assert_eq!(
            reloaded.get(&id).expect("present").title,
            "Title modificato"
        );
    }

    #[test]
    fn edited_cover_updates_the_library() {
        let dir = TempDir::new("edit-cover");
        let file = crate::fixtures::mp3_with_tags(dir.path(), "track.mp3");
        let (state, id) = state_with_track(&dir, file);
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        let with_cover = edit_cover(&state, &id, Some(&cover)).expect("scrittura riuscita");
        assert!(with_cover.has_cover);

        let without_cover = edit_cover(&state, &id, None).expect("removal succeeded");
        assert!(!without_cover.has_cover);
    }

    #[test]
    fn rejects_editing_an_untracked_track() {
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
    fn invalid_update_leaves_the_library_unchanged() {
        let dir = TempDir::new("edit-invalid");
        let file = wav_with_tags(dir.path(), "track.wav");
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
                .read(|lib| lib.get(&id).expect("present").title.clone())
                .expect("read"),
            "Test Title"
        );
    }
