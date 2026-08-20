    use super::*;
    use crate::fixtures::{png_cover_base64, wav_with_cover, wav_with_tags, TempDir};
    use crate::metadata::read_cover;

    fn update() -> MetadataUpdate {
        MetadataUpdate {
            title: "Nuovo titolo".to_owned(),
            artist: Some("New Artist".to_owned()),
            album: Some("Nuovo album".to_owned()),
            year: Some(2010),
            genre: Some("Blues".to_owned()),
        }
    }

    /// MP3 is the priority format, and the only one where the full cover life cycle
    /// (write, replace, remove) is verifiable: see the note on WAV below.
    #[test]
    fn on_mp3_cover_can_be_added_and_then_removed() {
        let dir = TempDir::new("cover-cycle-mp3");
        let path = crate::fixtures::mp3_with_tags(dir.path(), "track.mp3");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        assert!(
            write_cover(&path, Some(&cover))
                .expect("aggiunta riuscita")
                .has_cover
        );
        assert!(
            !write_cover(&path, None)
                .expect("removal succeeded")
                .has_cover
        );
        assert_eq!(read_cover(&path).expect("riread"), None);
    }

    #[test]
    fn writes_and_rereads_tags() {
        let dir = TempDir::new("write-roundtrip");
        let path = wav_with_tags(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("scrittura riuscita");
        let reread = read_metadata(&path).expect("riread succeeded");

        assert_eq!(written, reread);
        assert_eq!(reread.title.as_deref(), Some("Nuovo titolo"));
        assert_eq!(reread.artist.as_deref(), Some("New Artist"));
        assert_eq!(reread.album.as_deref(), Some("Nuovo album"));
        assert_eq!(reread.year, Some(2010));
        assert_eq!(reread.genre.as_deref(), Some("Blues"));
    }

    #[test]
    fn trims_fields_left_empty() {
        let dir = TempDir::new("write-clear");
        let path = wav_with_tags(dir.path(), "track.wav");

        let cleared = MetadataUpdate {
            title: "Solo titolo".to_owned(),
            artist: None,
            album: Some("   ".to_owned()),
            year: None,
            genre: None,
        };

        let written = write_metadata(&path, &cleared).expect("scrittura riuscita");

        assert_eq!(written.title.as_deref(), Some("Solo titolo"));
        assert_eq!(written.artist, None);
        assert_eq!(written.album, None);
        assert_eq!(written.year, None);
        assert_eq!(written.genre, None);
    }

    #[test]
    fn keeps_the_cover_when_only_text_changes() {
        let dir = TempDir::new("write-keeps-cover");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("scrittura riuscita");

        assert!(written.has_cover);
    }

    #[test]
    fn leaves_no_temporary_files() {
        let dir = TempDir::new("write-no-temp");
        let path = wav_with_tags(dir.path(), "track.wav");

        write_metadata(&path, &update()).expect("scrittura riuscita");

        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .expect("cartella leggibile")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("mal-tmp"))
            .collect();

        assert!(leftovers.is_empty());
    }

    #[test]
    fn rejects_an_empty_title_without_touching_the_file() {
        let dir = TempDir::new("write-empty-title");
        let path = wav_with_tags(dir.path(), "track.wav");
        let invalid = MetadataUpdate {
            title: "   ".to_owned(),
            ..update()
        };

        let error = write_metadata(&path, &invalid).unwrap_err();

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(
            read_metadata(&path).expect("riread").title.as_deref(),
            Some("Test Title")
        );
    }

    #[test]
    fn rejects_an_implausible_year() {
        let dir = TempDir::new("write-bad-year");
        let path = wav_with_tags(dir.path(), "track.wav");

        for year in [999, max_year() + 1] {
            let invalid = MetadataUpdate {
                year: Some(year),
                ..update()
            };

            assert!(matches!(
                write_metadata(&path, &invalid).unwrap_err(),
                AppError::Validation(_)
            ));
        }
    }

    #[test]
    fn accepts_the_allowed_range_boundaries() {
        assert!(validate_update(&MetadataUpdate {
            year: Some(MIN_YEAR),
            ..update()
        })
        .is_ok());
        assert!(validate_update(&MetadataUpdate {
            year: Some(max_year()),
            ..update()
        })
        .is_ok());
    }

    #[test]
    fn rejects_an_overly_long_title() {
        let invalid = MetadataUpdate {
            title: "a".repeat(MAX_TITLE_LENGTH + 1),
            ..update()
        };

        assert!(matches!(
            validate_update(&invalid).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_writing_to_a_read_only_file() {
        let dir = TempDir::new("write-readonly");
        let path = wav_with_tags(dir.path(), "track.wav");

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        permissions.set_readonly(true);
        std::fs::set_permissions(&path, permissions).expect("permessi impostati");

        let error = write_metadata(&path, &update()).unwrap_err();

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        #[allow(clippy::permissions_set_readonly_false)]
        permissions.set_readonly(false);
        std::fs::set_permissions(&path, permissions).expect("permessi ripristinati");

        assert!(matches!(error, AppError::ReadOnly(_)));
    }

    #[test]
    fn rejects_a_missing_file() {
        let error = write_metadata(Path::new("C:/music/assente.mp3"), &update()).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn writes_the_cover_and_reads_it_back() {
        let dir = TempDir::new("cover-write");
        let path = wav_with_tags(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        let written = write_cover(&path, Some(&cover)).expect("scrittura riuscita");
        let stored = read_cover(&path).expect("riread").expect("cover presente");

        assert!(written.has_cover);
        assert_eq!(stored.mime_type, "image/png");
        assert_eq!(stored.data, cover.data);
    }

    #[test]
    fn replaces_the_existing_cover_without_accumulating_others() {
        let dir = TempDir::new("cover-replace");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/jpeg".to_owned(),
            data: png_cover_base64(),
        };

        write_cover(&path, Some(&cover)).expect("scrittura riuscita");
        let stored = read_cover(&path).expect("riread").expect("cover presente");

        assert_eq!(stored.mime_type, "image/jpeg");
    }

    #[test]
    fn removes_the_cover() {
        let dir = TempDir::new("cover-remove");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_cover(&path, None).expect("removal succeeded");

        assert!(!written.has_cover);
        assert_eq!(read_cover(&path).expect("riread"), None);
    }

    #[test]
    fn rejects_a_disallowed_image_format() {
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_unreadable_or_empty_image() {
        let broken = Cover {
            mime_type: "image/png".to_owned(),
            data: "non-base64!!".to_owned(),
        };
        let empty = Cover {
            mime_type: "image/png".to_owned(),
            data: String::new(),
        };

        assert!(matches!(
            validate_cover(&broken).unwrap_err(),
            AppError::Validation(_)
        ));
        assert!(matches!(
            validate_cover(&empty).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_oversized_image() {
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: base64::engine::general_purpose::STANDARD.encode(vec![0u8; MAX_COVER_BYTES + 1]),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn invalid_cover_leaves_the_file_untouched() {
        let dir = TempDir::new("cover-invalid");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(write_cover(&path, Some(&cover)).is_err());
        assert!(read_cover(&path).expect("riread").is_some());
    }
