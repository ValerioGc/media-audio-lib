    use super::*;
    use crate::fixtures::{mp3_with_tags, wav_with_cover, wav_with_tags, TempDir};

    fn cache(dir: &TempDir) -> CoverCache {
        CoverCache::new(dir.path().join("cover-cache"))
    }

    #[test]
    fn reads_the_cover_and_stores_it_in_cache() {
        let dir = TempDir::new("cache-store");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        let cover = cache.load(&track).expect("read").expect("cover");

        assert_eq!(cover.mime_type, "image/png");
        assert!(cache
            .directory()
            .join(format!("{}.png", CoverCache::entry_key(&track)))
            .is_file());
    }

    #[test]
    fn second_read_comes_from_cache() {
        let dir = TempDir::new("cache-hit");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        // A fake entry written by hand: if the audio file were reread,
        // the returned content would be different.
        std::fs::create_dir_all(cache.directory()).expect("directory created");
        std::fs::write(
            cache
                .directory()
                .join(format!("{}.png", CoverCache::entry_key(&track))),
            b"fake-cover",
        )
        .expect("entry written");

        let cover = cache.load(&track).expect("read").expect("cover");
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&cover.data)
            .expect("base64 valido");

        assert_eq!(bytes, b"fake-cover");
    }

    #[test]
    fn remembers_files_without_cover_without_reopening_them() {
        let dir = TempDir::new("cache-none");
        let cache = cache(&dir);
        let track = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(cache.load(&track).expect("read"), None);
        assert!(cache
            .directory()
            .join(format!("{}.none", CoverCache::entry_key(&track)))
            .is_file());
        assert_eq!(cache.load(&track).expect("second read"), None);
    }

    #[test]
    fn file_change_invalidates_the_entry() {
        let dir = TempDir::new("cache-invalidate");
        let cache = cache(&dir);
        let track = mp3_with_tags(dir.path(), "track.mp3");

        cache.load(&track).expect("first read");
        let old_key = CoverCache::entry_key(&track);

        // Rewrites the file with a cover: the modification time changes.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        crate::metadata::write_cover(
            &track,
            Some(&Cover {
                mime_type: "image/png".to_owned(),
                data: crate::fixtures::png_cover_base64(),
            }),
        )
        .expect("cover written");

        let new_key = CoverCache::entry_key(&track);
        assert_ne!(old_key, new_key);

        assert!(cache.load(&track).expect("second read").is_some());
        assert!(!cache.directory().join(format!("{old_key}.none")).exists());
    }

    #[test]
    fn unwritable_cache_does_not_prevent_reading() {
        let dir = TempDir::new("cache-readonly");
        let track = wav_with_cover(dir.path(), "track.wav");
        // Un file al posto della cartella: ogni scrittura in cache fallira'.
        let path_occupato = dir.path().join("occupato");
        std::fs::write(&path_occupato, b"non sono una cartella").expect("file written");
        let cache = CoverCache::new(path_occupato);

        assert!(cache.load(&track).expect("read succeeded").is_some());
    }

    #[test]
    fn propagates_the_error_for_a_missing_file() {
        let dir = TempDir::new("cache-missing");

        assert!(cache(&dir).load(Path::new("C:/music/assente.mp3")).is_err());
    }

    #[test]
    fn clears_the_cache_on_request() {
        let dir = TempDir::new("cache-clear");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");
        cache.load(&track).expect("read");

        cache.clear().expect("pulizia riuscita");

        assert_eq!(
            std::fs::read_dir(cache.directory())
                .expect("cartella leggibile")
                .count(),
            0
        );
    }

    #[test]
    fn clearing_a_never_created_cache_is_not_an_error() {
        let dir = TempDir::new("cache-clear-empty");

        assert!(cache(&dir).clear().is_ok());
    }
