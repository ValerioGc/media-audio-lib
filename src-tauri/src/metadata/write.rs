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
    use super::*;
    use crate::fixtures::{png_cover_base64, wav_with_cover, wav_with_tags, TempDir};
    use crate::metadata::read_cover;

    fn update() -> MetadataUpdate {
        MetadataUpdate {
            title: "Nuovo titolo".to_owned(),
            artist: Some("New Artist".to_owned()),
            album: Some("Nuovo album".to_owned()),
            year: Some(2010),
            genre: Some("Blues".to_owned()),
        }
    }

    /// MP3 is the priority format, and the only one where the full cover life cycle
    /// (write, replace, remove) is verifiable: see the note on WAV below.
    #[test]
    fn on_mp3_cover_can_be_added_and_then_removed() {
        let dir = TempDir::new("cover-cycle-mp3");
        let path = crate::fixtures::mp3_with_tags(dir.path(), "track.mp3");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        assert!(
            write_cover(&path, Some(&cover))
                .expect("aggiunta riuscita")
                .has_cover
        );
        assert!(
            !write_cover(&path, None)
                .expect("removal succeeded")
                .has_cover
        );
        assert_eq!(read_cover(&path).expect("riread"), None);
    }

    #[test]
    fn writes_and_rereads_tags() {
        let dir = TempDir::new("write-roundtrip");
        let path = wav_with_tags(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("scrittura riuscita");
        let reread = read_metadata(&path).expect("riread succeeded");

        assert_eq!(written, reread);
        assert_eq!(reread.title.as_deref(), Some("Nuovo titolo"));
        assert_eq!(reread.artist.as_deref(), Some("New Artist"));
        assert_eq!(reread.album.as_deref(), Some("Nuovo album"));
        assert_eq!(reread.year, Some(2010));
        assert_eq!(reread.genre.as_deref(), Some("Blues"));
    }

    #[test]
    fn trims_fields_left_empty() {
        let dir = TempDir::new("write-clear");
        let path = wav_with_tags(dir.path(), "track.wav");

        let cleared = MetadataUpdate {
            title: "Solo titolo".to_owned(),
            artist: None,
            album: Some("   ".to_owned()),
            year: None,
            genre: None,
        };

        let written = write_metadata(&path, &cleared).expect("scrittura riuscita");

        assert_eq!(written.title.as_deref(), Some("Solo titolo"));
        assert_eq!(written.artist, None);
        assert_eq!(written.album, None);
        assert_eq!(written.year, None);
        assert_eq!(written.genre, None);
    }

    #[test]
    fn keeps_the_cover_when_only_text_changes() {
        let dir = TempDir::new("write-keeps-cover");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("scrittura riuscita");

        assert!(written.has_cover);
    }

    #[test]
    fn leaves_no_temporary_files() {
        let dir = TempDir::new("write-no-temp");
        let path = wav_with_tags(dir.path(), "track.wav");

        write_metadata(&path, &update()).expect("scrittura riuscita");

        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .expect("cartella leggibile")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("mal-tmp"))
            .collect();

        assert!(leftovers.is_empty());
    }

    #[test]
    fn rejects_an_empty_title_without_touching_the_file() {
        let dir = TempDir::new("write-empty-title");
        let path = wav_with_tags(dir.path(), "track.wav");
        let invalid = MetadataUpdate {
            title: "   ".to_owned(),
            ..update()
        };

        let error = write_metadata(&path, &invalid).unwrap_err();

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(
            read_metadata(&path).expect("riread").title.as_deref(),
            Some("Test Title")
        );
    }

    #[test]
    fn rejects_an_implausible_year() {
        let dir = TempDir::new("write-bad-year");
        let path = wav_with_tags(dir.path(), "track.wav");

        for year in [999, max_year() + 1] {
            let invalid = MetadataUpdate {
                year: Some(year),
                ..update()
            };

            assert!(matches!(
                write_metadata(&path, &invalid).unwrap_err(),
                AppError::Validation(_)
            ));
        }
    }

    #[test]
    fn accepts_the_allowed_range_boundaries() {
        assert!(validate_update(&MetadataUpdate {
            year: Some(MIN_YEAR),
            ..update()
        })
        .is_ok());
        assert!(validate_update(&MetadataUpdate {
            year: Some(max_year()),
            ..update()
        })
        .is_ok());
    }

    #[test]
    fn rejects_an_overly_long_title() {
        let invalid = MetadataUpdate {
            title: "a".repeat(MAX_TITLE_LENGTH + 1),
            ..update()
        };

        assert!(matches!(
            validate_update(&invalid).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_writing_to_a_read_only_file() {
        let dir = TempDir::new("write-readonly");
        let path = wav_with_tags(dir.path(), "track.wav");

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        permissions.set_readonly(true);
        std::fs::set_permissions(&path, permissions).expect("permessi impostati");

        let error = write_metadata(&path, &update()).unwrap_err();

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        #[allow(clippy::permissions_set_readonly_false)]
        permissions.set_readonly(false);
        std::fs::set_permissions(&path, permissions).expect("permessi ripristinati");

        assert!(matches!(error, AppError::ReadOnly(_)));
    }

    #[test]
    fn rejects_a_missing_file() {
        let error = write_metadata(Path::new("C:/music/assente.mp3"), &update()).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn writes_the_cover_and_reads_it_back() {
        let dir = TempDir::new("cover-write");
        let path = wav_with_tags(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        let written = write_cover(&path, Some(&cover)).expect("scrittura riuscita");
        let stored = read_cover(&path).expect("riread").expect("cover presente");

        assert!(written.has_cover);
        assert_eq!(stored.mime_type, "image/png");
        assert_eq!(stored.data, cover.data);
    }

    #[test]
    fn replaces_the_existing_cover_without_accumulating_others() {
        let dir = TempDir::new("cover-replace");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/jpeg".to_owned(),
            data: png_cover_base64(),
        };

        write_cover(&path, Some(&cover)).expect("scrittura riuscita");
        let stored = read_cover(&path).expect("riread").expect("cover presente");

        assert_eq!(stored.mime_type, "image/jpeg");
    }

    #[test]
    fn removes_the_cover() {
        let dir = TempDir::new("cover-remove");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_cover(&path, None).expect("removal succeeded");

        assert!(!written.has_cover);
        assert_eq!(read_cover(&path).expect("riread"), None);
    }

    #[test]
    fn rejects_a_disallowed_image_format() {
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_unreadable_or_empty_image() {
        let broken = Cover {
            mime_type: "image/png".to_owned(),
            data: "non-base64!!".to_owned(),
        };
        let empty = Cover {
            mime_type: "image/png".to_owned(),
            data: String::new(),
        };

        assert!(matches!(
            validate_cover(&broken).unwrap_err(),
            AppError::Validation(_)
        ));
        assert!(matches!(
            validate_cover(&empty).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_oversized_image() {
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: base64::engine::general_purpose::STANDARD.encode(vec![0u8; MAX_COVER_BYTES + 1]),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn invalid_cover_leaves_the_file_untouched() {
        let dir = TempDir::new("cover-invalid");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(write_cover(&path, Some(&cover)).is_err());
        assert!(read_cover(&path).expect("riread").is_some());
    }
}
