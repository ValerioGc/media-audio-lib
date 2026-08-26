#[cfg(test)]
mod tests {
    use super::*;

    fn page(url: &str) -> Url {
        Url::parse(url).expect("the address parses")
    }

    #[test]
    fn the_pages_of_the_app_are_its_own_and_the_files_it_plays() {
        assert!(is_app_page(&page("tauri://localhost/index.html")));
        assert!(is_app_page(&page("http://tauri.localhost/index.html?view=mini")));
        assert!(is_app_page(&page("track://localhost/C:/music/track.mp3")));
        // The dev server, while developing.
        assert!(is_app_page(&page("http://localhost:1420/")));
    }

    #[test]
    fn nothing_else_is_a_page_of_this_app() {
        assert!(!is_app_page(&page("https://example.com/")));
        assert!(!is_app_page(&page("http://valeriogc.github.io/tune-lib/")));
        assert!(!is_app_page(&page("file:///C:/Windows/System32/")));
        // A host that only looks like the local one.
        assert!(!is_app_page(&page("https://tauri.localhost.example.com/")));
    }
}
