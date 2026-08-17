//! The library file: the list of tracks the user added by hand.
//!
//! Nothing is scanned automatically. The file is versioned so future schema
//! changes can be migrated instead of discarded.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{self, TrackMetadata};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub path: String,
    pub title: String,
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
        if !path.exists() {
            return Ok(Self::new());
        }

        let contents = std::fs::read_to_string(path)?;
        let library: Self = serde_json::from_str(&contents)?;

        if library.version > SCHEMA_VERSION {
            return Err(AppError::UnsupportedFormat(format!(
                "libreria con schema v{} (supportato fino a v{SCHEMA_VERSION})",
                library.version
            )));
        }

        Ok(Self {
            version: SCHEMA_VERSION,
            tracks: library.tracks,
        })
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
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    let mut hash = OFFSET_BASIS;
    for byte in canonical_key(path).as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(PRIME);
    }

    format!("{hash:016x}")
}

pub fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// Imports every path, keeping going when one of them fails.
pub fn add_paths(library: &mut Library, paths: &[String], added_at: u64) -> AddReport {
    let mut report = AddReport::default();

    for path in paths {
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
    fn il_momento_di_aggiunta_e_un_epoch_plausibile() {
        assert!(now_seconds() > 1_700_000_000);
    }
}
