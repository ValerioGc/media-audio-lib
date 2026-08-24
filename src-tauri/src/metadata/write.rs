//! Writing tags and cover art back to the audio file.
//!
//! Every edit happens on a copy that replaces the original only once it is complete,
//! so an interrupted or rejected write can never corrupt the user's file.
//!
//! Known limitation: on WAV, a cover written by this module cannot be removed again.
//! The ID3 chunk inside the RIFF container is not shrunk by `lofty`, so the old picture
//! survives. MP3 — the priority format — handles the full cycle correctly.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use lofty::config::WriteOptions;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::{Accessor, AudioFile, ItemKey, TaggedFileExt};
use lofty::tag::Tag;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::metadata::{
    ensure_importable, image_mime, read_metadata, read_tagged_file, Cover, TrackMetadata, PNG_MIME,
};

/// Marks the copy an edit is written on, and tells it apart from the file it came from.
pub const STAGING_MARKER: &str = ".mal-tmp.";

/// How long a staged copy is left alone before it counts as abandoned.
///
/// An edit takes a moment; anything older than this was left behind by a crash, a power
/// cut or a process killed halfway, and nobody is coming back for it.
pub const STAGING_MAX_AGE: Duration = Duration::from_secs(60 * 60);

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
        return Err(AppError::Validation("the title cannot be empty".to_owned()));
    }

    if update.title.chars().count() > MAX_TITLE_LENGTH {
        return Err(AppError::Validation(format!(
            "the title is limited to {MAX_TITLE_LENGTH} characters"
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

/// Checks the picture and gives back its bytes together with what they actually are.
///
/// The type the caller announces is a claim about the picture; the first bytes of the
/// picture are the picture. They are checked against each other so nothing is written into
/// a file under a name that does not fit it.
pub fn validate_cover(cover: &Cover) -> AppResult<(Vec<u8>, &'static str)> {
    if !ALLOWED_COVER_MIME.contains(&cover.mime_type.as_str()) {
        return Err(AppError::Validation(format!(
            "image format not accepted: {}",
            cover.mime_type
        )));
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&cover.data)
        .map_err(|error| AppError::Validation(format!("unreadable image: {error}")))?;

    if bytes.is_empty() {
        return Err(AppError::Validation("empty image".to_owned()));
    }

    let Some(mime_type) = image_mime(&bytes) else {
        return Err(AppError::Validation(
            "unrecognised image: only PNG and JPEG are accepted".to_owned(),
        ));
    };

    if bytes.len() > MAX_COVER_BYTES {
        return Err(AppError::Validation(format!(
            "image too large: {} MB at most",
            MAX_COVER_BYTES / (1024 * 1024)
        )));
    }

    Ok((bytes, mime_type))
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

    path.with_file_name(format!("{stem}{STAGING_MARKER}{extension}"))
}

/// Whether a path is one of the copies this module writes edits on.
///
/// A staged copy keeps the extension of the file it came from, so without this it would
/// look like an ordinary audio file to an import walking the same folder.
pub fn is_staging_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.contains(STAGING_MARKER))
}

/// Whether a file was touched more recently than `max_age`, so something may still be
/// writing it.
///
/// A file whose age cannot be read, or that claims to come from the future, counts as
/// recent: deleting on a clock we cannot make sense of is the worse mistake.
fn is_recent(path: &Path, max_age: Duration) -> bool {
    let Ok(modified) = std::fs::metadata(path).and_then(|metadata| metadata.modified()) else {
        return true;
    };

    match SystemTime::now().duration_since(modified) {
        Ok(age) => age < max_age,
        Err(_) => true,
    }
}

/// Deletes the staged copies left behind in the given folders, and says how many went.
///
/// An edit removes its own copy when it fails, but it cannot remove it when the process
/// does not live long enough to try. Sweeping at startup keeps those from piling up beside
/// the user's files. Only what is old enough is touched, so an edit running right now is
/// never pulled out from under itself.
pub fn remove_abandoned_staging_files<I: IntoIterator<Item = PathBuf>>(directories: I) -> usize {
    remove_staging_files_older_than(directories, STAGING_MAX_AGE)
}

/// The sweep itself, with the age it goes by named out loud so a test can choose it.
fn remove_staging_files_older_than<I: IntoIterator<Item = PathBuf>>(
    directories: I,
    max_age: Duration,
) -> usize {
    let mut visited: HashSet<PathBuf> = HashSet::new();
    let mut removed = 0;

    for directory in directories {
        if !visited.insert(directory.clone()) {
            continue;
        }

        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            if !is_staging_file(&path) || !path.is_file() || is_recent(&path, max_age) {
                continue;
            }

            if std::fs::remove_file(&path).is_ok() {
                removed += 1;
            }
        }
    }

    removed
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
    let picture = match cover.map(validate_cover) {
        Some(Ok(value)) => Some(value),
        Some(Err(error)) => return Err(error),
        None => None,
    };

    edit_tag(path, |tag| {
        while !tag.pictures().is_empty() {
            tag.remove_picture(0);
        }

        if let Some((bytes, mime_type)) = picture {
            // What the bytes are, not what they were announced as.
            let mime = match mime_type {
                PNG_MIME => MimeType::Png,
                _ => MimeType::Jpeg,
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
