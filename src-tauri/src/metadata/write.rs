//! Writing tags and cover art back to the audio file.
//!
//! Every edit happens on a copy that replaces the original only once it is complete,
//! so an interrupted or rejected write can never corrupt the user's file.
//!
//! Known limitation: on WAV, a cover written by this module cannot be removed again.
//! The ID3 chunk inside the RIFF container is not shrunk by `lofty`, so the old picture
//! survives. MP3 — the priority format — handles the full cycle correctly.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use lofty::config::WriteOptions;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::{Accessor, AudioFile, ItemKey, TaggedFileExt};
use lofty::tag::Tag;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{ensure_importable, read_metadata, read_tagged_file, Cover, TrackMetadata};

pub const MAX_COVER_BYTES: usize = 5 * 1024 * 1024;
pub const ALLOWED_COVER_MIME: [&str; 2] = ["image/png", "image/jpeg"];
pub const MIN_YEAR: u32 = 1000;
pub const MAX_TITLE_LENGTH: usize = 512;

/// Fields the user can edit. Empty optional fields clear the corresponding tag.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataUpdate {
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
}

fn current_year() -> u32 {
    const SECONDS_PER_YEAR: u64 = 31_556_952;

    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |value| value.as_secs());

    1970 + u32::try_from(elapsed / SECONDS_PER_YEAR).unwrap_or(0)
}

/// Upper bound accepted for the release year: next year, to allow upcoming releases.
pub fn max_year() -> u32 {
    current_year() + 1
}

fn blank_to_none(value: Option<&String>) -> Option<&str> {
    value
        .map(|text| text.trim())
        .filter(|text| !text.is_empty())
}

pub fn validate_update(update: &MetadataUpdate) -> AppResult<()> {
    if update.title.trim().is_empty() {
        return Err(AppError::Validation("title cannot be empty".to_owned()));
    }

    if update.title.chars().count() > MAX_TITLE_LENGTH {
        return Err(AppError::Validation(format!(
            "il titolo supera i {MAX_TITLE_LENGTH} caratteri"
        )));
    }

    if let Some(year) = update.year {
        if year < MIN_YEAR || year > max_year() {
            return Err(AppError::Validation(format!(
                "anno fuori intervallo: expected tra {MIN_YEAR} e {}",
                max_year()
            )));
        }
    }

    Ok(())
}

pub fn validate_cover(cover: &Cover) -> AppResult<Vec<u8>> {
    if !ALLOWED_COVER_MIME.contains(&cover.mime_type.as_str()) {
        return Err(AppError::Validation(format!(
            "formato immagine non ammesso: {}",
            cover.mime_type
        )));
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&cover.data)
        .map_err(|error| AppError::Validation(format!("immagine non leggibile: {error}")))?;

    if bytes.is_empty() {
        return Err(AppError::Validation("immagine vuota".to_owned()));
    }

    if bytes.len() > MAX_COVER_BYTES {
        return Err(AppError::Validation(format!(
            "immagine troppo grande: massimo {} MB",
            MAX_COVER_BYTES / (1024 * 1024)
        )));
    }

    Ok(bytes)
}

fn ensure_writable(path: &Path) -> AppResult<()> {
    let metadata = std::fs::metadata(path)?;

    if metadata.permissions().readonly() {
        return Err(AppError::ReadOnly(path.display().to_string()));
    }

    Ok(())
}

/// Sibling path that keeps the original extension, so format detection still works.
fn staging_path(path: &Path) -> PathBuf {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");

    path.with_file_name(format!("{stem}.mal-tmp.{extension}"))
}

/// Applies `edit` to a staged copy and swaps it in only on success.
///
/// The whole `TaggedFile` is rewritten instead of the single tag: saving a tag on its own
/// merges into what is already stored, so a removed cover would survive the write.
fn edit_tag(path: &Path, edit: impl FnOnce(&mut Tag) -> AppResult<()>) -> AppResult<TrackMetadata> {
    ensure_importable(path)?;
    ensure_writable(path)?;

    let staged = staging_path(path);
    std::fs::copy(path, &staged)?;

    let outcome = (|| {
        let mut tagged_file = read_tagged_file(&staged)?;
        let tag_type = tagged_file.primary_tag_type();

        let mut tag = tagged_file
            .primary_tag()
            .or_else(|| tagged_file.first_tag())
            .cloned()
            .unwrap_or_else(|| Tag::new(tag_type));

        edit(&mut tag)?;

        tagged_file.clear();
        tagged_file.insert_tag(tag);

        tagged_file
            .save_to_path(&staged, WriteOptions::default())
            .map_err(|error| AppError::InvalidAudio(error.to_string()))
    })();

    if let Err(error) = outcome {
        let _ = std::fs::remove_file(&staged);
        return Err(error);
    }

    std::fs::rename(&staged, path)?;

    read_metadata(path)
}

pub fn write_metadata(path: &Path, update: &MetadataUpdate) -> AppResult<TrackMetadata> {
    validate_update(update)?;

    edit_tag(path, |tag| {
        tag.set_title(update.title.trim().to_owned());
        apply_optional(
            tag,
            ItemKey::TrackArtist,
            blank_to_none(update.artist.as_ref()),
        );
        apply_optional(
            tag,
            ItemKey::AlbumTitle,
            blank_to_none(update.album.as_ref()),
        );
        apply_optional(tag, ItemKey::Genre, blank_to_none(update.genre.as_ref()));

        match update.year {
            Some(year) => {
                tag.insert_text(ItemKey::RecordingDate, year.to_string());
            }
            None => {
                tag.remove_key(ItemKey::RecordingDate);
                tag.remove_key(ItemKey::Year);
            }
        }

        Ok(())
    })
}

fn apply_optional(tag: &mut Tag, key: ItemKey, value: Option<&str>) {
    match value {
        Some(text) => {
            tag.insert_text(key, text.to_owned());
        }
        None => tag.remove_key(key),
    }
}

/// Replaces the embedded cover art, or removes it when `cover` is `None`.
pub fn write_cover(path: &Path, cover: Option<&Cover>) -> AppResult<TrackMetadata> {
    let picture = cover.map(|cover| validate_cover(cover).map(|bytes| (cover, bytes)));
    let picture = match picture {
        Some(Ok(value)) => Some(value),
        Some(Err(error)) => return Err(error),
        None => None,
    };

    edit_tag(path, |tag| {
        while !tag.pictures().is_empty() {
            tag.remove_picture(0);
        }

        if let Some((cover, bytes)) = picture {
            let mime = if cover.mime_type == "image/png" {
                MimeType::Png
            } else {
                MimeType::Jpeg
            };

            tag.push_picture(
                Picture::unchecked(bytes)
                    .mime_type(mime)
                    .pic_type(PictureType::CoverFront)
                    .build(),
            );
        }

        Ok(())
    })
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/metadata/write.rs");
}
