    use super::*;
    use crate::fixtures::{
        corrupted_file, flac_with_tags, mp3_with_tags, wav_with_cover, wav_with_tags, TempDir,
    };

    #[test]
    fn extracts_the_lowercase_extension() {
        assert_eq!(extension_of(Path::new("C:/music/Track.MP3")), "mp3");
        assert_eq!(extension_of(Path::new("/musica/track")), "");
    }

    #[test]
    fn recognizes_only_declared_formats() {
        assert!(is_supported(Path::new("track.mp3")));
        assert!(is_supported(Path::new("track.FLAC")));
        assert!(!is_supported(Path::new("cover.png")));
    }

    #[test]
    fn rejects_missing_files() {
        let error = ensure_importable(Path::new("C:/music/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn rejects_unsupported_formats() {
        let dir = TempDir::new("metadata-unsupported");
        let path = dir.path().join("nota.txt");
        std::fs::write(&path, b"non audio").expect("file di test scritto");

        let error = ensure_importable(&path).unwrap_err();

        assert!(matches!(error, AppError::UnsupportedFormat(extension) if extension == "txt"));
    }

    #[test]
    fn rejects_corrupted_audio_files() {
        let dir = TempDir::new("metadata-corrupted");
        let path = corrupted_file(dir.path(), "rotto.mp3");

        let error = read_metadata(&path).unwrap_err();

        assert!(matches!(error, AppError::InvalidAudio(_)));
    }

    #[test]
    fn reads_wav_tags() {
        let dir = TempDir::new("metadata-wav");
        let path = wav_with_tags(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.artist.as_deref(), Some("Test Artist"));
        assert_eq!(metadata.album.as_deref(), Some("Album di prova"));
        assert_eq!(metadata.year, Some(1999));
        assert_eq!(metadata.genre.as_deref(), Some("Rock"));
        assert_eq!(metadata.format, "wav");
        assert!(!metadata.has_cover);
    }

    #[test]
    fn reads_mp3_tags() {
        let dir = TempDir::new("metadata-mp3");
        let path = mp3_with_tags(dir.path(), "track.mp3");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.format, "mp3");
    }

    #[test]
    fn reads_flac_tags() {
        let dir = TempDir::new("metadata-flac");
        let path = flac_with_tags(dir.path(), "track.flac");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.format, "flac");
    }

    #[test]
    fn reports_a_non_negative_duration() {
        let dir = TempDir::new("metadata-duration");
        let path = wav_with_tags(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");

        assert!(metadata.duration_ms > 0);
    }

    #[test]
    fn returns_no_cover_when_there_is_none() {
        let dir = TempDir::new("cover-missing");
        let path = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(read_cover(&path).expect("read succeeded"), None);
    }

    #[test]
    fn returns_the_cover_encoded_as_base64() {
        let dir = TempDir::new("cover-present");
        let path = wav_with_cover(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");
        let cover = read_cover(&path)
            .expect("read succeeded")
            .expect("cover presente");

        assert!(metadata.has_cover);
        assert_eq!(cover.mime_type, "image/png");
        assert!(!cover.data.is_empty());
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(&cover.data)
                .expect("base64 valido")
                .first(),
            Some(&0x89)
        );
    }

    #[test]
    fn cover_of_a_missing_file_is_an_error() {
        let error = read_cover(Path::new("C:/music/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }
