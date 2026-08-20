//! Shared library state, guarded by a mutex and mirrored on disk.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use crate::error::{AppError, AppResult};
use crate::library::Library;

/// The library in memory together with the file it belongs to: switching library swaps
/// both at once, so a save can never land in the file of another library.
struct Active {
    file: PathBuf,
    library: Library,
}

pub struct LibraryState {
    active: Mutex<Active>,
}

impl LibraryState {
    pub fn new(file: PathBuf, library: Library) -> Self {
        Self {
            active: Mutex::new(Active { file, library }),
        }
    }

    /// Loads the library from `file`, starting empty when it cannot be read.
    ///
    /// Entries saved with an older schema are missing the fields added since, so their
    /// tags are re-read from disk once and the file is rewritten.
    pub fn from_file(file: PathBuf) -> Self {
        let (library, stored_version) = load_or_empty(&file);
        let state = Self::new(file, library);
        state.migrate_if_needed(stored_version);

        state
    }

    pub fn file(&self) -> AppResult<PathBuf> {
        Ok(self.lock()?.file.clone())
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Active>> {
        self.active
            .lock()
            .map_err(|error| AppError::State(error.to_string()))
    }

    pub fn read<T>(&self, action: impl FnOnce(&Library) -> T) -> AppResult<T> {
        Ok(action(&self.lock()?.library))
    }

    /// Applies a change and writes the library back to disk before returning.
    pub fn update<T>(&self, action: impl FnOnce(&mut Library) -> T) -> AppResult<T> {
        let mut active = self.lock()?;
        let outcome = action(&mut active.library);
        active.library.save(&active.file)?;

        Ok(outcome)
    }

    /// Loads another library file and makes it the current one.
    ///
    /// The library left behind needs no flush: every change is already written when it
    /// happens.
    pub fn switch_to(&self, file: PathBuf) -> AppResult<()> {
        let (library, stored_version) = load_or_empty(&file);

        {
            let mut active = self.lock()?;
            active.file = file;
            active.library = library;
        }

        self.migrate_if_needed(stored_version);

        Ok(())
    }

    fn migrate_if_needed(&self, stored_version: u32) {
        if stored_version >= crate::library::SCHEMA_VERSION {
            return;
        }

        match self.update(crate::library::refresh_metadata) {
            Ok(refreshed) => {
                eprintln!(
                    "library migrated to v{}: {refreshed} tracks reread from files",
                    crate::library::SCHEMA_VERSION
                );
            }
            Err(error) => eprintln!("library migration failed: {error}"),
        }
    }
}

fn load_or_empty(file: &Path) -> (Library, u32) {
    Library::load_with_version(file).unwrap_or_else(|error| {
        eprintln!("library not loaded ({error}), starting from an empty one");
        (Library::new(), crate::library::SCHEMA_VERSION)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::TempDir;
    use crate::library::Track;

    fn sample_track() -> Track {
        Track {
            id: "aaa".to_owned(),
            path: "C:/music/track.mp3".to_owned(),
            title: "Title".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 0,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 0,
        }
    }

    #[test]
    fn starts_from_an_empty_library_when_file_does_not_exist() {
        let dir = TempDir::new("state-empty");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        assert_eq!(state.read(Library::len).expect("read succeeded"), 0);
    }

    #[test]
    fn reloads_the_saved_library() {
        let dir = TempDir::new("state-reload");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track());
        library.save(&file).expect("save succeeded");

        let state = LibraryState::from_file(file);

        assert_eq!(state.read(Library::len).expect("read succeeded"), 1);
    }

    #[test]
    fn starts_empty_when_file_is_unreadable() {
        let dir = TempDir::new("state-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ non valido").expect("file written");

        let state = LibraryState::from_file(file);

        assert_eq!(state.read(Library::len).expect("read succeeded"), 0);
    }

    #[test]
    fn every_change_lands_on_disk() {
        let dir = TempDir::new("state-update");
        let file = dir.path().join("library.json");
        let state = LibraryState::from_file(file.clone());

        let added = state
            .update(|library| library.add(sample_track()))
            .expect("update succeeded");

        assert!(added);
        assert_eq!(Library::load(&file).expect("loading").len(), 1);
    }

    #[test]
    fn v1_library_is_migrated_by_rereading_tags_from_file() {
        let dir = TempDir::new("state-migration");
        let file = dir.path().join("library.json");
        let track = crate::fixtures::wav_with_tags(dir.path(), "track.wav");
        let id = crate::library::track_id(&track);

        // A v1 library: the artist field did not exist yet.
        std::fs::write(
            &file,
            format!(
                r#"{{"version":1,"tracks":[{{"id":"{id}","path":{path},
                   "title":"Title","album":null,"year":null,"genre":null,
                   "durationMs":0,"format":"wav","hasCover":false,"addedAt":42}}]}}"#,
                path = serde_json::to_string(&track.display().to_string()).expect("path"),
            ),
        )
        .expect("file written");

        let state = LibraryState::from_file(file.clone());

        let track = state
            .read(|library| library.get(&id).cloned())
            .expect("read succeeded")
            .expect("track present");
        assert_eq!(track.artist.as_deref(), Some("Test Artist"));
        assert_eq!(track.title, "Test Title");

        // The migration is persisted: restart does not need to run it again.
        let reloaded = Library::load(&file).expect("reloaded");
        assert_eq!(
            reloaded.get(&id).expect("present").artist.as_deref(),
            Some("Test Artist")
        );
        assert_eq!(reloaded.version, crate::library::SCHEMA_VERSION);
    }

    #[test]
    fn already_updated_library_is_not_reworked() {
        let dir = TempDir::new("state-no-migration");
        let file = dir.path().join("library.json");
        let track = crate::fixtures::wav_with_tags(dir.path(), "track.wav");

        // Current-schema entry, with a title different from the file tags:
        // if a reread started, it would be overwritten.
        let mut library = Library::new();
        library.add(Track {
            id: crate::library::track_id(&track),
            path: track.display().to_string(),
            title: "User chosen title".to_owned(),
            ..sample_track()
        });
        library.save(&file).expect("save succeeded");

        let state = LibraryState::from_file(file);

        assert_eq!(
            state
                .read(|library| library.tracks()[0].title.clone())
                .expect("read"),
            "User chosen title"
        );
    }

    #[test]
    fn exposes_the_library_file_path() {
        let dir = TempDir::new("state-path");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());

        assert_eq!(state.file().expect("path read"), file);
    }
}
