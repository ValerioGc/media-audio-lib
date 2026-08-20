//! The library file: the list of tracks the user added by hand.
//!
//! Nothing is scanned automatically. The file is versioned so future schema
//! changes can be migrated instead of discarded.

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{self, TrackMetadata};

/// v3 added the library `name`. Older files still load: the name defaults to the app name.
pub const SCHEMA_VERSION: u32 = 3;
pub const DEFAULT_LIBRARY_NAME: &str = "Media Audio Lib";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub path: String,
    pub title: String,
    #[serde(default)]
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration_ms: u64,
    pub format: String,
    pub has_cover: bool,
    pub added_at: u64,
}

impl Track {
    pub fn new(path: &Path, metadata: TrackMetadata, added_at: u64) -> Self {
        Self {
            id: track_id(path),
            path: path.display().to_string(),
            title: metadata.title.unwrap_or_else(|| file_stem_of(path)),
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year,
            genre: metadata.genre,
            duration_ms: metadata.duration_ms,
            format: metadata.format,
            has_cover: metadata.has_cover,
            added_at,
        }
    }
}

/// A track as shown to the user, enriched with the state of the file on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackView {
    #[serde(flatten)]
    pub track: Track,
    pub missing: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedImport {
    pub path: String,
    pub reason: String,
}

/// Outcome of an import: what entered the library, what was already there and what failed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddReport {
    pub added: Vec<Track>,
    pub duplicates: Vec<String>,
    pub failed: Vec<FailedImport>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LibraryImportStrategy {
    Replace,
    Merge,
    MergeSkipDuplicates,
}

/// Outcome of importing another library file into the active one.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryImportReport {
    pub added: usize,
    pub updated: usize,
    pub skipped: usize,
    pub missing: Vec<String>,
    pub total: usize,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct LibraryMaintenanceReport {
    pub refreshed: usize,
    pub deduplicated: usize,
    pub ids_updated: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub version: u32,
    #[serde(default = "default_library_name")]
    pub name: String,
    pub tracks: Vec<Track>,
}

impl Default for Library {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            name: default_library_name(),
            tracks: Vec::new(),
        }
    }
}

impl Library {
    pub fn new() -> Self {
        Self::default()
    }

    /// Reads the library file. A missing file simply means an empty library.
    pub fn load(path: &Path) -> AppResult<Self> {
        Self::load_with_version(path).map(|(library, _)| library)
    }

    /// Same as [`Library::load`], also reporting the schema version the file was stored
    /// with: entries written by an older schema miss the fields added since.
    pub fn load_with_version(path: &Path) -> AppResult<(Self, u32)> {
        if !path.exists() {
            return Ok((Self::new(), SCHEMA_VERSION));
        }

        let contents = std::fs::read_to_string(path)?;
        let library: Self = serde_json::from_str(&contents)?;

        if library.version > SCHEMA_VERSION {
            return Err(AppError::UnsupportedFormat(format!(
                "library with schema v{} (supported up to v{SCHEMA_VERSION})",
                library.version
            )));
        }

        let stored_version = library.version;

        Ok((
            Self {
                version: SCHEMA_VERSION,
                name: clean_library_name(&library.name).unwrap_or_else(default_library_name),
                tracks: library.tracks,
            },
            stored_version,
        ))
    }

    /// Writes through a temporary file so an interrupted save cannot truncate the library.
    pub fn save(&self, path: &Path) -> AppResult<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let temporary = temporary_path(path);
        std::fs::write(&temporary, serde_json::to_string_pretty(self)?)?;
        std::fs::rename(&temporary, path)?;

        Ok(())
    }

    pub fn tracks(&self) -> &[Track] {
        &self.tracks
    }

    pub fn rename(&mut self, name: &str) -> AppResult<String> {
        let name = clean_library_name(name)
            .ok_or_else(|| AppError::Validation("library name cannot be empty".to_owned()))?;

        self.name = name.clone();

        Ok(name)
    }

    pub fn len(&self) -> usize {
        self.tracks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tracks.is_empty()
    }

    pub fn get(&self, id: &str) -> Option<&Track> {
        self.tracks.iter().find(|track| track.id == id)
    }

    pub fn contains(&self, id: &str) -> bool {
        self.get(id).is_some()
    }

    pub fn contains_path(&self, path: &Path) -> bool {
        let key = canonical_key(path);
        self.tracks
            .iter()
            .any(|track| canonical_key(Path::new(&track.path)) == key)
    }

    /// Adds a track unless the same file is already tracked. Returns false on duplicates.
    pub fn add(&mut self, track: Track) -> bool {
        if self.contains(&track.id) || self.contains_path(Path::new(&track.path)) {
            return false;
        }

        self.tracks.push(track);
        true
    }

    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.tracks.len();
        self.tracks.retain(|track| track.id != id);
        before != self.tracks.len()
    }

    pub fn import(
        &mut self,
        imported: Library,
        strategy: LibraryImportStrategy,
    ) -> LibraryImportReport {
        let mut imported = imported;
        update_track_ids(&mut imported);
        let total = imported.tracks.len();
        let (imported_tracks, duplicate_imports) = unique_tracks(imported.tracks);
        let mut report = LibraryImportReport {
            total,
            skipped: duplicate_imports,
            missing: imported_tracks
                .iter()
                .filter(|track| !Path::new(&track.path).is_file())
                .map(|track| track.path.clone())
                .collect(),
            ..LibraryImportReport::default()
        };

        if strategy == LibraryImportStrategy::Replace {
            report.added = imported_tracks.len();
            self.name = imported.name;
            self.tracks = imported_tracks;
            return report;
        }

        for track in imported_tracks {
            if let Some(existing) = self
                .tracks
                .iter_mut()
                .find(|existing| same_track_file(existing, &track))
            {
                if strategy == LibraryImportStrategy::MergeSkipDuplicates {
                    report.skipped += 1;
                } else {
                    *existing = track;
                    report.updated += 1;
                }
            } else {
                self.tracks.push(track);
                report.added += 1;
            }
        }

        report
    }
}

fn default_library_name() -> String {
    DEFAULT_LIBRARY_NAME.to_owned()
}

fn clean_library_name(name: &str) -> Option<String> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    path.with_file_name(name)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Prefix(_) | Component::RootDir | Component::Normal(_) => {
                normalized.push(component.as_os_str());
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        path.to_path_buf()
    } else {
        normalized
    }
}

fn file_stem_of(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map_or_else(|| path.display().to_string(), str::to_owned)
}

/// Path used to compare two entries: resolved when possible, case insensitive on Windows.
pub fn canonical_key(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| normalize_path(path));
    let text = resolved.to_string_lossy().replace('\\', "/");
    let trimmed = text.strip_prefix("//?/").unwrap_or(&text).to_owned();

    if cfg!(windows) {
        trimmed.to_lowercase()
    } else {
        trimmed
    }
}

/// Stable identifier derived from the file location, so the same file keeps its id.
pub fn track_id(path: &Path) -> String {
    crate::hash::fnv1a_hex(&canonical_key(path))
}

fn same_track_file(first: &Track, second: &Track) -> bool {
    first.id == second.id
        || canonical_key(Path::new(&first.path)) == canonical_key(Path::new(&second.path))
}

fn unique_tracks(tracks: Vec<Track>) -> (Vec<Track>, usize) {
    let mut seen_ids = HashSet::new();
    let mut seen_paths = HashSet::new();
    let before = tracks.len();
    let tracks = tracks
        .into_iter()
        .filter(|track| {
            seen_ids.insert(track.id.clone())
                && seen_paths.insert(canonical_key(Path::new(&track.path)))
        })
        .collect::<Vec<_>>();

    let removed = before.saturating_sub(tracks.len());

    (tracks, removed)
}

pub fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// Imports every path, keeping going when one of them fails.
/// How deep a dropped folder is walked. Deep enough for any music collection, shallow
/// enough to stop a symlink loop from running forever.
const MAX_FOLDER_DEPTH: usize = 16;

/// Collects the supported audio files inside a folder, ignoring everything else.
fn collect_audio_files(directory: &Path, depth: usize, into: &mut Vec<PathBuf>) {
    if depth > MAX_FOLDER_DEPTH {
        return;
    }

    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };

    let mut found: Vec<PathBuf> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            collect_audio_files(&path, depth + 1, into);
        } else if metadata::is_supported(&path) {
            found.push(path);
        }
    }

    // Stable order, so an import report reads the same way twice.
    found.sort();
    into.extend(found);
}

/// Turns the selection into a list of files to import: folders are walked, while a file
/// named explicitly is kept as it is, so an unsupported one is still reported back.
pub fn expand_paths(paths: &[String]) -> Vec<String> {
    let mut expanded: Vec<String> = Vec::new();

    for path in paths {
        let candidate = Path::new(path);

        if candidate.is_dir() {
            let mut inside = Vec::new();
            collect_audio_files(candidate, 0, &mut inside);
            expanded.extend(inside.iter().map(|file| file.display().to_string()));
        } else {
            expanded.push(path.clone());
        }
    }

    expanded
}

pub fn add_paths(library: &mut Library, paths: &[String], added_at: u64) -> AddReport {
    let mut report = AddReport::default();

    for path in &expand_paths(paths) {
        let file = Path::new(path);

        match metadata::read_metadata(file) {
            Ok(metadata) => {
                let track = Track::new(file, metadata, added_at);

                if library.add(track.clone()) {
                    report.added.push(track);
                } else {
                    report.duplicates.push(path.clone());
                }
            }
            Err(error) => report.failed.push(FailedImport {
                path: path.clone(),
                reason: error.to_string(),
            }),
        }
    }

    report
}

pub fn update_track_ids(library: &mut Library) -> usize {
    let mut updated = 0;

    for track in &mut library.tracks {
        let id = track_id(Path::new(&track.path));

        if track.id != id {
            track.id = id;
            updated += 1;
        }
    }

    updated
}

pub fn remove_duplicate_paths(library: &mut Library) -> usize {
    let before = library.tracks.len();
    let mut seen_ids = HashSet::new();
    let mut seen_paths = HashSet::new();

    library.tracks.retain(|track| {
        seen_ids.insert(track.id.clone())
            && seen_paths.insert(canonical_key(Path::new(&track.path)))
    });

    before.saturating_sub(library.tracks.len())
}

/// Mirrors freshly written tags onto the tracked entry. `None` when the id is unknown.
pub fn apply_metadata(library: &mut Library, id: &str, metadata: TrackMetadata) -> Option<Track> {
    let track = library.tracks.iter_mut().find(|track| track.id == id)?;

    track.title = metadata
        .title
        .unwrap_or_else(|| file_stem_of(Path::new(&track.path)));
    track.artist = metadata.artist;
    track.album = metadata.album;
    track.year = metadata.year;
    track.genre = metadata.genre;
    track.duration_ms = metadata.duration_ms;
    track.has_cover = metadata.has_cover;

    Some(track.clone())
}

/// Re-reads the tags of every tracked file still on disk, and reports how many entries
/// changed. Used to fill in fields added after those entries were first saved.
pub fn refresh_metadata(library: &mut Library) -> usize {
    let identifiers: Vec<(String, PathBuf)> = library
        .tracks
        .iter()
        .map(|track| (track.id.clone(), PathBuf::from(&track.path)))
        .collect();

    let mut refreshed = 0;

    for (id, path) in identifiers {
        let Ok(metadata) = metadata::read_metadata(&path) else {
            continue;
        };

        let before = library.get(&id).cloned();
        if apply_metadata(library, &id, metadata).as_ref() != before.as_ref() {
            refreshed += 1;
        }
    }

    refreshed
}

pub fn maintain_from_disk(library: &mut Library) -> LibraryMaintenanceReport {
    let ids_updated = update_track_ids(library);
    let deduplicated = remove_duplicate_paths(library);
    let refreshed = refresh_metadata(library);

    LibraryMaintenanceReport {
        refreshed,
        deduplicated,
        ids_updated,
    }
}

pub fn path_of(library: &Library, id: &str) -> Option<PathBuf> {
    library.get(id).map(|track| PathBuf::from(&track.path))
}

pub fn to_views(library: &Library) -> Vec<TrackView> {
    library.tracks.iter().map(view_of_track).collect()
}

pub fn view_of(library: &Library, id: &str) -> Option<TrackView> {
    library.get(id).map(view_of_track)
}

fn view_of_track(track: &Track) -> TrackView {
    TrackView {
        track: track.clone(),
        missing: !Path::new(&track.path).is_file(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{corrupted_file, wav_with_tags, wav_without_tags, TempDir};

    fn sample_track(id: &str) -> Track {
        Track {
            id: id.to_owned(),
            path: format!("C:/music/{id}.mp3"),
            title: "Title".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 1000,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 42,
        }
    }

    #[test]
    fn new_library_is_empty_and_versioned() {
        let library = Library::new();

        assert!(library.is_empty());
        assert_eq!(library.version, SCHEMA_VERSION);
        assert_eq!(library.name, DEFAULT_LIBRARY_NAME);
    }

    #[test]
    fn missing_file_produces_an_empty_library() {
        let dir = TempDir::new("library-missing");

        let library = Library::load(&dir.path().join("library.json")).expect("loading riuscito");

        assert!(library.is_empty());
    }

    #[test]
    fn round_trips_on_disk() {
        let dir = TempDir::new("library-roundtrip");
        let file = dir.path().join("nested").join("library.json");
        let mut library = Library::new();
        library.rename("Jazz Archive").expect("rename succeeded");
        library.add(sample_track("aaa"));
        library.add(sample_track("bbb"));

        library.save(&file).expect("save succeeded");
        let reloaded = Library::load(&file).expect("loading riuscito");

        assert_eq!(reloaded, library);
        assert!(!file.with_file_name("library.json.tmp").exists());
    }

    #[test]
    fn overwrites_the_existing_file() {
        let dir = TempDir::new("library-overwrite");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        library.save(&file).expect("primo salvataggio");

        library.remove("aaa");
        library.save(&file).expect("secondo salvataggio");

        assert!(Library::load(&file).expect("loading riuscito").is_empty());
    }

    #[test]
    fn unreadable_file_is_a_serialization_error() {
        let dir = TempDir::new("library-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ non valido").expect("file written");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::Serialization(_)
        ));
    }

    #[test]
    fn rejects_a_newer_schema() {
        let dir = TempDir::new("library-future");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":99,"tracks":[]}"#).expect("file written");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::UnsupportedFormat(_)
        ));
    }

    #[test]
    fn accepts_an_older_schema_by_realigning_the_version() {
        let dir = TempDir::new("library-old");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":0,"tracks":[]}"#).expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn reads_a_v2_library_without_a_name() {
        let dir = TempDir::new("library-v2");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":2,"tracks":[]}"#).expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.name, DEFAULT_LIBRARY_NAME);
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn reads_a_v1_library_without_the_artist_field() {
        let dir = TempDir::new("library-v1");
        let file = dir.path().join("library.json");
        std::fs::write(
            &file,
            r#"{"version":1,"tracks":[{"id":"aaa","path":"C:/music/aaa.mp3",
               "title":"Title","album":null,"year":null,"genre":null,
               "durationMs":1000,"format":"mp3","hasCover":false,"addedAt":42}]}"#,
        )
        .expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.len(), 1);
        assert_eq!(library.get("aaa").expect("present").artist, None);
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn adds_and_removes_tracks() {
        let mut library = Library::new();

        assert!(library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
        assert!(library.get("aaa").is_some());
        assert!(library.remove("aaa"));
        assert!(library.is_empty());
    }

    #[test]
    fn renames_the_library_validating_the_name() {
        let mut library = Library::new();

        assert_eq!(
            library.rename("  Personal Archive  ").expect("rename"),
            "Personal Archive"
        );
        assert_eq!(library.name, "Personal Archive");
        assert!(matches!(
            library.rename("   ").unwrap_err(),
            AppError::Validation(_)
        ));
        assert_eq!(library.name, "Personal Archive");
    }

    #[test]
    fn ignores_removal_of_an_unknown_id() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.remove("zzz"));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn imports_by_replacing_the_current_library() {
        let mut library = Library::new();
        library.rename("Vecchia").expect("valid name");
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.rename("Nuova").expect("valid name");
        imported.add(sample_track("bbb"));

        let report = library.import(imported, LibraryImportStrategy::Replace);

        assert_eq!(library.name, "Nuova");
        assert_eq!(library.len(), 1);
        assert_eq!(library.tracks()[0].path, "C:/music/bbb.mp3");
        assert_eq!(report.added, 1);
        assert_eq!(report.total, 1);
    }

    #[test]
    fn imports_by_merging_and_updating_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.add(Track {
            title: "Aggiornato".to_owned(),
            ..sample_track("aaa")
        });
        imported.add(sample_track("bbb"));

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(library.len(), 2);
        assert!(library
            .tracks()
            .iter()
            .any(|track| track.path == "C:/music/aaa.mp3" && track.title == "Aggiornato"));
        assert_eq!(report.updated, 1);
        assert_eq!(report.added, 1);
    }

    #[test]
    fn imports_by_merging_and_skipping_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.add(Track {
            title: "Aggiornato".to_owned(),
            ..sample_track("aaa")
        });
        imported.add(sample_track("bbb"));

        let report = library.import(imported, LibraryImportStrategy::MergeSkipDuplicates);

        assert_eq!(library.len(), 2);
        assert_eq!(library.get("aaa").expect("present").title, "Title");
        assert_eq!(report.skipped, 1);
        assert_eq!(report.added, 1);
    }

    #[test]
    fn imports_by_matching_duplicate_paths_even_when_ids_differ() {
        let mut library = Library::new();
        let existing = Track {
            id: "old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            title: "Old title".to_owned(),
            ..sample_track("aaa")
        };
        let incoming = Track {
            id: "new-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            title: "New title".to_owned(),
            ..sample_track("bbb")
        };
        library.add(existing);
        let mut imported = Library::new();
        imported.tracks.push(incoming);

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(library.len(), 1);
        assert_eq!(library.tracks()[0].title, "New title");
        assert_eq!(report.updated, 1);
    }

    #[test]
    fn importing_by_replacement_keeps_one_entry_per_file() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let shared = Track {
            id: "first".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("bbb")
        };
        let duplicate = Track {
            id: "second".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("ccc")
        };
        let mut imported = Library::new();
        imported.tracks.push(shared);
        imported.tracks.push(duplicate);

        let report = library.import(imported, LibraryImportStrategy::Replace);

        assert_eq!(library.len(), 1);
        assert_eq!(report.total, 2);
        assert_eq!(report.added, 1);
        assert_eq!(report.skipped, 1);
    }

    #[test]
    fn import_reports_files_missing_on_disk() {
        let mut library = Library::new();
        let mut imported = Library::new();
        imported.add(sample_track("aaa"));

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(report.missing, vec!["C:/music/aaa.mp3"]);
    }

    #[test]
    fn rejects_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn rejects_tracks_pointing_to_the_same_file_even_with_different_ids() {
        let mut library = Library::new();
        let first = sample_track("aaa");
        let duplicate = Track {
            id: "different-id".to_owned(),
            ..first.clone()
        };

        assert!(library.add(first));
        assert!(!library.add(duplicate));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn id_depends_only_on_the_given_file() {
        let dir = TempDir::new("library-id");
        let path = wav_with_tags(dir.path(), "track.wav");
        let same_file = dir.path().join(".").join("track.wav");

        assert_eq!(track_id(&path), track_id(&same_file));
        assert_ne!(track_id(&path), track_id(&dir.path().join("altro.wav")));
    }

    #[test]
    fn canonical_key_normalizes_separators() {
        let key = canonical_key(Path::new("C:\\music\\track.mp3"));

        assert!(!key.contains('\\'));
        assert!(!key.starts_with("//?/"));
    }

    #[test]
    fn canonical_key_normalizes_current_directory_segments() {
        let dir = TempDir::new("library-key");
        let path = dir.path().join(".").join("track.wav");

        assert_eq!(
            canonical_key(&path),
            canonical_key(&dir.path().join("track.wav"))
        );
    }

    #[test]
    fn maintenance_realigns_ids_and_removes_duplicate_files() {
        let mut library = Library::new();
        let first = Track {
            id: "old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("aaa")
        };
        let duplicate = Track {
            id: "other-old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("bbb")
        };
        library.tracks.push(first);
        library.tracks.push(duplicate);

        let report = maintain_from_disk(&mut library);

        assert_eq!(library.len(), 1);
        assert_eq!(
            library.tracks()[0].id,
            track_id(Path::new("C:/music/shared.mp3"))
        );
        assert_eq!(report.ids_updated, 2);
        assert_eq!(report.deduplicated, 1);
    }

    #[test]
    fn imports_valid_files_and_reports_skipped_ones() {
        let dir = TempDir::new("library-import");
        let valido = wav_with_tags(dir.path(), "valido.wav");
        let rotto = corrupted_file(dir.path(), "rotto.mp3");
        let mut library = Library::new();

        let report = add_paths(
            &mut library,
            &[
                valido.display().to_string(),
                rotto.display().to_string(),
                "C:/music/assente.mp3".to_owned(),
                valido.display().to_string(),
            ],
            7,
        );

        assert_eq!(report.added.len(), 1);
        assert_eq!(report.duplicates.len(), 1);
        assert_eq!(report.failed.len(), 2);
        assert_eq!(library.len(), 1);
        assert_eq!(report.added[0].title, "Test Title");
        assert_eq!(report.added[0].added_at, 7);
    }

    #[test]
    fn uses_the_file_name_when_title_is_missing() {
        let dir = TempDir::new("library-fallback");
        let path = wav_without_tags(dir.path(), "senza-tag.wav");
        let mut library = Library::new();

        add_paths(&mut library, &[path.display().to_string()], 0);

        assert_eq!(library.tracks()[0].title, "senza-tag");
    }

    #[test]
    fn reports_files_missing_from_disk() {
        let dir = TempDir::new("library-views");
        let path = wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        add_paths(&mut library, &[path.display().to_string()], 0);

        assert!(!to_views(&library)[0].missing);

        std::fs::remove_file(&path).expect("file removed");

        assert!(to_views(&library)[0].missing);
    }

    #[test]
    fn verifies_one_tracked_file() {
        let dir = TempDir::new("library-view-one");
        let path = wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        add_paths(&mut library, &[path.display().to_string()], 0);
        let id = library.tracks()[0].id.clone();

        assert!(!view_of(&library, &id).expect("present").missing);
        assert!(view_of(&library, "zzz").is_none());

        std::fs::remove_file(&path).expect("file removed");

        assert!(view_of(&library, &id).expect("present").missing);
    }

    #[test]
    fn reflects_rewritten_tags_on_the_tracked_file() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated = apply_metadata(
            &mut library,
            "aaa",
            TrackMetadata {
                title: Some("Title nuovo".to_owned()),
                artist: Some("New Artist".to_owned()),
                album: Some("Album nuovo".to_owned()),
                year: Some(2011),
                genre: Some("Blues".to_owned()),
                duration_ms: 4242,
                format: "mp3".to_owned(),
                has_cover: true,
            },
        )
        .expect("track present");

        assert_eq!(updated.title, "Title nuovo");
        assert_eq!(library.get("aaa").expect("present").year, Some(2011));
        assert!(library.get("aaa").expect("present").has_cover);
        assert_eq!(library.get("aaa").expect("present").duration_ms, 4242);
    }

    #[test]
    fn uses_the_file_name_if_tags_still_have_no_title() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated =
            apply_metadata(&mut library, "aaa", TrackMetadata::default()).expect("track present");

        assert_eq!(updated.title, "aaa");
    }

    #[test]
    fn ignores_update_of_an_unknown_id() {
        let mut library = Library::new();

        assert!(apply_metadata(&mut library, "zzz", TrackMetadata::default()).is_none());
    }

    #[test]
    fn exposes_the_path_of_a_tracked_track() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert_eq!(
            path_of(&library, "aaa"),
            Some(PathBuf::from("C:/music/aaa.mp3"))
        );
        assert_eq!(path_of(&library, "zzz"), None);
    }

    #[test]
    fn added_time_is_a_plausible_epoch() {
        assert!(now_seconds() > 1_700_000_000);
    }
}
