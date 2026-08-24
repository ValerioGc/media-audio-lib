    use super::*;
    use crate::fixtures::{mp3_with_tags, wav_with_tags, TempDir};

    fn request(path: &Path, range: Option<&str>) -> Request<Vec<u8>> {
        let displayed = path.display().to_string();
        let encoded =
            percent_encoding::utf8_percent_encode(&displayed, percent_encoding::NON_ALPHANUMERIC);
        let builder = Request::builder().uri(format!("track://localhost/{encoded}"));

        let builder = match range {
            Some(value) => builder.header(header::RANGE, value),
            None => builder,
        };

        builder.body(Vec::new()).expect("valid request")
    }

    #[test]
    fn a_file_the_library_does_not_hold_is_refused() {
        let directory = TempDir::new("protocol-forbidden");
        let track = mp3_with_tags(directory.path(), "track.mp3");

        let response = respond(&request(&track, None), false);

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty(), "nemmeno un byte esce");
    }

    #[test]
    fn a_file_of_the_library_comes_back_whole() {
        let directory = TempDir::new("protocol-whole");
        let track = mp3_with_tags(directory.path(), "track.mp3");
        let on_disk = std::fs::read(&track).expect("readable file");

        let response = respond(&request(&track, None), true);

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &on_disk);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "audio/mpeg"
        );
        assert_eq!(
            response.headers().get(header::ACCEPT_RANGES).unwrap(),
            "bytes"
        );
    }

    #[test]
    fn a_seek_is_answered_with_the_piece_it_asked_for() {
        let directory = TempDir::new("protocol-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");
        let length = on_disk.len() as u64;

        let response = respond(&request(&track, Some("bytes=4-9")), true);

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body(), &on_disk[4..=9]);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes 4-9/{length}")
        );
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "audio/wav"
        );
    }

    /// What a media element sends when it starts playing: everything from here on.
    #[test]
    fn an_open_ended_range_runs_to_the_end_of_the_file() {
        let directory = TempDir::new("protocol-open-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");
        let length = on_disk.len() as u64;

        let response = respond(&request(&track, Some("bytes=0-")), true);

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len() as u64, length);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes 0-{}/{length}", length - 1)
        );
    }

    #[test]
    fn a_range_past_the_end_of_the_file_is_told_so() {
        let directory = TempDir::new("protocol-bad-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let length = std::fs::metadata(&track).expect("readable file").len();

        let response = respond(
            &request(&track, Some(&format!("bytes={}-{}", length + 10, length + 20))),
            true,
        );

        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes */{length}")
        );
    }

    #[test]
    fn a_request_for_several_pieces_at_once_gets_the_whole_file() {
        let directory = TempDir::new("protocol-multi-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");

        let response = respond(&request(&track, Some("bytes=0-3,8-11")), true);

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &on_disk);
    }

    #[test]
    fn a_file_that_is_no_longer_there_is_a_404() {
        let directory = TempDir::new("protocol-missing");
        let gone = directory.path().join("track.mp3");

        let response = respond(&request(&gone, None), true);

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn only_a_file_of_the_library_or_the_one_the_system_handed_over_is_playable() {
        let directory = TempDir::new("protocol-known");
        let track = mp3_with_tags(directory.path(), "track.mp3");
        let stranger = mp3_with_tags(directory.path(), "stranger.mp3");
        let document = directory.path().join("appunti.txt");
        std::fs::write(&document, b"testo").expect("file written");

        let mut library = crate::library::Library::new();
        crate::library::add_paths(&mut library, &[track.display().to_string()], 0);
        let state = LibraryState::new(directory.path().join("library.json"), library);
        let startup = StartupFile::from_arguments([stranger.clone()]);

        assert!(is_playable_now(&state, &startup, &track));
        assert!(is_playable_now(&state, &startup, &stranger));
        assert!(!is_playable_now(&state, &startup, &document));
        assert!(!is_playable_now(
            &state,
            &startup,
            &directory.path().join("mai-vista.mp3")
        ));
    }
