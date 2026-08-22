//! The library file: the list of tracks the user added by hand.
//!
//! Nothing is scanned automatically. The file is versioned so future schema
//! changes can be migrated instead of discarded.

use std::collections::{BTreeSet, HashSet};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{self, Cover, TrackMetadata};

/// v5 added library-level artwork for artists and genres, filled on export when absent.
pub const SCHEMA_VERSION: u32 = 5;
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
pub struct LibraryArtwork {
    pub name: String,
    pub cover: Cover,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMetadata {
    pub artists: Vec<String>,
    pub albums: Vec<String>,
    pub genres: Vec<String>,
    #[serde(default)]
    pub artist_artwork: Vec<LibraryArtwork>,
    #[serde(default)]
    pub genre_artwork: Vec<LibraryArtwork>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub version: u32,
    #[serde(default = "default_library_name")]
    pub name: String,
    #[serde(default)]
    pub metadata: LibraryMetadata,
    pub tracks: Vec<Track>,
}

impl Default for Library {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            name: default_library_name(),
            metadata: LibraryMetadata::default(),
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

        ensure_readable_size(path, MAX_LIBRARY_FILE_BYTES)?;

        let contents = std::fs::read_to_string(path)?;
        let library: Self = serde_json::from_str(&contents)?;

        if library.version > SCHEMA_VERSION {
            return Err(AppError::UnsupportedFormat(format!(
                "library with schema v{} (supported up to v{SCHEMA_VERSION})",
                library.version
            )));
        }

        let stored_version = library.version;

        let mut loaded = Self {
            version: SCHEMA_VERSION,
            // Repaired rather than refused: a name that arrives too long on disk is not a
            // reason to leave the user unable to open their own library.
            name: clean_library_name(&library.name)
                .map(|name| shorten_library_name(&name))
                .unwrap_or_else(default_library_name),
            metadata: library.metadata,
            tracks: library.tracks,
        };
        loaded.sync_metadata();

        Ok((loaded, stored_version))
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

    pub fn metadata(&self) -> &LibraryMetadata {
        &self.metadata
    }

    pub fn rename(&mut self, name: &str) -> AppResult<String> {
        let name = clean_library_name(name).ok_or_else(|| {
            AppError::Validation("il nome della libreria non può essere vuoto".to_owned())
        })?;

        if name.chars().count() > MAX_LIBRARY_NAME_LENGTH {
            return Err(AppError::Validation(format!(
                "il nome della libreria supera i {MAX_LIBRARY_NAME_LENGTH} caratteri"
            )));
        }

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

    pub fn sync_metadata(&mut self) {
        let existing_artist_artwork = self.metadata.artist_artwork.clone();
        let existing_genre_artwork = self.metadata.genre_artwork.clone();
        self.metadata = metadata_of(&self.tracks);
        self.metadata.artist_artwork =
            keep_artwork_for(existing_artist_artwork, &self.metadata.artists);
        self.metadata.genre_artwork =
            keep_artwork_for(existing_genre_artwork, &self.metadata.genres);
    }

    pub fn fill_missing_artwork(&mut self) -> usize {
        self.sync_metadata();

        fill_missing_artwork(
            &mut self.metadata.artist_artwork,
            &self.metadata.artists,
            &self.tracks,
            |track| track.artist.as_ref(),
        ) + fill_missing_artwork(
            &mut self.metadata.genre_artwork,
            &self.metadata.genres,
            &self.tracks,
            |track| track.genre.as_ref(),
        )
    }

    fn merge_artwork_from(&mut self, metadata: &LibraryMetadata) {
        merge_artwork(&mut self.metadata.artist_artwork, &metadata.artist_artwork);
        merge_artwork(&mut self.metadata.genre_artwork, &metadata.genre_artwork);
    }

    /// Adds a track unless the same file is already tracked. Returns false on duplicates.
    pub fn add(&mut self, track: Track) -> bool {
        if self.contains(&track.id) || self.contains_path(Path::new(&track.path)) {
            return false;
        }

        self.tracks.push(track);
        self.sync_metadata();
        true
    }

    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.tracks.len();
        self.tracks.retain(|track| track.id != id);
        let removed = before != self.tracks.len();

        if removed {
            self.sync_metadata();
        }

        removed
    }

    pub fn import(
        &mut self,
        imported: Library,
        strategy: LibraryImportStrategy,
    ) -> LibraryImportReport {
        let mut imported = imported;
        update_track_ids(&mut imported);
        let imported_metadata = imported.metadata.clone();
        let total = imported.tracks.len();
        let unplayable = drop_unplayable_tracks(&mut imported);
        let (imported_tracks, duplicate_imports) = unique_tracks(imported.tracks);
        let mut report = LibraryImportReport {
            total,
            skipped: duplicate_imports + unplayable,
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
            self.metadata = imported_metadata;
            self.tracks = imported_tracks;
            self.sync_metadata();
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

        self.merge_artwork_from(&imported_metadata);
        self.sync_metadata();

        report
    }
}

fn metadata_of(tracks: &[Track]) -> LibraryMetadata {
    fn collect(tracks: &[Track], value: impl Fn(&Track) -> Option<&String>) -> Vec<String> {
        tracks
            .iter()
            .filter_map(value)
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    }

    LibraryMetadata {
        artists: collect(tracks, |track| track.artist.as_ref()),
        albums: collect(tracks, |track| track.album.as_ref()),
        genres: collect(tracks, |track| track.genre.as_ref()),
        artist_artwork: Vec::new(),
        genre_artwork: Vec::new(),
    }
}

fn keep_artwork_for(artwork: Vec<LibraryArtwork>, names: &[String]) -> Vec<LibraryArtwork> {
    let known = names.iter().map(String::as_str).collect::<HashSet<_>>();
    let mut seen = HashSet::new();

    artwork
        .into_iter()
        .filter_map(|artwork| {
            let name = artwork.name.trim();

            if name.is_empty() || !known.contains(name) || !seen.insert(name.to_owned()) {
                return None;
            }

            Some(LibraryArtwork {
                name: name.to_owned(),
                cover: artwork.cover,
            })
        })
        .collect()
}

fn merge_artwork(target: &mut Vec<LibraryArtwork>, source: &[LibraryArtwork]) {
    let mut existing = target
        .iter()
        .map(|artwork| artwork.name.clone())
        .collect::<HashSet<_>>();

    target.extend(source.iter().filter_map(|artwork| {
        let name = artwork.name.trim();

        if name.is_empty() || !existing.insert(name.to_owned()) {
            return None;
        }

        Some(LibraryArtwork {
            name: name.to_owned(),
            cover: artwork.cover.clone(),
        })
    }));
}

fn fill_missing_artwork(
    artwork: &mut Vec<LibraryArtwork>,
    names: &[String],
    tracks: &[Track],
    value: impl Fn(&Track) -> Option<&String>,
) -> usize {
    let mut existing = artwork
        .iter()
        .map(|artwork| artwork.name.clone())
        .collect::<HashSet<_>>();
    let mut added = 0;

    for name in names {
        if existing.contains(name) {
            continue;
        }

        let Some(cover) = tracks
            .iter()
            .filter(|track| {
                track.has_cover
                    && Path::new(&track.path).is_file()
                    && value(track).is_some_and(|value| value.trim() == name)
            })
            .find_map(|track| {
                metadata::read_cover(Path::new(&track.path))
                    .ok()
                    .and_then(|read| read.cover)
            })
        else {
            continue;
        };

        artwork.push(LibraryArtwork {
            name: name.clone(),
            cover,
        });
        existing.insert(name.clone());
        added += 1;
    }

    added
}

fn default_library_name() -> String {
    DEFAULT_LIBRARY_NAME.to_owned()
}

/// How large a library file may be before it is refused.
///
/// A library carries the artwork of its artists and genres inside it, so it is legitimately
/// larger than a plain list — but it is read whole into memory, and the file it is read
/// from is one the user picked in a dialog. Room for a collection nobody has, and a wall
/// before an unrelated file empties the machine's memory.
pub const MAX_LIBRARY_FILE_BYTES: u64 = 256 * 1024 * 1024;

/// How long the name of a library may be.
///
/// It is shown in the title bar, in the switcher and in the settings: past this it stops
/// being a name and starts being a layout problem.
pub const MAX_LIBRARY_NAME_LENGTH: usize = 120;

/// Refuses a file larger than `max_bytes`, before anything reads it into memory.
fn ensure_readable_size(path: &Path, max_bytes: u64) -> AppResult<()> {
    let size = std::fs::metadata(path)?.len();

    if size > max_bytes {
        return Err(AppError::Validation(format!(
            "file di libreria troppo grande: massimo {} MB",
            MAX_LIBRARY_FILE_BYTES / (1024 * 1024)
        )));
    }

    Ok(())
}

fn shorten_library_name(name: &str) -> String {
    name.chars().take(MAX_LIBRARY_NAME_LENGTH).collect()
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
        } else if metadata::is_supported(&path) && !metadata::write::is_staging_file(&path) {
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

    let removed = before.saturating_sub(library.tracks.len());

    if removed > 0 {
        library.sync_metadata();
    }

    removed
}

/// Mirrors freshly written tags onto the tracked entry. `None` when the id is unknown.
pub fn apply_metadata(library: &mut Library, id: &str, metadata: TrackMetadata) -> Option<Track> {
    let position = library.tracks.iter().position(|track| track.id == id)?;
    let track = &mut library.tracks[position];

    track.title = metadata
        .title
        .unwrap_or_else(|| file_stem_of(Path::new(&track.path)));
    track.artist = metadata.artist;
    track.album = metadata.album;
    track.year = metadata.year;
    track.genre = metadata.genre;
    track.duration_ms = metadata.duration_ms;
    track.has_cover = metadata.has_cover;

    let updated = track.clone();
    library.sync_metadata();

    Some(updated)
}

/// Re-reads the tags of one tracked file and returns the entry as it now stands.
///
/// Cheap enough for the moments that need the truth of the file rather than the last thing
/// the library heard about it: opening the editor, and starting the playback.
pub fn refresh_track(library: &mut Library, id: &str) -> Option<TrackView> {
    let path = path_of(library, id)?;

    if let Ok(metadata) = metadata::read_metadata(&path) {
        apply_metadata(library, id, metadata);
    }

    view_of(library, id)
}

/// Re-reads the tags of every tracked file still on disk, and reports how many entries
/// changed. Used to fill in fields added after those entries were first saved.
pub fn refresh_metadata(library: &mut Library) -> usize {
    let files = files_to_reread(library);

    apply_reread(library, read_all_metadata(&files))
}

/// How many files are read at once when the library is gone through.
///
/// Reading a tag is mostly waiting on the disk, so a handful of threads finish a large
/// library several times sooner than one. More than a handful only queues up on the same
/// device.
const REREAD_THREADS: usize = 4;

/// The files of the library, paired with the entry each belongs to.
pub fn files_to_reread(library: &Library) -> Vec<(String, PathBuf)> {
    library
        .tracks
        .iter()
        .map(|track| (track.id.clone(), PathBuf::from(&track.path)))
        .collect()
}

/// Reads the tags of every file, on a few threads, touching no library.
///
/// Kept apart from the library on purpose: this is the slow half, and holding the library
/// while it runs is what used to leave the window unable to answer for anything else.
pub fn read_all_metadata(files: &[(String, PathBuf)]) -> Vec<(String, TrackMetadata)> {
    let next = std::sync::atomic::AtomicUsize::new(0);
    let read = std::sync::Mutex::new(Vec::with_capacity(files.len()));

    std::thread::scope(|scope| {
        for _ in 0..REREAD_THREADS.min(files.len().max(1)) {
            scope.spawn(|| loop {
                let index = next.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                let Some((id, path)) = files.get(index) else {
                    return;
                };

                if let Ok(metadata) = metadata::read_metadata(path) {
                    if let Ok(mut read) = read.lock() {
                        read.push((id.clone(), metadata));
                    }
                }
            });
        }
    });

    read.into_inner().unwrap_or_default()
}

/// Writes back what was read, and says how many entries it changed.
pub fn apply_reread(library: &mut Library, read: Vec<(String, TrackMetadata)>) -> usize {
    let mut refreshed = 0;

    for (id, metadata) in read {
        let before = library.get(&id).cloned();

        if apply_metadata(library, &id, metadata).as_ref() != before.as_ref() {
            refreshed += 1;
        }
    }

    refreshed
}

/// The part of the maintenance that only looks at paths: cheap enough to run while the
/// library is being opened, unlike re-reading the tags of every file.
pub fn maintain_paths(library: &mut Library) -> LibraryMaintenanceReport {
    let ids_updated = update_track_ids(library);
    let deduplicated = remove_duplicate_paths(library);
    library.sync_metadata();

    LibraryMaintenanceReport {
        refreshed: 0,
        deduplicated,
        ids_updated,
    }
}

/// Drops the entries that do not name an audio file, and says how many went.
///
/// A library file is made to be handed around, so what arrives in one is not this app's
/// own writing. An entry naming something else — a document, a key, a device — would
/// otherwise become a path the app treats as one of its own and hands to the webview to
/// play. Only the name is judged here: a file that is merely missing is reported as
/// missing, not thrown away.
fn drop_unplayable_tracks(library: &mut Library) -> usize {
    let before = library.tracks.len();

    library
        .tracks
        .retain(|track| metadata::is_supported(Path::new(&track.path)));

    before - library.tracks.len()
}

/// The folders the files of the library live in, one entry each.
///
/// An edit stages its copy beside the file it edits, so these are the only folders where
/// this app can have left something of its own behind.
pub fn track_directories(library: &Library) -> Vec<PathBuf> {
    let mut directories: Vec<PathBuf> = Vec::new();

    for track in &library.tracks {
        if let Some(directory) = Path::new(&track.path).parent() {
            let directory = directory.to_path_buf();

            if !directories.contains(&directory) {
                directories.push(directory);
            }
        }
    }

    directories
}

/// Files of the library that are no longer where they were imported from.
pub fn missing_paths(library: &Library) -> Vec<String> {
    library
        .tracks
        .iter()
        .filter(|track| !Path::new(&track.path).is_file())
        .map(|track| track.path.clone())
        .collect()
}

pub fn maintain_from_disk(library: &mut Library) -> LibraryMaintenanceReport {
    let ids_updated = update_track_ids(library);
    let deduplicated = remove_duplicate_paths(library);
    let refreshed = refresh_metadata(library);
    library.sync_metadata();

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
    include!("../../../tests/backend/library/mod.rs");
}
