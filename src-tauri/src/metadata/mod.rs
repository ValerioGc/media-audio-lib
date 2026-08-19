//! Reading of audio tags and cover art.
//!
//! Every supported format goes through `lofty`, so adding one is a matter of
//! listing its extension in [`SUPPORTED_EXTENSIONS`].

pub mod cover_cache;
pub mod write;

pub use cover_cache::CoverCache;
pub use write::{write_cover, write_metadata, MetadataUpdate};

use std::path::Path;

use base64::Engine as _;
use lofty::prelude::{Accessor, AudioFile, ItemKey, TaggedFileExt};
use lofty::tag::Tag;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const SUPPORTED_EXTENSIONS: [&str; 5] = ["mp3", "flac", "m4a", "ogg", "wav"];

/// Tags read from an audio file, exactly as stored: no fallback is applied here.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration_ms: u64,
    pub format: String,
    pub has_cover: bool,
}

/// Cover art encoded for the webview, ready to be used in a `data:` URL.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cover {
    pub mime_type: String,
    pub data: String,
}

/// Lowercase extension without the dot, empty when the path has none.
pub fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_lowercase)
        .unwrap_or_default()
}

pub fn is_supported(path: &Path) -> bool {
    SUPPORTED_EXTENSIONS.contains(&extension_of(path).as_str())
}

/// Rejects paths that cannot be imported before any parsing is attempted.
pub fn ensure_importable(path: &Path) -> AppResult<()> {
    if !path.is_file() {
        return Err(AppError::NotFound(path.display().to_string()));
    }

    if !is_supported(path) {
        return Err(AppError::UnsupportedFormat(extension_of(path)));
    }

    Ok(())
}

/// Reads the release year from the timestamp field, falling back to the plain year item.
fn year_of(tag: &Tag) -> Option<u32> {
    if let Some(timestamp) = tag.date() {
        return Some(u32::from(timestamp.year));
    }

    tag.get_string(ItemKey::Year)
        .or_else(|| tag.get_string(ItemKey::RecordingDate))
        .and_then(|value| value.get(..4).unwrap_or(value).parse().ok())
}

pub(crate) fn read_tagged_file(path: &Path) -> AppResult<lofty::file::TaggedFile> {
    ensure_importable(path)?;

    lofty::read_from_path(path).map_err(|error| AppError::InvalidAudio(error.to_string()))
}

pub fn read_metadata(path: &Path) -> AppResult<TrackMetadata> {
    let tagged_file = read_tagged_file(path)?;
    let duration_ms = u64::try_from(tagged_file.properties().duration().as_millis()).unwrap_or(0);
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let Some(tag) = tag else {
        return Ok(TrackMetadata {
            duration_ms,
            format: extension_of(path),
            ..TrackMetadata::default()
        });
    };

    Ok(TrackMetadata {
        title: tag.title().map(|value| value.to_string()),
        artist: tag.artist().map(|value| value.to_string()),
        album: tag.album().map(|value| value.to_string()),
        year: year_of(tag),
        genre: tag.genre().map(|value| value.to_string()),
        duration_ms,
        format: extension_of(path),
        has_cover: !tag.pictures().is_empty(),
    })
}

pub fn read_cover(path: &Path) -> AppResult<Option<Cover>> {
    let tagged_file = read_tagged_file(path)?;

    let picture = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
        .and_then(|tag| tag.pictures().first());

    Ok(picture.map(|picture| Cover {
        mime_type: picture.mime_type().map_or_else(
            || "application/octet-stream".to_owned(),
            ToString::to_string,
        ),
        data: base64::engine::general_purpose::STANDARD.encode(picture.data()),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{
        corrupted_file, flac_with_tags, mp3_with_tags, wav_with_cover, wav_with_tags, TempDir,
    };

    #[test]
    fn estrae_l_estensione_in_minuscolo() {
        assert_eq!(extension_of(Path::new("C:/musica/Brano.MP3")), "mp3");
        assert_eq!(extension_of(Path::new("/musica/brano")), "");
    }

    #[test]
    fn riconosce_solo_i_formati_dichiarati() {
        assert!(is_supported(Path::new("brano.mp3")));
        assert!(is_supported(Path::new("brano.FLAC")));
        assert!(!is_supported(Path::new("copertina.png")));
    }

    #[test]
    fn rifiuta_i_file_inesistenti() {
        let error = ensure_importable(Path::new("C:/musica/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn rifiuta_i_formati_non_supportati() {
        let dir = TempDir::new("metadata-unsupported");
        let path = dir.path().join("nota.txt");
        std::fs::write(&path, b"non audio").expect("file di test scritto");

        let error = ensure_importable(&path).unwrap_err();

        assert!(matches!(error, AppError::UnsupportedFormat(extension) if extension == "txt"));
    }

    #[test]
    fn rifiuta_i_file_audio_corrotti() {
        let dir = TempDir::new("metadata-corrupted");
        let path = corrupted_file(dir.path(), "rotto.mp3");

        let error = read_metadata(&path).unwrap_err();

        assert!(matches!(error, AppError::InvalidAudio(_)));
    }

    #[test]
    fn legge_i_tag_di_un_wav() {
        let dir = TempDir::new("metadata-wav");
        let path = wav_with_tags(dir.path(), "brano.wav");

        let metadata = read_metadata(&path).expect("metadati letti");

        assert_eq!(metadata.title.as_deref(), Some("Titolo di prova"));
        assert_eq!(metadata.artist.as_deref(), Some("Autore di prova"));
        assert_eq!(metadata.album.as_deref(), Some("Album di prova"));
        assert_eq!(metadata.year, Some(1999));
        assert_eq!(metadata.genre.as_deref(), Some("Rock"));
        assert_eq!(metadata.format, "wav");
        assert!(!metadata.has_cover);
    }

    #[test]
    fn legge_i_tag_di_un_mp3() {
        let dir = TempDir::new("metadata-mp3");
        let path = mp3_with_tags(dir.path(), "brano.mp3");

        let metadata = read_metadata(&path).expect("metadati letti");

        assert_eq!(metadata.title.as_deref(), Some("Titolo di prova"));
        assert_eq!(metadata.format, "mp3");
    }

    #[test]
    fn legge_i_tag_di_un_flac() {
        let dir = TempDir::new("metadata-flac");
        let path = flac_with_tags(dir.path(), "brano.flac");

        let metadata = read_metadata(&path).expect("metadati letti");

        assert_eq!(metadata.title.as_deref(), Some("Titolo di prova"));
        assert_eq!(metadata.format, "flac");
    }

    #[test]
    fn riporta_una_durata_non_negativa() {
        let dir = TempDir::new("metadata-duration");
        let path = wav_with_tags(dir.path(), "brano.wav");

        let metadata = read_metadata(&path).expect("metadati letti");

        assert!(metadata.duration_ms > 0);
    }

    #[test]
    fn non_restituisce_copertina_quando_non_c_e() {
        let dir = TempDir::new("cover-missing");
        let path = wav_with_tags(dir.path(), "brano.wav");

        assert_eq!(read_cover(&path).expect("lettura riuscita"), None);
    }

    #[test]
    fn restituisce_la_copertina_codificata_in_base64() {
        let dir = TempDir::new("cover-present");
        let path = wav_with_cover(dir.path(), "brano.wav");

        let metadata = read_metadata(&path).expect("metadati letti");
        let cover = read_cover(&path)
            .expect("lettura riuscita")
            .expect("copertina presente");

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
    fn la_copertina_di_un_file_assente_e_un_errore() {
        let error = read_cover(Path::new("C:/musica/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }
}
