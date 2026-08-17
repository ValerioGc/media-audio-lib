//! Metadata commands. The parsing lives in [`crate::metadata`].

use std::path::Path;

use crate::error::AppResult;
use crate::metadata::{self, Cover, TrackMetadata};

/// Reads the tags of a single file, even before it enters the library.
#[tauri::command]
pub fn read_metadata(path: String) -> AppResult<TrackMetadata> {
    metadata::read_metadata(Path::new(&path))
}

/// Returns the embedded cover art, base64 encoded, or nothing when there is none.
#[tauri::command]
pub fn get_cover(path: String) -> AppResult<Option<Cover>> {
    metadata::read_cover(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::{wav_with_cover, wav_with_tags, TempDir};

    #[test]
    fn legge_i_metadati_da_un_percorso() {
        let dir = TempDir::new("commands-metadata");
        let path = wav_with_tags(dir.path(), "brano.wav");

        let metadata = read_metadata(path.display().to_string()).expect("lettura riuscita");

        assert_eq!(metadata.title.as_deref(), Some("Titolo di prova"));
    }

    #[test]
    fn legge_la_copertina_da_un_percorso() {
        let dir = TempDir::new("commands-cover");
        let path = wav_with_cover(dir.path(), "brano.wav");

        let cover = get_cover(path.display().to_string()).expect("lettura riuscita");

        assert_eq!(
            cover.map(|cover| cover.mime_type),
            Some("image/png".to_owned())
        );
    }

    #[test]
    fn riporta_l_errore_per_un_percorso_inesistente() {
        assert!(read_metadata("C:/musica/assente.mp3".to_owned()).is_err());
    }
}
