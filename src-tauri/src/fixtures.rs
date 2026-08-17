//! Audio files generated on the fly for the test suite.
//!
//! Building them programmatically keeps binary assets out of the repository and
//! makes every expectation in the tests explicit.

use std::path::{Path, PathBuf};

use lofty::config::WriteOptions;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::{Accessor, ItemKey, TagExt};
use lofty::tag::{Tag, TagType};

pub struct TempDir(tempfile::TempDir);

impl TempDir {
    pub fn new(prefix: &str) -> Self {
        Self(
            tempfile::Builder::new()
                .prefix(prefix)
                .tempdir()
                .expect("cartella temporanea creata"),
        )
    }

    pub fn path(&self) -> &Path {
        self.0.path()
    }
}

const SAMPLE_RATE: u32 = 44_100;
const PNG_HEADER: [u8; 8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/// Half a second of silent 16 bit stereo PCM wrapped in a RIFF container.
fn wav_bytes() -> Vec<u8> {
    let channels: u16 = 2;
    let bits_per_sample: u16 = 16;
    let block_align = channels * bits_per_sample / 8;
    let byte_rate = SAMPLE_RATE * u32::from(block_align);
    let data_len = byte_rate / 2;

    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes());
    bytes.extend_from_slice(&channels.to_le_bytes());
    bytes.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    bytes.extend_from_slice(&byte_rate.to_le_bytes());
    bytes.extend_from_slice(&block_align.to_le_bytes());
    bytes.extend_from_slice(&bits_per_sample.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_len.to_le_bytes());
    bytes.resize(44 + data_len as usize, 0);

    bytes
}

/// A sequence of silent MPEG-1 Layer III frames at 128 kbps.
fn mp3_bytes() -> Vec<u8> {
    const FRAME_HEADER: [u8; 4] = [0xff, 0xfb, 0x90, 0x00];
    const FRAME_SIZE: usize = 417;

    let mut bytes = Vec::with_capacity(FRAME_SIZE * 40);
    for _ in 0..40 {
        bytes.extend_from_slice(&FRAME_HEADER);
        bytes.resize(bytes.len() + FRAME_SIZE - FRAME_HEADER.len(), 0);
    }

    bytes
}

/// A FLAC stream carrying only its mandatory STREAMINFO block.
fn flac_bytes() -> Vec<u8> {
    let mut bytes = Vec::with_capacity(4 + 4 + 34);
    bytes.extend_from_slice(b"fLaC");
    bytes.push(0x80);
    bytes.extend_from_slice(&[0x00, 0x00, 0x22]);

    bytes.extend_from_slice(&4096u16.to_be_bytes());
    bytes.extend_from_slice(&4096u16.to_be_bytes());
    bytes.extend_from_slice(&[0x00, 0x00, 0x00]);
    bytes.extend_from_slice(&[0x00, 0x00, 0x00]);

    let packed = (u64::from(SAMPLE_RATE) << 44) | (1 << 41) | (15 << 36) | u64::from(SAMPLE_RATE);
    bytes.extend_from_slice(&packed.to_be_bytes());
    bytes.extend_from_slice(&[0u8; 16]);

    bytes
}

fn write_file(directory: &Path, name: &str, bytes: &[u8]) -> PathBuf {
    let path = directory.join(name);
    std::fs::write(&path, bytes).expect("file di test scritto");
    path
}

fn tag_with_values(tag_type: TagType) -> Tag {
    let mut tag = Tag::new(tag_type);
    tag.set_title("Titolo di prova".to_owned());
    tag.set_album("Album di prova".to_owned());
    tag.insert_text(ItemKey::RecordingDate, "1999".to_owned());
    tag.set_genre("Rock".to_owned());
    tag
}

fn save_tag(tag: &Tag, path: &Path) {
    tag.save_to_path(path, WriteOptions::default())
        .expect("tag scritti sul file di test");
}

pub fn wav_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &wav_bytes());
    save_tag(&tag_with_values(TagType::Id3v2), &path);
    path
}

pub fn wav_with_cover(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &wav_bytes());

    let mut tag = tag_with_values(TagType::Id3v2);
    let mut picture_data = PNG_HEADER.to_vec();
    picture_data.extend_from_slice(&[0u8; 32]);
    tag.push_picture(
        Picture::unchecked(picture_data)
            .mime_type(MimeType::Png)
            .pic_type(PictureType::CoverFront)
            .build(),
    );
    save_tag(&tag, &path);

    path
}

pub fn wav_without_tags(directory: &Path, name: &str) -> PathBuf {
    write_file(directory, name, &wav_bytes())
}

pub fn mp3_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &mp3_bytes());
    save_tag(&tag_with_values(TagType::Id3v2), &path);
    path
}

pub fn flac_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &flac_bytes());
    save_tag(&tag_with_values(TagType::VorbisComments), &path);
    path
}

pub fn corrupted_file(directory: &Path, name: &str) -> PathBuf {
    write_file(directory, name, b"questo non e un file audio valido")
}
