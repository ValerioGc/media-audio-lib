//! The library file: the list of tracks the user added by hand.
//!
//! Nothing is scanned automatically. The file is versioned so future schema
//! changes can be migrated instead of discarded.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{self, TrackMetadata};

/// v2 added the `artist` field. Older files still load: the field defaults to absent.
pub const SCHEMA_VERSION: u32 = 2;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub version: u32,
    pub tracks: Vec<Track>,
}

impl Default for Library {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
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
                "libreria con schema v{} (supportato fino a v{SCHEMA_VERSION})",
                library.version
            )));
        }

        let stored_version = library.version;

        Ok((
            Self {
                version: SCHEMA_VERSION,
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

    /// Adds a track unless the same file is already tracked. Returns false on duplicates.
    pub fn add(&mut self, track: Track) -> bool {
        if self.contains(&track.id) {
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
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    path.with_file_name(name)
}

fn file_stem_of(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map_or_else(|| path.display().to_string(), str::to_owned)
}

/// Path used to compare two entries: resolved when possible, case insensitive on Windows.
pub fn canonical_key(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
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

pub fn path_of(library: &Library, id: &str) -> Option<PathBuf> {
    library.get(id).map(|track| PathBuf::from(&track.path))
}

pub fn to_views(library: &Library) -> Vec<TrackView> {
    library
        .tracks
        .iter()
        .map(|track| TrackView {
            track: track.clone(),
            missing: !Path::new(&track.path).is_file(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{corrupted_file, wav_with_tags, wav_without_tags, TempDir};

    fn sample_track(id: &str) -> Track {
        Track {
            id: id.to_owned(),
            path: format!("C:/musica/{id}.mp3"),
            title: "Titolo".to_owned(),
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
    fn una_libreria_nuova_e_vuota_e_versionata() {
        let library = Library::new();

        assert!(library.is_empty());
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn il_file_mancante_produce_una_libreria_vuota() {
        let dir = TempDir::new("library-missing");

        let library =
            Library::load(&dir.path().join("library.json")).expect("caricamento riuscito");

        assert!(library.is_empty());
    }

    #[test]
    fn esegue_il_round_trip_su_disco() {
        let dir = TempDir::new("library-roundtrip");
        let file = dir.path().join("nested").join("library.json");
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        library.add(sample_track("bbb"));

        library.save(&file).expect("salvataggio riuscito");
        let reloaded = Library::load(&file).expect("caricamento riuscito");

        assert_eq!(reloaded, library);
        assert!(!file.with_file_name("library.json.tmp").exists());
    }

    #[test]
    fn sovrascrive_il_file_esistente() {
        let dir = TempDir::new("library-overwrite");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        library.save(&file).expect("primo salvataggio");

        library.remove("aaa");
        library.save(&file).expect("secondo salvataggio");

        assert!(Library::load(&file)
            .expect("caricamento riuscito")
            .is_empty());
    }

    #[test]
    fn un_file_illeggibile_e_un_errore_di_serializzazione() {
        let dir = TempDir::new("library-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ non valido").expect("file scritto");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::Serialization(_)
        ));
    }

    #[test]
    fn rifiuta_uno_schema_piu_recente() {
        let dir = TempDir::new("library-future");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":99,"tracks":[]}"#).expect("file scritto");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::UnsupportedFormat(_)
        ));
    }

    #[test]
    fn accetta_uno_schema_precedente_riallineando_la_versione() {
        let dir = TempDir::new("library-old");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":0,"tracks":[]}"#).expect("file scritto");

        let library = Library::load(&file).expect("caricamento riuscito");

        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn legge_una_libreria_v1_senza_il_campo_autore() {
        let dir = TempDir::new("library-v1");
        let file = dir.path().join("library.json");
        std::fs::write(
            &file,
            r#"{"version":1,"tracks":[{"id":"aaa","path":"C:/musica/aaa.mp3",
               "title":"Titolo","album":null,"year":null,"genre":null,
               "durationMs":1000,"format":"mp3","hasCover":false,"addedAt":42}]}"#,
        )
        .expect("file scritto");

        let library = Library::load(&file).expect("caricamento riuscito");

        assert_eq!(library.len(), 1);
        assert_eq!(library.get("aaa").expect("presente").artist, None);
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn aggiunge_e_rimuove_i_brani() {
        let mut library = Library::new();

        assert!(library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
        assert!(library.get("aaa").is_some());
        assert!(library.remove("aaa"));
        assert!(library.is_empty());
    }

    #[test]
    fn ignora_la_rimozione_di_un_id_sconosciuto() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.remove("zzz"));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn rifiuta_i_duplicati() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn l_id_dipende_solo_dal_file_indicato() {
        let dir = TempDir::new("library-id");
        let path = wav_with_tags(dir.path(), "brano.wav");
        let same_file = dir.path().join(".").join("brano.wav");

        assert_eq!(track_id(&path), track_id(&same_file));
        assert_ne!(track_id(&path), track_id(&dir.path().join("altro.wav")));
    }

    #[test]
    fn la_chiave_canonica_normalizza_i_separatori() {
        let key = canonical_key(Path::new("C:\\musica\\brano.mp3"));

        assert!(!key.contains('\\'));
        assert!(!key.starts_with("//?/"));
    }

    #[test]
    fn importa_i_file_validi_e_riporta_gli_scarti() {
        let dir = TempDir::new("library-import");
        let valido = wav_with_tags(dir.path(), "valido.wav");
        let rotto = corrupted_file(dir.path(), "rotto.mp3");
        let mut library = Library::new();

        let report = add_paths(
            &mut library,
            &[
                valido.display().to_string(),
                rotto.display().to_string(),
                "C:/musica/assente.mp3".to_owned(),
                valido.display().to_string(),
            ],
            7,
        );

        assert_eq!(report.added.len(), 1);
        assert_eq!(report.duplicates.len(), 1);
        assert_eq!(report.failed.len(), 2);
        assert_eq!(library.len(), 1);
        assert_eq!(report.added[0].title, "Titolo di prova");
        assert_eq!(report.added[0].added_at, 7);
    }

    #[test]
    fn usa_il_nome_del_file_quando_manca_il_titolo() {
        let dir = TempDir::new("library-fallback");
        let path = wav_without_tags(dir.path(), "senza-tag.wav");
        let mut library = Library::new();

        add_paths(&mut library, &[path.display().to_string()], 0);

        assert_eq!(library.tracks()[0].title, "senza-tag");
    }

    #[test]
    fn segnala_i_file_spariti_dal_disco() {
        let dir = TempDir::new("library-views");
        let path = wav_with_tags(dir.path(), "brano.wav");
        let mut library = Library::new();
        add_paths(&mut library, &[path.display().to_string()], 0);

        assert!(!to_views(&library)[0].missing);

        std::fs::remove_file(&path).expect("file rimosso");

        assert!(to_views(&library)[0].missing);
    }

    #[test]
    fn riflette_i_tag_riscritti_sul_brano_tracciato() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated = apply_metadata(
            &mut library,
            "aaa",
            TrackMetadata {
                title: Some("Titolo nuovo".to_owned()),
                artist: Some("Autore nuovo".to_owned()),
                album: Some("Album nuovo".to_owned()),
                year: Some(2011),
                genre: Some("Blues".to_owned()),
                duration_ms: 4242,
                format: "mp3".to_owned(),
                has_cover: true,
            },
        )
        .expect("brano presente");

        assert_eq!(updated.title, "Titolo nuovo");
        assert_eq!(library.get("aaa").expect("presente").year, Some(2011));
        assert!(library.get("aaa").expect("presente").has_cover);
        assert_eq!(library.get("aaa").expect("presente").duration_ms, 4242);
    }

    #[test]
    fn usa_il_nome_del_file_se_i_tag_restano_senza_titolo() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated =
            apply_metadata(&mut library, "aaa", TrackMetadata::default()).expect("brano presente");

        assert_eq!(updated.title, "aaa");
    }

    #[test]
    fn ignora_l_aggiornamento_di_un_id_sconosciuto() {
        let mut library = Library::new();

        assert!(apply_metadata(&mut library, "zzz", TrackMetadata::default()).is_none());
    }

    #[test]
    fn espone_il_percorso_di_un_brano_tracciato() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert_eq!(
            path_of(&library, "aaa"),
            Some(PathBuf::from("C:/musica/aaa.mp3"))
        );
        assert_eq!(path_of(&library, "zzz"), None);
    }

    #[test]
    fn il_momento_di_aggiunta_e_un_epoch_plausibile() {
        assert!(now_seconds() > 1_700_000_000);
    }
}
