//! On-disk cache for extracted cover art.
//!
//! Pulling a picture out of an audio file means parsing the whole tag, which is too
//! slow to repeat for every scroll. Entries are keyed by file path *and* modification
//! time, so a file edited outside the app is never served stale.
//!
//! Cache failures are never fatal: on any problem the cover is read straight from the
//! audio file, which is exactly what the cache is there to avoid, not to replace.

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use base64::Engine as _;

use crate::error::AppResult;
use crate::hash::fnv1a_hex;
use crate::library::canonical_key;
use crate::metadata::{read_cover, Cover};

const PNG_MIME: &str = "image/png";
const JPEG_MIME: &str = "image/jpeg";
/// Marks a file already known to carry no cover, so it is not parsed again.
const EMPTY_EXTENSION: &str = "none";

pub struct CoverCache {
    directory: PathBuf,
}

fn extension_for(mime_type: &str) -> Option<&'static str> {
    match mime_type {
        PNG_MIME => Some("png"),
        JPEG_MIME => Some("jpg"),
        _ => None,
    }
}

fn mime_for(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some(PNG_MIME),
        "jpg" => Some(JPEG_MIME),
        _ => None,
    }
}

fn modified_seconds(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |elapsed| elapsed.as_secs())
}

impl CoverCache {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    /// Stable prefix of every entry belonging to `path`, regardless of its content.
    fn track_prefix(path: &Path) -> String {
        fnv1a_hex(&canonical_key(path))
    }

    /// Entry name for the file as it is right now: a new modification time means a new key.
    pub fn entry_key(path: &Path) -> String {
        format!("{}-{}", Self::track_prefix(path), modified_seconds(path))
    }

    fn cached(&self, key: &str) -> Option<Option<Cover>> {
        if self
            .directory
            .join(format!("{key}.{EMPTY_EXTENSION}"))
            .is_file()
        {
            return Some(None);
        }

        for extension in ["png", "jpg"] {
            let candidate = self.directory.join(format!("{key}.{extension}"));

            if let Ok(bytes) = std::fs::read(&candidate) {
                return Some(Some(Cover {
                    mime_type: mime_for(extension).unwrap_or(PNG_MIME).to_owned(),
                    data: base64::engine::general_purpose::STANDARD.encode(bytes),
                }));
            }
        }

        None
    }

    /// Drops the entries left over from previous versions of the same file.
    fn forget_older_entries(&self, path: &Path, current_key: &str) {
        let prefix = Self::track_prefix(path);

        let Ok(entries) = std::fs::read_dir(&self.directory) else {
            return;
        };

        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with(&prefix) && !name.starts_with(current_key) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    fn store(&self, key: &str, path: &Path, cover: Option<&Cover>) {
        if std::fs::create_dir_all(&self.directory).is_err() {
            return;
        }

        let stored = match cover {
            None => std::fs::write(self.directory.join(format!("{key}.{EMPTY_EXTENSION}")), []),
            Some(cover) => {
                let Some(extension) = extension_for(&cover.mime_type) else {
                    return;
                };
                let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&cover.data)
                else {
                    return;
                };

                std::fs::write(self.directory.join(format!("{key}.{extension}")), bytes)
            }
        };

        if stored.is_ok() {
            self.forget_older_entries(path, key);
        }
    }

    /// Returns the cover of `path`, reading the audio file only on a cache miss.
    pub fn load(&self, path: &Path) -> AppResult<Option<Cover>> {
        let key = Self::entry_key(path);

        if let Some(hit) = self.cached(&key) {
            return Ok(hit);
        }

        let cover = read_cover(path)?;
        self.store(&key, path, cover.as_ref());

        Ok(cover)
    }

    /// Empties the cache. Used when the user asks for a clean slate.
    pub fn clear(&self) -> AppResult<()> {
        if !self.directory.exists() {
            return Ok(());
        }

        for entry in std::fs::read_dir(&self.directory)?.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/metadata/cover_cache.rs");
}
