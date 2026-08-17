//! Commands exposed to the frontend.
//! Phase 3 adds the `library` and `metadata` modules here.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub supported_extensions: Vec<String>,
}

pub const SUPPORTED_EXTENSIONS: [&str; 5] = ["mp3", "flac", "m4a", "ogg", "wav"];

pub fn build_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        supported_extensions: SUPPORTED_EXTENSIONS
            .iter()
            .map(|extension| (*extension).to_owned())
            .collect(),
    }
}

/// Returns name, version and supported formats of the application.
#[tauri::command]
pub fn app_info() -> AppInfo {
    build_app_info()
}

/// True when the extension, with or without a leading dot and in any case, is supported.
pub fn is_supported_extension(extension: &str) -> bool {
    let normalized = extension.trim_start_matches('.').to_lowercase();
    SUPPORTED_EXTENSIONS.contains(&normalized.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_espone_nome_e_versione_del_pacchetto() {
        let info = app_info();

        assert_eq!(info.name, "media-audio-lib");
        assert_eq!(info.version, "0.1.0");
    }

    #[test]
    fn app_info_elenca_i_formati_supportati() {
        let info = build_app_info();

        assert_eq!(info.supported_extensions.len(), SUPPORTED_EXTENSIONS.len());
        assert!(info.supported_extensions.contains(&"mp3".to_owned()));
    }

    #[test]
    fn app_info_e_serializzabile_verso_il_frontend() {
        let json = serde_json::to_string(&build_app_info()).expect("serializzazione riuscita");

        assert!(json.contains("\"supported_extensions\""));
    }

    #[test]
    fn le_estensioni_sono_riconosciute_senza_distinzione_di_case() {
        assert!(is_supported_extension("MP3"));
        assert!(is_supported_extension(".flac"));
        assert!(!is_supported_extension("mid"));
        assert!(!is_supported_extension(""));
    }
}
