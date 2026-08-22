//! Reading of audio tags and cover art.
//!
//! Every supported format goes through `lofty`, so adding one is a matter of
//! listing its extension in [`SUPPORTED_EXTENSIONS`].

pub mod cover_cache;
pub mod write;

pub use cover_cache::{CoverCache, MAX_CACHE_BYTES};
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
    include!("../../../tests/backend/metadata/mod.rs");
}
